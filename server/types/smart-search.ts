/**
 * Smart Search Types
 * Intelligent app-wide navigation and feature discovery
 */

export interface SearchableFeature {
  id: string;
  title: string;
  description: string;
  category: string;
  route: string;
  action?: string;
  keywords: string[];
  requiredPermissions?: string[];
  embedding?: number[];
  // Extended fields for dynamic content (messages, etc.)
  entityType?: 'feature' | 'message' | 'chat' | 'email';
  entityId?: string | number;
  previewText?: string;
  senderName?: string;
  timestamp?: Date;
}

export interface CommonQuestion {
  question: string;
  targetId: string;
}

export interface SmartSearchIndex {
  features: SearchableFeature[];
  commonQuestions: CommonQuestion[];
}

export interface SmartSearchQuery {
  query: string;
  limit?: number;
  userRole?: string;
  userPermissions?: string[];
  userId?: string; // For filtering messages/content the user has access to
  includeMessages?: boolean; // Whether to search messages/emails
}

export interface SmartSearchResult {
  feature: SearchableFeature;
  score: number;
  matchType: 'exact' | 'fuzzy' | 'semantic' | 'keyword';
  matchedKeywords?: string[];
}

export interface SmartSearchResponse {
  results: SmartSearchResult[];
  queryTime: number;
  usedAI: boolean;
}

export interface SearchAnalytics {
  query: string;
  resultId: string | null;
  clicked: boolean;
  timestamp: Date;
  userId: string | undefined;
}

export interface RegenerationOptions {
  mode: 'all' | 'missing' | 'failed' | 'selected';
  featureIds?: string[]; // For 'selected' mode
  batchSize?: number;
}

export interface RegenerationProgress {
  total: number;
  completed: number;
  failed: number;
  inProgress: boolean;
  currentFeature?: string;
  errors: RegenerationError[];
  startTime?: Date;
  estimatedTimeRemaining?: number;
  isPaused?: boolean;
}

export interface RegenerationError {
  featureId: string;
  featureTitle: string;
  error: string;
  timestamp: Date;
}

export interface CostEstimate {
  totalFeatures: number;
  estimatedTokens: number;
  estimatedCost: number; // in USD
  model: string;
}

export interface FeatureAnalytics {
  featureId: string;
  searchCount: number;
  clickCount: number;
  lastSearched?: Date;
  averageScore: number;
}

export interface EmbeddingQualityMetric {
  featureId: string;
  featureTitle: string;
  hasEmbedding: boolean;
  embeddingDimension?: number;
  averageSimilarityToOthers?: number;
  qualityScore?: number; // 0-1, based on various factors
}

export interface SearchTestResult {
  query: string;
  results: SmartSearchResult[];
  usedAI: boolean;
  queryTime: number;
}
