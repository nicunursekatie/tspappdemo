// Search and Suggestions Service
// Provides unified search functionality across all system entities

import { db } from '../../db';
import { wishlistSuggestions, volunteers, recipients, searchAnalytics } from '@shared/schema';
import { ilike, or, and, eq, inArray, gte, lte, desc, sql } from 'drizzle-orm';
import { SearchEngine, type SearchFilters, type SearchResult } from '../../search-engine';
import { logger } from '../../utils/production-safe-logger';

// Extended search filters
export interface ExtendedSearchFilters extends SearchFilters {
  wishlistStatus?: ('pending' | 'approved' | 'rejected' | 'added')[];
  priority?: ('high' | 'medium' | 'low')[];
  searchTypes?: ('collection' | 'host' | 'recipient' | 'project' | 'contact' | 'wishlist' | 'volunteer')[];
}

// Wishlist search result
export interface WishlistSearchResult {
  id: number;
  item: string;
  reason: string | null;
  priority: string;
  status: string;
  suggestedBy: string;
  estimatedCost: string | null;
  amazonUrl: string | null;
  createdAt: Date;
  relevance: number;
}

// Global search response
export interface GlobalSearchResponse {
  results: SearchResult[];
  summary: {
    collections: number;
    hosts: number;
    projects: number;
    contacts: number;
    wishlists: number;
    volunteers: number;
    recipients: number;
    total: number;
  };
  filters: ExtendedSearchFilters;
}

// Service interface
export interface ISearchService {
  // Global search across all entities
  globalSearch(
    query: string,
    filters?: ExtendedSearchFilters,
    limit?: number
  ): Promise<GlobalSearchResponse>;

  // Entity-specific searches
  searchCollections(query: string, filters?: SearchFilters, limit?: number): Promise<SearchResult[]>;
  searchHosts(query: string, filters?: SearchFilters, limit?: number): Promise<SearchResult[]>;
  searchProjects(query: string, filters?: SearchFilters, limit?: number): Promise<SearchResult[]>;
  searchContacts(query: string, limit?: number): Promise<SearchResult[]>;

  // Wishlist suggestions search
  searchWishlistSuggestions(
    query: string,
    filters?: Pick<ExtendedSearchFilters, 'wishlistStatus' | 'priority'>,
    limit?: number
  ): Promise<WishlistSearchResult[]>;

  // Volunteer search
  searchVolunteers(query: string, limit?: number): Promise<SearchResult[]>;

  // Recipient search
  searchRecipients(query: string, limit?: number): Promise<SearchResult[]>;

  // Quick suggestions for autocomplete
  getQuickSuggestions(query: string, limit?: number): Promise<string[]>;

  // Search optimization - get popular/recent searches
  getPopularSearches(limit?: number): Promise<string[]>;
}

export class SearchService implements ISearchService {
  /**
   * Global search across all entities
   */
  async globalSearch(
    query: string,
    filters: ExtendedSearchFilters = {},
    limit: number = 100
  ): Promise<GlobalSearchResponse> {
    try {
      const searchTypes = filters.searchTypes || [
        'collection',
        'host',
        'project',
        'contact',
        'wishlist',
        'volunteer',
        'recipient',
      ];

      // Distribute limit proportionally based on enabled search types
      // Ensure minimum of 1 result per type to prevent empty searches on low limits
      // Example: limit=3, types=7 → perTypeLimit=1 (gets 7 results, sliced to 3)
      // Example: limit=100, types=7 → perTypeLimit=14 (gets ~98 results, sliced to 100)
      const typeCount = searchTypes.length;
      const perTypeLimit = Math.max(1, Math.floor(limit / typeCount));

      // Map to track which promise index corresponds to which type
      const typeToIndexMap: Map<string, number> = new Map();
      const searchPromises: Promise<SearchResult[]>[] = [];

      if (searchTypes.includes('collection')) {
        typeToIndexMap.set('collection', searchPromises.length);
        searchPromises.push(this.searchCollections(query, filters, perTypeLimit));
      }
      if (searchTypes.includes('host')) {
        typeToIndexMap.set('host', searchPromises.length);
        searchPromises.push(this.searchHosts(query, filters, perTypeLimit));
      }
      if (searchTypes.includes('project')) {
        typeToIndexMap.set('project', searchPromises.length);
        searchPromises.push(this.searchProjects(query, filters, perTypeLimit));
      }
      if (searchTypes.includes('contact')) {
        typeToIndexMap.set('contact', searchPromises.length);
        searchPromises.push(this.searchContacts(query, perTypeLimit));
      }
      if (searchTypes.includes('wishlist')) {
        typeToIndexMap.set('wishlist', searchPromises.length);
        // Convert wishlist search to return SearchResult[] directly for parallel execution
        searchPromises.push(
          this.searchWishlistSuggestions(
            query,
            { wishlistStatus: filters.wishlistStatus, priority: filters.priority },
            perTypeLimit
          ).then((results) => this.convertWishlistToSearchResults(results))
        );
      }
      if (searchTypes.includes('volunteer')) {
        typeToIndexMap.set('volunteer', searchPromises.length);
        searchPromises.push(this.searchVolunteers(query, perTypeLimit));
      }
      if (searchTypes.includes('recipient')) {
        typeToIndexMap.set('recipient', searchPromises.length);
        searchPromises.push(this.searchRecipients(query, perTypeLimit));
      }

      const allResults = await Promise.all(searchPromises);
      const flatResults = allResults.flat();

      // Sort by relevance
      flatResults.sort((a, b) => b.relevance - a.relevance);

      // Calculate summary using the type-to-index mapping
      const summary = {
        collections: typeToIndexMap.has('collection')
          ? allResults[typeToIndexMap.get('collection')!]?.length || 0
          : 0,
        hosts: typeToIndexMap.has('host')
          ? allResults[typeToIndexMap.get('host')!]?.length || 0
          : 0,
        projects: typeToIndexMap.has('project')
          ? allResults[typeToIndexMap.get('project')!]?.length || 0
          : 0,
        contacts: typeToIndexMap.has('contact')
          ? allResults[typeToIndexMap.get('contact')!]?.length || 0
          : 0,
        wishlists: typeToIndexMap.has('wishlist')
          ? allResults[typeToIndexMap.get('wishlist')!]?.length || 0
          : 0,
        volunteers: typeToIndexMap.has('volunteer')
          ? allResults[typeToIndexMap.get('volunteer')!]?.length || 0
          : 0,
        recipients: typeToIndexMap.has('recipient')
          ? allResults[typeToIndexMap.get('recipient')!]?.length || 0
          : 0,
        total: flatResults.length,
      };

      return {
        results: flatResults.slice(0, limit),
        summary,
        filters,
      };
    } catch (error) {
      logger.error('Global search failed:', error);
      return {
        results: [],
        summary: {
          collections: 0,
          hosts: 0,
          projects: 0,
          contacts: 0,
          wishlists: 0,
          volunteers: 0,
          recipients: 0,
          total: 0,
        },
        filters,
      };
    }
  }

  /**
   * Search sandwich collections
   */
  async searchCollections(
    query: string,
    filters?: SearchFilters,
    limit: number = 50
  ): Promise<SearchResult[]> {
    return SearchEngine.searchCollections(query, filters, limit);
  }

  /**
   * Search hosts
   */
  async searchHosts(
    query: string,
    filters?: SearchFilters,
    limit: number = 50
  ): Promise<SearchResult[]> {
    return SearchEngine.searchHosts(query, filters, limit);
  }

  /**
   * Search projects
   */
  async searchProjects(
    query: string,
    filters?: SearchFilters,
    limit: number = 50
  ): Promise<SearchResult[]> {
    return SearchEngine.searchProjects(query, filters, limit);
  }

  /**
   * Search contacts
   */
  async searchContacts(query: string, limit: number = 50): Promise<SearchResult[]> {
    return SearchEngine.searchContacts(query, limit);
  }

  /**
   * Search wishlist suggestions with filtering
   */
  async searchWishlistSuggestions(
    query: string,
    filters: Pick<ExtendedSearchFilters, 'wishlistStatus' | 'priority'> = {},
    limit: number = 50
  ): Promise<WishlistSearchResult[]> {
    try {
      const conditions = [];

      // Text search
      if (query.trim()) {
        conditions.push(
          or(
            ilike(wishlistSuggestions.item, `%${query}%`),
            ilike(wishlistSuggestions.reason, `%${query}%`),
            ilike(wishlistSuggestions.adminNotes, `%${query}%`)
          )
        );
      }

      // Status filter
      if (filters.wishlistStatus && filters.wishlistStatus.length > 0) {
        conditions.push(inArray(wishlistSuggestions.status, filters.wishlistStatus));
      }

      // Priority filter
      if (filters.priority && filters.priority.length > 0) {
        conditions.push(inArray(wishlistSuggestions.priority, filters.priority));
      }

      let dbQuery = db
        .select()
        .from(wishlistSuggestions)
        .orderBy(desc(wishlistSuggestions.createdAt));

      if (conditions.length > 0) {
        dbQuery = dbQuery.where(and(...conditions));
      }

      const results = await dbQuery.limit(limit);

      return results.map((item) => ({
        id: item.id,
        item: item.item,
        reason: item.reason,
        priority: item.priority,
        status: item.status,
        suggestedBy: item.suggestedBy,
        estimatedCost: item.estimatedCost,
        amazonUrl: item.amazonUrl,
        createdAt: item.createdAt,
        relevance: this.calculateWishlistRelevance(query, item),
      }));
    } catch (error) {
      logger.error('Wishlist search failed:', error);
      return [];
    }
  }

  /**
   * Search volunteers
   */
  async searchVolunteers(query: string, limit: number = 50): Promise<SearchResult[]> {
    try {
      const conditions = [];

      if (query.trim()) {
        conditions.push(
          or(
            ilike(volunteers.name, `%${query}%`),
            ilike(volunteers.email, `%${query}%`),
            ilike(volunteers.phone, `%${query}%`),
            ilike(volunteers.skills, `%${query}%`)
          )
        );
      }

      let dbQuery = db.select().from(volunteers);

      if (conditions.length > 0) {
        dbQuery = dbQuery.where(and(...conditions));
      }

      const results = await dbQuery.limit(limit);

      return results.map((item) => ({
        type: 'volunteer' as const,
        id: item.id,
        title: item.name,
        description: `${item.email}${item.phone ? ` - ${item.phone}` : ''} ${
          item.skills ? `| Skills: ${item.skills}` : ''
        }`,
        relevance: this.calculateRelevance(query, [
          item.name,
          item.email || '',
          item.phone || '',
          item.skills || '',
        ]),
        metadata: {
          email: item.email,
          phone: item.phone,
          skills: item.skills,
          status: item.status,
          availability: item.availability,
        },
      }));
    } catch (error) {
      logger.error('Volunteer search failed:', error);
      return [];
    }
  }

  /**
   * Search recipients
   */
  async searchRecipients(query: string, limit: number = 50): Promise<SearchResult[]> {
    try {
      const conditions = [];

      if (query.trim()) {
        conditions.push(
          or(
            ilike(recipients.name, `%${query}%`),
            ilike(recipients.address, `%${query}%`),
            ilike(recipients.notes, `%${query}%`)
          )
        );
      }

      let dbQuery = db.select().from(recipients);

      if (conditions.length > 0) {
        dbQuery = dbQuery.where(and(...conditions));
      }

      const results = await dbQuery.limit(limit);

      return results.map((item) => ({
        type: 'recipient' as const,
        id: item.id,
        title: item.name,
        description: `${item.address || 'No address'} ${
          item.contactPerson ? `| Contact: ${item.contactPerson}` : ''
        }`,
        relevance: this.calculateRelevance(query, [
          item.name,
          item.address || '',
          item.contactPerson || '',
          item.notes || '',
        ]),
        metadata: {
          address: item.address,
          contactPerson: item.contactPerson,
          phone: item.phone,
          status: item.status,
          notes: item.notes,
        },
      }));
    } catch (error) {
      logger.error('Recipient search failed:', error);
      return [];
    }
  }

  /**
   * Get quick suggestions for autocomplete
   */
  async getQuickSuggestions(query: string, limit: number = 10): Promise<string[]> {
    try {
      const suggestions = await SearchEngine.getSearchSuggestions(query);
      return suggestions.slice(0, limit);
    } catch (error) {
      logger.error('Quick suggestions failed:', error);
      return [];
    }
  }

  /**
   * Get popular/recent searches (placeholder for future optimization)
   * In a production environment, this would track user searches
   */
  async getPopularSearches(limit: number = 10): Promise<string[]> {
    try {
      const popularQueries = await db
        .select({
          query: searchAnalytics.query,
          count: sql<number>`count(*)`,
        })
        .from(searchAnalytics)
        .where(sql`${searchAnalytics.query} <> ''`)
        .groupBy(searchAnalytics.query)
        .orderBy(desc(sql<number>`count(*)`))
        .limit(limit);

      if (popularQueries.length > 0) {
        return popularQueries.map((row) => row.query);
      }
    } catch (error) {
      logger.error('Popular search analytics failed:', error);
    }

    return [
      'sandwiches',
      'volunteers',
      'hosts',
      'projects',
      'pending',
      'urgent',
      'supplies',
      'wishlist',
    ].slice(0, limit);
  }

  /**
   * Convert wishlist results to standard search results
   */
  private convertWishlistToSearchResults(wishlistResults: WishlistSearchResult[]): SearchResult[] {
    return wishlistResults.map((item) => ({
      type: 'wishlist' as any,
      id: item.id,
      title: item.item,
      description: `${item.status} - Priority: ${item.priority} ${
        item.reason ? `| ${item.reason.substring(0, 100)}` : ''
      }`,
      relevance: item.relevance,
      metadata: {
        priority: item.priority,
        status: item.status,
        estimatedCost: item.estimatedCost,
        amazonUrl: item.amazonUrl,
        suggestedBy: item.suggestedBy,
      },
    }));
  }

  /**
   * Calculate relevance for wishlist items
   */
  private calculateWishlistRelevance(
    query: string,
    item: Pick<WishlistSearchResult, 'item' | 'reason' | 'priority' | 'status'>
  ): number {
    if (!query.trim()) return 0.5;

    const queryLower = query.toLowerCase();
    let relevance = 0;

    const fields = [item.item, item.reason || ''];

    fields.forEach((field, index) => {
      const fieldLower = field.toLowerCase();

      if (fieldLower === queryLower) {
        relevance += 1.0 / (index + 1);
      } else if (fieldLower.startsWith(queryLower)) {
        relevance += 0.8 / (index + 1);
      } else if (fieldLower.includes(queryLower)) {
        relevance += 0.5 / (index + 1);
      }
    });

    // Boost for high priority items
    if (item.priority === 'high') {
      relevance *= 1.2;
    }

    // Boost for pending items (more actionable)
    if (item.status === 'pending') {
      relevance *= 1.1;
    }

    return Math.min(relevance, 1.0);
  }

  /**
   * Calculate relevance for general items
   */
  private calculateRelevance(query: string, fields: string[]): number {
    if (!query.trim()) return 0.5;

    const queryLower = query.toLowerCase();
    let relevance = 0;

    fields.forEach((field, index) => {
      if (!field) return;

      const fieldLower = field.toLowerCase();

      if (fieldLower === queryLower) {
        relevance += 1.0 / (index + 1);
      } else if (fieldLower.startsWith(queryLower)) {
        relevance += 0.8 / (index + 1);
      } else if (fieldLower.includes(queryLower)) {
        relevance += 0.5 / (index + 1);
      }
    });

    return Math.min(relevance, 1.0);
  }
}

// Export singleton instance
export const searchService = new SearchService();
