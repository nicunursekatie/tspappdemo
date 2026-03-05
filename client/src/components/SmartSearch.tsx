/**
 * Smart Search Component
 * Intelligent app-wide navigation powered by AI
 *
 * Features:
 * - Instant fuzzy search as you type
 * - AI-powered semantic search on Enter
 * - Keyboard shortcuts (Cmd/Ctrl+K)
 * - Context-aware results based on user role
 * - Analytics tracking for continuous improvement
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useLocation } from 'wouter';
import * as Dialog from '@radix-ui/react-dialog';
import { Search, Command, ArrowRight, Sparkles, Loader2, X, MessageSquare, Mail, User } from 'lucide-react';

interface SearchableFeature {
  id: string;
  title: string;
  description: string;
  category: string;
  route: string;
  action?: string;
  keywords: string[];
  requiredPermissions?: string[];
  entityType?: 'feature' | 'message' | 'chat' | 'email';
  entityId?: string | number;
  previewText?: string;
  senderName?: string;
  timestamp?: string;
}

interface SmartSearchResult {
  feature: SearchableFeature;
  score: number;
  matchType: 'exact' | 'fuzzy' | 'semantic' | 'keyword';
  matchedKeywords?: string[];
}

interface SmartSearchResponse {
  results: SmartSearchResult[];
  queryTime: number;
  usedAI: boolean;
}

export function SmartSearch() {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SmartSearchResult[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [usedAI, setUsedAI] = useState(false);
  const [, setLocation] = useLocation();
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout>();

  // Detect Mac for keyboard shortcuts (safer than deprecated navigator.platform)
  const isMac = typeof navigator !== 'undefined' &&
    (navigator.userAgent.includes('Mac') || navigator.platform.includes('Mac'));

  // Keyboard shortcut to open search (Cmd/Ctrl+K)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsOpen(true);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Focus input when dialog opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  // Reset state when dialog closes
  useEffect(() => {
    if (!isOpen) {
      setQuery('');
      setResults([]);
      setSelectedIndex(0);
      setUsedAI(false);
    }
  }, [isOpen]);

  // Perform fuzzy search (instant, as you type)
  const performFuzzySearch = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim()) {
      setResults([]);
      setUsedAI(false);
      return;
    }

    try {
      const response = await fetch('/api/smart-search/fuzzy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ query: searchQuery, limit: 8 })
      });

      if (response.ok) {
        const data: SmartSearchResponse = await response.json();
        setResults(data.results);
        setUsedAI(false); // Reset AI flag for fuzzy results
        setSelectedIndex(0);
      }
    } catch (error) {
      console.error('Fuzzy search failed:', error);
    }
  }, []);

  // Perform AI semantic search (on Enter)
  const performSemanticSearch = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim()) return;

    setIsLoading(true);
    setUsedAI(false);

    try {
      const response = await fetch('/api/smart-search/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ query: searchQuery, limit: 8 })
      });

      if (response.ok) {
        const data: SmartSearchResponse = await response.json();
        setResults(data.results);
        setUsedAI(data.usedAI);
        setSelectedIndex(0);
      }
    } catch (error) {
      console.error('Semantic search failed:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Handle input change with debounced fuzzy search
  const handleQueryChange = (value: string) => {
    setQuery(value);

    // Clear previous timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    // Debounce fuzzy search
    debounceTimerRef.current = setTimeout(() => {
      performFuzzySearch(value);
    }, 150);
  };

  const triggerFeatureAction = useCallback((feature: SearchableFeature) => {
    if (!feature.action) {
      return;
    }

    if (feature.action === 'openAddDialog') {
      const route = feature.route || '';

      if (route.startsWith('/collections')) {
        window.dispatchEvent(new Event('openCollectionForm'));
        return;
      }

      if (route.startsWith('/event-requests')) {
        window.dispatchEvent(new Event('openEventRequestCreateDialog'));
        return;
      }

      if (route.startsWith('/projects')) {
        window.dispatchEvent(new Event('openProjectCreateDialog'));
        return;
      }

      if (route.includes('section=hosts')) {
        window.dispatchEvent(new Event('openHostCreateDialog'));
        return;
      }

      if (route.includes('section=volunteers')) {
        window.dispatchEvent(new Event('openVolunteerCreateDialog'));
        return;
      }
    }
  }, []);

  // Navigate to selected result
  const navigateToResult = useCallback((result: SmartSearchResult) => {
    // Track analytics (non-blocking)
    fetch('/api/smart-search/analytics', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        query,
        resultId: result.feature.id,
        clicked: true
      })
    }).catch(error => {
      console.error('Failed to track analytics:', error);
    });

    // Close dialog immediately
    setIsOpen(false);

    // Navigate to route
    setLocation(result.feature.route);

    if (result.feature.action) {
      setTimeout(() => {
        triggerFeatureAction(result.feature);
      }, 200);
    }
  }, [query, setLocation, triggerFeatureAction]);

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => Math.min(prev + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter' && results.length > 0) {
      e.preventDefault();
      if (selectedIndex >= 0 && selectedIndex < results.length) {
        navigateToResult(results[selectedIndex]);
      }
    } else if (e.key === 'Enter' && results.length === 0 && query.trim() && !isLoading) {
      // Trigger AI search on Enter if no results and not loading
      e.preventDefault();
      performSemanticSearch(query);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setIsOpen(false);
    }
  };

  // Get match type badge color
  const getMatchTypeBadge = (matchType: string) => {
    switch (matchType) {
      case 'exact':
        return <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700">Exact Match</span>;
      case 'semantic':
        return <span className="text-xs px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 flex items-center gap-1">
          <Sparkles className="w-3 h-3" /> AI Match
        </span>;
      case 'fuzzy':
        return <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">Similar</span>;
      default:
        return null;
    }
  };

  // Get icon for result type
  const getResultIcon = (feature: SearchableFeature) => {
    switch (feature.entityType) {
      case 'message':
        return <MessageSquare className="w-5 h-5 text-blue-500" />;
      case 'email':
        return <Mail className="w-5 h-5 text-orange-500" />;
      case 'chat':
        return <MessageSquare className="w-5 h-5 text-green-500" />;
      default:
        return <Search className="w-5 h-5 text-gray-400" />;
    }
  };

  // Format timestamp for display
  const formatTimestamp = (timestamp: string | undefined) => {
    if (!timestamp) return null;
    try {
      const date = new Date(timestamp);
      const now = new Date();
      const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

      if (diffDays === 0) {
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      } else if (diffDays === 1) {
        return 'Yesterday';
      } else if (diffDays < 7) {
        return date.toLocaleDateString([], { weekday: 'short' });
      } else {
        return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
      }
    } catch {
      return null;
    }
  };

  return (
    <>
      {/* Trigger Button */}
      <button
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors"
        title="Search (Cmd/Ctrl+K)"
      >
        <Search className="w-4 h-4" />
        <span className="hidden sm:inline">Search</span>
        <kbd className="hidden sm:inline-block px-2 py-0.5 text-xs font-mono bg-gray-100 border border-gray-300 rounded">
          {isMac ? '⌘K' : 'Ctrl+K'}
        </kbd>
      </button>

      {/* Search Dialog */}
      <Dialog.Root open={isOpen} onOpenChange={setIsOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/50 z-50" />
          <Dialog.Content
            className="fixed top-[20%] left-1/2 -translate-x-1/2 w-full max-w-2xl bg-white rounded-lg shadow-2xl z-50 overflow-hidden"
            onKeyDown={handleKeyDown}
          >
            {/* Search Input */}
            <div className="flex items-center gap-3 p-4 border-b">
              <Search className="w-5 h-5 text-gray-400" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => handleQueryChange(e.target.value)}
                placeholder="What are you looking for?"
                className="flex-1 text-lg outline-none"
              />
              {isLoading && <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />}
              <button
                onClick={() => setIsOpen(false)}
                className="p-1 hover:bg-gray-100 rounded"
              >
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            {/* AI Badge */}
            {usedAI && (
              <div className="px-4 py-2 bg-purple-50 border-b border-purple-100 flex items-center gap-2 text-sm text-purple-700">
                <Sparkles className="w-4 h-4" />
                AI-powered results
              </div>
            )}

            {/* Results */}
            <div className="max-h-[60vh] overflow-y-auto">
              {results.length === 0 && query.trim() && !isLoading && (
                <div className="p-8 text-center text-gray-500">
                  <p className="mb-2">No results found</p>
                  <p className="text-sm">Press <kbd className="px-2 py-1 bg-gray-100 rounded">Enter</kbd> to try AI-powered search</p>
                </div>
              )}

              {results.length === 0 && !query.trim() && (
                <div className="p-8 text-center text-gray-500">
                  <Command className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                  <p className="text-lg font-medium mb-1">What can I help you find?</p>
                  <p className="text-sm">Try: "Kim" to find messages, "add a volunteer", or "view collections"</p>
                </div>
              )}

              {results.map((result, index) => (
                <button
                  key={result.feature.id}
                  onClick={() => navigateToResult(result)}
                  className={`w-full px-4 py-3 flex items-start gap-3 hover:bg-gray-50 transition-colors border-b last:border-b-0 ${
                    index === selectedIndex ? 'bg-blue-50' : ''
                  }`}
                >
                  {/* Icon based on result type */}
                  <div className="flex-shrink-0 mt-0.5">
                    {getResultIcon(result.feature)}
                  </div>
                  <div className="flex-1 text-left min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-gray-900 truncate">{result.feature.title}</span>
                      {getMatchTypeBadge(result.matchType)}
                      {/* Show timestamp for messages/emails */}
                      {result.feature.timestamp && (
                        <span className="text-xs text-gray-400 flex-shrink-0">
                          {formatTimestamp(result.feature.timestamp)}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-600 mb-1 line-clamp-2">{result.feature.description}</p>
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      <span className={`px-2 py-0.5 rounded ${
                        result.feature.entityType === 'message' ? 'bg-blue-50 text-blue-700' :
                        result.feature.entityType === 'email' ? 'bg-orange-50 text-orange-700' :
                        'bg-gray-100'
                      }`}>
                        {result.feature.category}
                      </span>
                      {result.feature.senderName && (
                        <span className="flex items-center gap-1">
                          <User className="w-3 h-3" />
                          {result.feature.senderName}
                        </span>
                      )}
                      {result.matchedKeywords && result.matchedKeywords.length > 0 && !result.feature.entityType && (
                        <span>• Matched: {result.matchedKeywords.join(', ')}</span>
                      )}
                    </div>
                  </div>
                  <ArrowRight className="w-5 h-5 text-gray-400 flex-shrink-0 mt-1" />
                </button>
              ))}
            </div>

            {/* Footer Hints */}
            <div className="px-4 py-2 bg-gray-50 border-t flex items-center justify-between text-xs text-gray-500">
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1">
                  <kbd className="px-2 py-0.5 bg-white border rounded">↑↓</kbd> Navigate
                </span>
                <span className="flex items-center gap-1">
                  <kbd className="px-2 py-0.5 bg-white border rounded">Enter</kbd> Select
                </span>
                <span className="flex items-center gap-1">
                  <kbd className="px-2 py-0.5 bg-white border rounded">Esc</kbd> Close
                </span>
              </div>
              {query && !isLoading && (
                <span className="text-xs text-gray-400">
                  Press Enter for AI search
                </span>
              )}
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
}
