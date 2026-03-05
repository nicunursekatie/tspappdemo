/**
 * Smart Search Service
 * Provides intelligent app-wide navigation using hybrid search:
 * 1. Fuzzy matching for instant results
 * 2. OpenAI embeddings for semantic understanding
 * 3. Analytics-driven learning
 */

import OpenAI from 'openai';
import { promises as fs } from 'fs';
import * as path from 'path';
import {
  SmartSearchIndex,
  SmartSearchQuery,
  SmartSearchResult,
  SearchableFeature,
  RegenerationOptions,
  RegenerationProgress,
  RegenerationError,
  CostEstimate,
  FeatureAnalytics,
  EmbeddingQualityMetric,
  SearchAnalytics,
  SearchTestResult
} from '../types/smart-search';
import { db } from '../db';
import { messages, messageRecipients, emailMessages, users } from '@shared/schema';
import { eq, or, ilike, and, desc, sql } from 'drizzle-orm';
import { logger } from '../utils/production-safe-logger';

export class SmartSearchService {
  private index: SmartSearchIndex | null = null;
  private openai: OpenAI | null = null;
  private indexPath: string;
  private analyticsPath: string;
  private embeddingCache: Map<string, number[]> = new Map();
  private indexLoadPromise: Promise<void> | null = null;
  private regenerationProgress: RegenerationProgress | null = null;
  private isPaused: boolean = false;
  private analytics: SearchAnalytics[] = [];
  private shouldStop: boolean = false;

  constructor(openaiApiKey?: string) {
    // Use process.cwd() for production build compatibility
    // In dev: /home/user/project/server/data/smart-search-index.json
    // In prod: /home/user/project/server/data/smart-search-index.json
    this.indexPath = path.resolve(process.cwd(), 'server/data/smart-search-index.json');
    this.analyticsPath = path.resolve(process.cwd(), 'server/data/smart-search-analytics.json');

    if (openaiApiKey) {
      this.openai = new OpenAI({
        apiKey: openaiApiKey
      });
    }

    // Load analytics on startup
    this.loadAnalytics();
  }

  /**
   * Load search index from JSON file
   * Safe to call multiple times - will only load once
   */
  async loadIndex(): Promise<void> {
    // If already loaded, return immediately
    if (this.index) {
      return;
    }

    // If currently loading, wait for that promise
    if (this.indexLoadPromise) {
      return this.indexLoadPromise;
    }

    // Start loading
    this.indexLoadPromise = (async () => {
      try {
        const data = await fs.readFile(this.indexPath, 'utf-8');
        this.index = JSON.parse(data);
        logger.log(`✓ Smart search index loaded: ${this.index?.features.length} features`);
      } catch (error) {
        logger.error('Failed to load smart search index:', error);
        // Initialize with empty index
        this.index = { features: [], commonQuestions: [] };
      } finally {
        this.indexLoadPromise = null;
      }
    })();

    return this.indexLoadPromise;
  }

  /**
   * Save search index to JSON file
   */
  async saveIndex(): Promise<void> {
    if (!this.index) return;

    try {
      await fs.writeFile(
        this.indexPath,
        JSON.stringify(this.index, null, 2),
        'utf-8'
      );
      logger.log('✓ Smart search index saved');
    } catch (error) {
      logger.error('Failed to save smart search index:', error);
    }
  }

  /**
   * Get embedding vector from OpenAI
   */
  private async getEmbedding(text: string): Promise<number[] | null> {
    if (!this.openai) return null;

    // Check cache first
    if (this.embeddingCache.has(text)) {
      return this.embeddingCache.get(text)!;
    }

    try {
      const response = await this.openai.embeddings.create({
        model: 'text-embedding-3-small',
        input: text
      });

      const embedding = response.data[0].embedding;
      this.embeddingCache.set(text, embedding);
      return embedding;
    } catch (error) {
      logger.error('Failed to get embedding:', error);
      return null;
    }
  }

  /**
   * Check if user has permission to access a feature
   */
  private hasPermission(feature: SearchableFeature, query: SmartSearchQuery): boolean {
    // If feature has no required permissions, it's accessible to all
    if (!feature.requiredPermissions || feature.requiredPermissions.length === 0) {
      return true;
    }

    // Admin role has access to everything
    if (query.userRole === 'admin') {
      return true;
    }

    // Check if user has any of the required permissions
    const userPermissions = query.userPermissions || [];
    return feature.requiredPermissions.some(permission =>
      userPermissions.includes(permission)
    );
  }

  /**
   * Calculate cosine similarity between two vectors
   */
  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0;

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  /**
   * Calculate fuzzy match score between query and text
   * Returns a score between 0 and 1
   */
  private fuzzyMatch(query: string, text: string): number {
    const q = query.toLowerCase();
    const t = text.toLowerCase();

    // Exact match
    if (t === q) return 1.0;

    // Starts with
    if (t.startsWith(q)) return 0.9;

    // Contains
    if (t.includes(q)) return 0.7;

    // Calculate Levenshtein distance ratio
    const distance = this.levenshteinDistance(q, t);
    const maxLength = Math.max(q.length, t.length);
    const similarity = 1 - (distance / maxLength);

    // Only return meaningful similarities
    return similarity > 0.6 ? similarity * 0.6 : 0;
  }

  /**
   * Calculate Levenshtein distance between two strings
   */
  private levenshteinDistance(a: string, b: string): number {
    const matrix: number[][] = [];

    for (let i = 0; i <= b.length; i++) {
      matrix[i] = [i];
    }

    for (let j = 0; j <= a.length; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= b.length; i++) {
      for (let j = 1; j <= a.length; j++) {
        if (b.charAt(i - 1) === a.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }

    return matrix[b.length][a.length];
  }

  /**
   * Search messages and emails for a user
   * Returns messages where the user is sender/recipient and content matches query
   */
  async searchMessages(query: SmartSearchQuery): Promise<SmartSearchResult[]> {
    if (!query.userId || !query.query.trim()) {
      return [];
    }

    const searchTerm = `%${query.query.toLowerCase()}%`;
    const results: SmartSearchResult[] = [];

    try {
      // Search internal messages (Team Chat, DMs, etc.)
      const internalMessages = await db
        .select({
          id: messages.id,
          content: messages.content,
          sender: messages.sender,
          senderId: messages.senderId,
          contextType: messages.contextType,
          contextTitle: messages.contextTitle,
          createdAt: messages.createdAt,
          senderFirstName: users.firstName,
          senderLastName: users.lastName,
          senderDisplayName: users.displayName,
          senderEmail: users.email,
        })
        .from(messages)
        .leftJoin(users, eq(messages.senderId, users.id))
        .innerJoin(
          messageRecipients,
          eq(messages.id, messageRecipients.messageId)
        )
        .where(
          and(
            or(
              eq(messages.senderId, query.userId),
              eq(messageRecipients.recipientId, query.userId)
            ),
            or(
              ilike(messages.content, searchTerm),
              ilike(messages.sender, searchTerm),
              ilike(users.firstName || '', searchTerm),
              ilike(users.lastName || '', searchTerm),
              ilike(users.displayName || '', searchTerm)
            )
          )
        )
        .orderBy(desc(messages.createdAt))
        .limit(10);

      // Convert internal messages to SearchableFeature format
      for (const msg of internalMessages) {
        const senderName = msg.senderDisplayName ||
          `${msg.senderFirstName || ''} ${msg.senderLastName || ''}`.trim() ||
          msg.sender || 'Unknown';

        const preview = msg.content?.substring(0, 100) + (msg.content && msg.content.length > 100 ? '...' : '');
        const contextLabel = msg.contextType === 'direct' ? 'Direct Message' :
          msg.contextTitle || msg.contextType || 'Message';

        // Calculate match score
        const q = query.query.toLowerCase();
        let score = 0;
        if (senderName.toLowerCase().includes(q)) score = 0.9;
        else if (msg.content?.toLowerCase().includes(q)) score = 0.7;
        else score = 0.5;

        results.push({
          feature: {
            id: `message-${msg.id}`,
            title: `Message from ${senderName}`,
            description: preview || 'No content',
            category: contextLabel,
            route: `/dashboard?section=chat&messageId=${msg.id}`,
            keywords: [senderName.toLowerCase(), msg.contextType || ''],
            entityType: 'message',
            entityId: msg.id,
            previewText: preview,
            senderName,
            timestamp: msg.createdAt || undefined,
          },
          score,
          matchType: 'fuzzy',
        });
      }

      // Search email messages
      const emails = await db
        .select({
          id: emailMessages.id,
          subject: emailMessages.subject,
          content: emailMessages.content,
          senderName: emailMessages.senderName,
          senderEmail: emailMessages.senderEmail,
          recipientName: emailMessages.recipientName,
          createdAt: emailMessages.createdAt,
        })
        .from(emailMessages)
        .where(
          and(
            or(
              eq(emailMessages.senderId, query.userId),
              eq(emailMessages.recipientId, query.userId)
            ),
            or(
              ilike(emailMessages.subject || '', searchTerm),
              ilike(emailMessages.content || '', searchTerm),
              ilike(emailMessages.senderName || '', searchTerm),
              ilike(emailMessages.recipientName || '', searchTerm)
            )
          )
        )
        .orderBy(desc(emailMessages.createdAt))
        .limit(10);

      // Convert emails to SearchableFeature format
      for (const email of emails) {
        const preview = email.content?.substring(0, 100) + (email.content && email.content.length > 100 ? '...' : '');

        // Calculate match score
        const q = query.query.toLowerCase();
        let score = 0;
        if (email.senderName?.toLowerCase().includes(q)) score = 0.9;
        else if (email.recipientName?.toLowerCase().includes(q)) score = 0.85;
        else if (email.subject?.toLowerCase().includes(q)) score = 0.8;
        else if (email.content?.toLowerCase().includes(q)) score = 0.6;
        else score = 0.5;

        results.push({
          feature: {
            id: `email-${email.id}`,
            title: email.subject || 'No Subject',
            description: `From: ${email.senderName || email.senderEmail} - ${preview || 'No content'}`,
            category: 'Email',
            route: `/dashboard?section=gmail-inbox&emailId=${email.id}`,
            keywords: [
              email.senderName?.toLowerCase() || '',
              email.recipientName?.toLowerCase() || '',
            ].filter(Boolean),
            entityType: 'email',
            entityId: email.id,
            previewText: preview,
            senderName: email.senderName || email.senderEmail || undefined,
            timestamp: email.createdAt || undefined,
          },
          score,
          matchType: 'fuzzy',
        });
      }

      // Sort all results by score
      results.sort((a, b) => b.score - a.score);

      // Limit total results
      return results.slice(0, query.limit || 10);
    } catch (error) {
      logger.error('Error searching messages:', error);
      return [];
    }
  }

  /**
   * Perform fuzzy search (server-side, designed for fast/instant client responses)
   */
  async fuzzySearch(query: SmartSearchQuery): Promise<SmartSearchResult[]> {
    if (!this.index) {
      await this.loadIndex();
    }

    if (!this.index || !query.query.trim()) {
      return [];
    }

    const q = query.query.toLowerCase().trim();
    const results: SmartSearchResult[] = [];

    for (const feature of this.index.features) {
      // Skip if user doesn't have required permissions
      if (!this.hasPermission(feature, query)) {
        continue;
      }

      let maxScore = 0;
      let matchedKeywords: string[] = [];

      // Check title
      const titleScore = this.fuzzyMatch(q, feature.title);
      maxScore = Math.max(maxScore, titleScore * 1.2); // Title matches get bonus

      // Check description
      const descScore = this.fuzzyMatch(q, feature.description);
      maxScore = Math.max(maxScore, descScore * 0.8);

      // Check category
      const categoryScore = this.fuzzyMatch(q, feature.category);
      maxScore = Math.max(maxScore, categoryScore * 0.9);

      // Check keywords
      for (const keyword of feature.keywords) {
        const keywordScore = this.fuzzyMatch(q, keyword);
        if (keywordScore > 0.7) {
          matchedKeywords.push(keyword);
          maxScore = Math.max(maxScore, keywordScore);
        }
      }

      // Only include results with meaningful scores
      if (maxScore > 0.3) {
        results.push({
          feature,
          score: maxScore,
          matchType: maxScore > 0.9 ? 'exact' : 'fuzzy',
          matchedKeywords: matchedKeywords.length > 0 ? matchedKeywords : undefined
        });
      }
    }

    // Sort by score descending
    results.sort((a, b) => b.score - a.score);

    // If includeMessages is true and userId is provided, also search messages
    if (query.includeMessages !== false && query.userId) {
      try {
        const messageResults = await this.searchMessages(query);
        // Merge message results with feature results
        results.push(...messageResults);
        // Re-sort after merging
        results.sort((a, b) => b.score - a.score);
      } catch (error) {
        logger.error('Error including message search results:', error);
      }
    }

    // Apply limit
    return results.slice(0, query.limit || 10);
  }

  /**
   * Perform semantic search using OpenAI embeddings
   * Returns results with usedAI flag to track if AI was actually used
   */
  async semanticSearch(query: SmartSearchQuery): Promise<{ results: SmartSearchResult[], usedAI: boolean }> {
    if (!this.openai || !this.index) {
      // Fallback to fuzzy search if AI not available
      const fuzzyResults = await this.fuzzySearch(query);
      return { results: fuzzyResults, usedAI: false };
    }

    // Get query embedding
    const queryEmbedding = await this.getEmbedding(query.query);
    if (!queryEmbedding) {
      const fuzzyResults = await this.fuzzySearch(query);
      return { results: fuzzyResults, usedAI: false };
    }

    const results: SmartSearchResult[] = [];
    let embeddingsAdded = false;

    for (const feature of this.index.features) {
      // Skip if user doesn't have required permissions
      if (!this.hasPermission(feature, query)) {
        continue;
      }

      // Create searchable text from feature
      const searchableText = `${feature.title} ${feature.description} ${feature.keywords.join(' ')}`;

      // Get or compute embedding for this feature
      let featureEmbedding = feature.embedding;
      if (!featureEmbedding) {
        const computed = await this.getEmbedding(searchableText);
        if (computed) {
          featureEmbedding = computed;
          feature.embedding = featureEmbedding;
          embeddingsAdded = true;
        }
      }

      if (featureEmbedding) {
        const similarity = this.cosineSimilarity(queryEmbedding, featureEmbedding);

        if (similarity > 0.5) { // Threshold for semantic relevance
          results.push({
            feature,
            score: similarity,
            matchType: 'semantic'
          });
        }
      }
    }

    // Save updated index only if new embeddings were added
    if (embeddingsAdded) {
      await this.saveIndex();
    }

    // Sort by score descending
    results.sort((a, b) => b.score - a.score);

    // Apply limit
    return {
      results: results.slice(0, query.limit || 10),
      usedAI: true
    };
  }

  /**
   * Hybrid search: combines fuzzy and semantic results
   * Returns results with usedAI flag to accurately track AI usage
   */
  async hybridSearch(query: SmartSearchQuery): Promise<{ results: SmartSearchResult[], usedAI: boolean }> {
    const [fuzzyResults, semanticData] = await Promise.all([
      this.fuzzySearch(query),
      this.semanticSearch(query)
    ]);

    const semanticResults = semanticData.results;
    const usedAI = semanticData.usedAI;

    // Merge results, prioritizing exact/fuzzy matches but including semantic ones
    const resultMap = new Map<string, SmartSearchResult>();

    // Add fuzzy results first (higher priority)
    for (const result of fuzzyResults) {
      resultMap.set(result.feature.id, result);
    }

    // Add semantic results, boosting scores if already present
    // Only mark as semantic if AI was actually used
    for (const result of semanticResults) {
      const existing = resultMap.get(result.feature.id);
      if (existing) {
        // Boost score if both fuzzy and semantic match
        existing.score = Math.min(1.0, existing.score * 1.2 + result.score * 0.3);
        // Only mark as semantic if AI was actually used
        if (usedAI) {
          existing.matchType = 'semantic';
        }
      } else {
        resultMap.set(result.feature.id, result);
      }
    }

    // Convert back to array and sort
    const results = Array.from(resultMap.values());
    results.sort((a, b) => b.score - a.score);

    return {
      results: results.slice(0, query.limit || 10),
      usedAI
    };
  }

  /**
   * Check common questions for quick answers
   */
  async checkCommonQuestions(query: string): Promise<SearchableFeature | null> {
    if (!this.index) {
      await this.loadIndex();
    }

    if (!this.index) return null;

    const q = query.toLowerCase().trim();

    for (const cq of this.index.commonQuestions) {
      if (this.fuzzyMatch(q, cq.question) > 0.8) {
        const feature = this.index.features.find(f => f.id === cq.targetId);
        if (feature) return feature;
      }
    }

    return null;
  }

  /**
   * Get all features (for display/debugging)
   */
  async getAllFeatures(): Promise<SearchableFeature[]> {
    if (!this.index) {
      await this.loadIndex();
    }
    return this.index?.features || [];
  }

  /**
   * Load analytics from JSON file
   */
  private async loadAnalytics(): Promise<void> {
    try {
      const data = await fs.readFile(this.analyticsPath, 'utf-8');
      this.analytics = JSON.parse(data);
      logger.log(`✓ Smart search analytics loaded: ${this.analytics.length} records`);
    } catch (error) {
      // File doesn't exist yet, start with empty array
      this.analytics = [];
    }
  }

  /**
   * Save analytics to JSON file
   */
  private async saveAnalytics(): Promise<void> {
    try {
      await fs.writeFile(
        this.analyticsPath,
        JSON.stringify(this.analytics, null, 2),
        'utf-8'
      );
    } catch (error) {
      logger.error('Failed to save analytics:', error);
    }
  }

  /**
   * Record search analytics
   */
  async recordAnalytics(analytics: SearchAnalytics): Promise<void> {
    this.analytics.push(analytics);
    // Keep only last 10000 records
    if (this.analytics.length > 10000) {
      this.analytics = this.analytics.slice(-10000);
    }
    await this.saveAnalytics();
  }

  /**
   * Get analytics summary
   */
  async getAnalyticsSummary(): Promise<{
    totalSearches: number;
    topSearches: { query: string; count: number }[];
    featureAnalytics: FeatureAnalytics[];
    deadFeatures: string[]; // Features never searched
  }> {
    if (!this.index) {
      await this.loadIndex();
    }

    const featureMap = new Map<string, FeatureAnalytics>();
    const queryMap = new Map<string, number>();

    // Process analytics
    for (const record of this.analytics) {
      // Track queries
      queryMap.set(record.query, (queryMap.get(record.query) || 0) + 1);

      // Track features
      if (record.resultId) {
        const existing = featureMap.get(record.resultId) || {
          featureId: record.resultId,
          searchCount: 0,
          clickCount: 0,
          averageScore: 0
        };

        existing.searchCount++;
        if (record.clicked) {
          existing.clickCount++;
        }
        existing.lastSearched = record.timestamp;

        featureMap.set(record.resultId, existing);
      }
    }

    // Get top searches
    const topSearches = Array.from(queryMap.entries())
      .map(([query, count]) => ({ query, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 20);

    // Find dead features
    const searchedIds = new Set(featureMap.keys());
    const deadFeatures = this.index?.features
      .filter(f => !searchedIds.has(f.id))
      .map(f => f.id) || [];

    return {
      totalSearches: this.analytics.length,
      topSearches,
      featureAnalytics: Array.from(featureMap.values()),
      deadFeatures
    };
  }

  /**
   * Get cost estimate for regenerating embeddings
   */
  async getCostEstimate(options: RegenerationOptions): Promise<CostEstimate> {
    if (!this.index) {
      await this.loadIndex();
    }

    if (!this.index) {
      throw new Error('Index not loaded');
    }

    let featuresToProcess: SearchableFeature[] = [];

    switch (options.mode) {
      case 'all':
        featuresToProcess = this.index.features;
        break;
      case 'missing':
        featuresToProcess = this.index.features.filter(f => !f.embedding);
        break;
      case 'failed':
        const failedIds = new Set(
          this.regenerationProgress?.errors.map(e => e.featureId) || []
        );
        featuresToProcess = this.index.features.filter(f => failedIds.has(f.id));
        break;
      case 'selected':
        if (options.featureIds) {
          const selectedIds = new Set(options.featureIds);
          featuresToProcess = this.index.features.filter(f => selectedIds.has(f.id));
        }
        break;
    }

    // Estimate tokens: average ~100 tokens per feature (title + description + keywords)
    const estimatedTokens = featuresToProcess.length * 100;

    // text-embedding-3-small pricing: $0.02 / 1M tokens
    const estimatedCost = (estimatedTokens / 1_000_000) * 0.02;

    return {
      totalFeatures: featuresToProcess.length,
      estimatedTokens,
      estimatedCost,
      model: 'text-embedding-3-small'
    };
  }

  /**
   * Get regeneration progress
   */
  getRegenerationProgress(): RegenerationProgress | null {
    return this.regenerationProgress;
  }

  /**
   * Pause ongoing regeneration
   */
  pauseRegeneration(): void {
    if (this.regenerationProgress?.inProgress) {
      this.isPaused = true;
      if (this.regenerationProgress) {
        this.regenerationProgress.isPaused = true;
      }
    }
  }

  /**
   * Resume paused regeneration
   */
  resumeRegeneration(): void {
    this.isPaused = false;
    if (this.regenerationProgress) {
      this.regenerationProgress.isPaused = false;
    }
  }

  /**
   * Stop ongoing regeneration
   */
  stopRegeneration(): void {
    this.shouldStop = true;
    this.isPaused = false;
  }

  /**
   * Regenerate embeddings with options (admin only)
   */
  async regenerateEmbeddingsWithOptions(options: RegenerationOptions): Promise<void> {
    if (!this.openai || !this.index) {
      throw new Error('OpenAI not configured or index not loaded');
    }

    // Determine which features to process
    let featuresToProcess: SearchableFeature[] = [];

    switch (options.mode) {
      case 'all':
        featuresToProcess = this.index.features;
        break;
      case 'missing':
        featuresToProcess = this.index.features.filter(f => !f.embedding);
        break;
      case 'failed':
        const failedIds = new Set(
          this.regenerationProgress?.errors.map(e => e.featureId) || []
        );
        featuresToProcess = this.index.features.filter(f => failedIds.has(f.id));
        break;
      case 'selected':
        if (options.featureIds) {
          const selectedIds = new Set(options.featureIds);
          featuresToProcess = this.index.features.filter(f => selectedIds.has(f.id));
        }
        break;
    }

    // Initialize progress tracking
    this.regenerationProgress = {
      total: featuresToProcess.length,
      completed: 0,
      failed: 0,
      inProgress: true,
      errors: [],
      startTime: new Date(),
      isPaused: false
    };

    this.shouldStop = false;
    logger.log(`Regenerating embeddings for ${featuresToProcess.length} features (mode: ${options.mode})...`);

    const batchSize = options.batchSize || 5;

    for (let i = 0; i < featuresToProcess.length; i += batchSize) {
      // Check if we should stop
      if (this.shouldStop) {
        logger.log('Regeneration stopped by user');
        this.regenerationProgress.inProgress = false;
        return;
      }

      // Wait while paused
      while (this.isPaused) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      const batch = featuresToProcess.slice(i, i + batchSize);

      // Process batch and collect results to avoid race conditions
      const results = await Promise.all(batch.map(async (feature) => {
        try {
          const searchableText = `${feature.title} ${feature.description} ${feature.keywords.join(' ')}`;
          const embedding = await this.getEmbedding(searchableText);

          if (embedding) {
            feature.embedding = embedding;
            logger.log(`✓ Generated embedding for: ${feature.title}`);
            return { success: true, feature };
          } else {
            throw new Error('Failed to generate embedding');
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          logger.error(`✗ Failed to generate embedding for: ${feature.title} - ${errorMessage}`);
          return {
            success: false,
            feature,
            error: {
              featureId: feature.id,
              featureTitle: feature.title,
              error: errorMessage,
              timestamp: new Date()
            }
          };
        }
      }));

      // Atomically update progress counters to avoid race conditions
      for (const result of results) {
        if (result.success) {
          this.regenerationProgress!.completed++;
        } else {
          this.regenerationProgress!.failed++;
          this.regenerationProgress!.errors.push(result.error!);
        }
      }

      // Update current feature for display (use last successful or last in batch)
      const lastFeature = results[results.length - 1]?.feature;
      if (lastFeature) {
        this.regenerationProgress!.currentFeature = lastFeature.title;
      }

      logger.log(`Batch complete: ${this.regenerationProgress!.completed}/${this.regenerationProgress!.total}`);

      // Update estimated time remaining
      const elapsed = Date.now() - this.regenerationProgress.startTime!.getTime();
      const elapsedSeconds = elapsed / 1000;

      // Only calculate ETA if we have completed at least 1 feature and have elapsed time
      if (this.regenerationProgress.completed > 0 && elapsedSeconds > 0) {
        const rate = this.regenerationProgress.completed / elapsedSeconds; // features per second
        const remaining = featuresToProcess.length - this.regenerationProgress.completed;
        this.regenerationProgress.estimatedTimeRemaining = remaining / rate;
      } else {
        // Not enough data yet for accurate estimate
        this.regenerationProgress.estimatedTimeRemaining = undefined;
      }

      // Save progress periodically
      await this.saveIndex();
    }

    this.regenerationProgress.inProgress = false;
    this.regenerationProgress.currentFeature = undefined;
    await this.saveIndex();
    logger.log(`✓ Regeneration complete: ${this.regenerationProgress.completed} succeeded, ${this.regenerationProgress.failed} failed`);
  }

  /**
   * Get embedding quality metrics
   */
  async getEmbeddingQualityMetrics(): Promise<EmbeddingQualityMetric[]> {
    if (!this.index) {
      await this.loadIndex();
    }

    if (!this.index) return [];

    const metrics: EmbeddingQualityMetric[] = [];

    for (const feature of this.index.features) {
      const metric: EmbeddingQualityMetric = {
        featureId: feature.id,
        featureTitle: feature.title,
        hasEmbedding: !!feature.embedding,
        embeddingDimension: feature.embedding?.length
      };

      // Calculate average similarity to other features (sample-based)
      if (feature.embedding) {
        const sampleSize = Math.min(20, this.index.features.length);
        const samples = this.index.features
          .filter(f => f.id !== feature.id && f.embedding)
          .slice(0, sampleSize);

        if (samples.length > 0) {
          const similarities = samples.map(s =>
            this.cosineSimilarity(feature.embedding!, s.embedding!)
          );
          metric.averageSimilarityToOthers = similarities.reduce((a, b) => a + b, 0) / similarities.length;
        }

        // Quality score based on:
        // - Having an embedding (0.5)
        // - Not too similar to everything else (0.3)
        // - Proper dimension (0.2)
        let qualityScore = 0.5;
        if (metric.embeddingDimension === 1536) qualityScore += 0.2;
        if (metric.averageSimilarityToOthers && metric.averageSimilarityToOthers < 0.7) {
          qualityScore += 0.3;
        }
        metric.qualityScore = qualityScore;
      } else {
        metric.qualityScore = 0;
      }

      metrics.push(metric);
    }

    return metrics;
  }

  /**
   * Add a new feature
   */
  async addFeature(feature: Omit<SearchableFeature, 'id'>): Promise<SearchableFeature> {
    if (!this.index) {
      await this.loadIndex();
    }

    if (!this.index) {
      throw new Error('Index not loaded');
    }

    const newFeature: SearchableFeature = {
      ...feature,
      id: `custom-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`
    };

    this.index.features.push(newFeature);
    await this.saveIndex();

    return newFeature;
  }

  /**
   * Update an existing feature
   */
  async updateFeature(id: string, updates: Partial<SearchableFeature>): Promise<SearchableFeature | null> {
    if (!this.index) {
      await this.loadIndex();
    }

    if (!this.index) {
      throw new Error('Index not loaded');
    }

    const feature = this.index.features.find(f => f.id === id);
    if (!feature) {
      return null;
    }

    // Check if content actually changed before invalidating embedding
    const contentChanged = 
      (updates.title !== undefined && updates.title !== feature.title) ||
      (updates.description !== undefined && updates.description !== feature.description) ||
      (updates.keywords !== undefined && JSON.stringify(updates.keywords) !== JSON.stringify(feature.keywords));

    Object.assign(feature, updates);

    // If content changed, invalidate embedding
    if (contentChanged) {
      feature.embedding = undefined;
    }

    await this.saveIndex();
    return feature;
  }

  /**
   * Delete a feature
   */
  async deleteFeature(id: string): Promise<boolean> {
    if (!this.index) {
      await this.loadIndex();
    }

    if (!this.index) {
      throw new Error('Index not loaded');
    }

    const initialLength = this.index.features.length;
    this.index.features = this.index.features.filter(f => f.id !== id);

    if (this.index.features.length < initialLength) {
      await this.saveIndex();
      return true;
    }

    return false;
  }

  /**
   * Export features to JSON
   */
  async exportFeatures(): Promise<SearchableFeature[]> {
    if (!this.index) {
      await this.loadIndex();
    }
    return this.index?.features || [];
  }

  /**
   * Import features from JSON
   */
  async importFeatures(features: SearchableFeature[], mode: 'replace' | 'merge'): Promise<void> {
    if (!this.index) {
      await this.loadIndex();
    }

    if (!this.index) {
      throw new Error('Index not loaded');
    }

    if (mode === 'replace') {
      this.index.features = features;
    } else {
      // Merge: replace existing, add new
      const existingMap = new Map(this.index.features.map((f, idx) => [f.id, idx]));

      for (const feature of features) {
        const existingIndex = existingMap.get(feature.id);
        if (existingIndex !== undefined) {
          this.index.features[existingIndex] = feature;
        } else {
          this.index.features.push(feature);
        }
      }
    }

    await this.saveIndex();
  }

  /**
   * Test search functionality
   */
  async testSearch(query: string, userRole?: string): Promise<SearchTestResult> {
    const startTime = Date.now();

    const searchQuery: SmartSearchQuery = {
      query,
      limit: 10,
      userRole
    };

    const { results, usedAI } = await this.hybridSearch(searchQuery);
    const queryTime = Date.now() - startTime;

    return {
      query,
      results,
      usedAI,
      queryTime
    };
  }

  /**
   * Regenerate all embeddings (admin only) - legacy method
   */
  async regenerateEmbeddings(): Promise<void> {
    return this.regenerateEmbeddingsWithOptions({ mode: 'all' });
  }
}
