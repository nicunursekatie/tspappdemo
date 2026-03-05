import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../hooks/useAuth';
import { ResourceAdminModal } from '../components/resource-admin-modal';
import { PageBreadcrumbs } from '@/components/page-breadcrumbs';
import { useOnboardingTracker } from '@/hooks/useOnboardingTracker';
import {
  Search,
  Filter,
  Star,
  Link2,
  FileText,
  ExternalLink,
  Pin,
  TrendingUp,
  Clock,
  Plus,
  Edit,
  Trash2,
  Tag,
  Copy,
  Check,
  ChevronDown,
  Folder,
  Briefcase,
  Shield,
  FileCheck,
  BookOpen,
  FileEdit,
  X,
  Image,
  Download,
  Share2,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { FloatingAIChat } from '@/components/floating-ai-chat';

// Category definitions with icons and colors (using brand color scheme)
const CATEGORIES = [
  {
    id: 'legal_governance',
    label: 'Legal & Governance',
    icon: Shield,
    color: 'text-[#236383]', // Brand dark blue
    bgColor: 'bg-[#236383]/10',
    borderColor: 'border-[#236383]/30',
  },
  {
    id: 'brand_marketing',
    label: 'Brand & Marketing',
    icon: Briefcase,
    color: 'text-[#A31C41]', // Brand red
    bgColor: 'bg-[#A31C41]/10',
    borderColor: 'border-[#A31C41]/30',
  },
  {
    id: 'operations_safety',
    label: 'Operations & Safety',
    icon: Shield,
    color: 'text-[#007E8C]', // Brand teal
    bgColor: 'bg-[#007E8C]/10',
    borderColor: 'border-[#007E8C]/30',
  },
  {
    id: 'forms_templates',
    label: 'Forms & Templates',
    icon: FileCheck,
    color: 'text-[#47B3CB]', // Brand light blue
    bgColor: 'bg-[#47B3CB]/10',
    borderColor: 'border-[#47B3CB]/30',
  },
  {
    id: 'toolkit',
    label: 'Toolkit',
    icon: BookOpen,
    color: 'text-[#FBAD3F]', // Brand orange
    bgColor: 'bg-[#FBAD3F]/10',
    borderColor: 'border-[#FBAD3F]/30',
  },
  {
    id: 'master_documents',
    label: 'Master Documents',
    icon: FileEdit,
    color: 'text-[#236383]', // Brand dark blue
    bgColor: 'bg-[#236383]/10',
    borderColor: 'border-[#236383]/30',
  },
];

interface Resource {
  resource: {
    id: number;
    title: string;
    description: string | null;
    type: 'file' | 'link' | 'google_drive';
    category: string;
    documentId: number | null;
    url: string | null;
    icon: string | null;
    iconColor: string | null;
    isPinnedGlobal: boolean;
    pinnedOrder: number | null;
    accessCount: number;
    lastAccessedAt: string | null;
    createdBy: string;
    createdByName: string;
    createdAt: string;
    updatedAt: string;
    isActive: boolean;
  };
  document?: {
    id: number;
    mimeType: string;
    originalName: string;
    fileSize: number;
  } | null;
  isFavorite: boolean;
  tags: Array<{ id: number; name: string; color: string | null }>;
}

interface Tag {
  tag: {
    id: number;
    name: string;
    color: string | null;
    description: string | null;
  };
  usageCount: number;
}

// Sandwich Assembly Guides Component
function SandwichAssemblyGuides() {
  const { toast } = useToast();

  const guides = [
    {
      title: "Sandwich Assembly",
      description: "Basic sandwich assembly guide showing cheese, meat, and cheese layers",
      imageUrl: "/images/sandwich-assembly.png",
      fileName: "sandwich-assembly.png",
    },
    {
      title: "White Bread Sandwich",
      description: "Complete sandwich with white bread - bread, cheese, meat, cheese, bread",
      imageUrl: "/images/sandwich-white-bread.png",
      fileName: "sandwich-white-bread.png",
    },
    {
      title: "Why Cheese on the Bottom",
      description: "Cheese acts as a moisture barrier to keep bread from getting soggy",
      imageUrl: "/images/why-cheese-bottom.png",
      fileName: "why-cheese-bottom.png",
    },
  ];

  const handleDownload = async (imageUrl: string, fileName: string) => {
    try {
      const response = await fetch(imageUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      toast({
        title: 'Download started',
        description: `${fileName} is downloading`,
        duration: 3000,
      });
    } catch (error) {
      console.error('Download failed:', error);
      window.open(imageUrl, '_blank');
    }
  };

  const handleShare = async (title: string, description: string, imageUrl: string) => {
    const shareUrl = window.location.origin + imageUrl;
    
    if (navigator.share) {
      try {
        await navigator.share({
          title: title,
          text: description,
          url: shareUrl,
        });
      } catch (error) {
        if ((error as Error).name !== 'AbortError') {
          await navigator.clipboard.writeText(shareUrl);
          toast({
            title: 'Link copied!',
            description: 'Share link copied to clipboard',
            duration: 3000,
          });
        }
      }
    } else {
      await navigator.clipboard.writeText(shareUrl);
      toast({
        title: 'Link copied!',
        description: 'Share link copied to clipboard',
        duration: 3000,
      });
    }
  };

  return (
    <div className="mb-8">
      <div className="flex items-center gap-3 mb-4 pb-3 border-b-2 border-[#007E8C]/30">
        <div className="bg-[#007E8C]/10 p-3 rounded-lg">
          <Image className="w-7 h-7 text-[#007E8C]" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900">
          Sandwich Assembly Guides
        </h2>
        <span className="text-sm font-semibold text-gray-500 ml-auto">
          3 items
        </span>
      </div>
      <p className="text-sm text-gray-600 mb-4">
        Visual guides for proper sandwich assembly. Download or share these with your volunteers.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {guides.map((guide) => (
          <div 
            key={guide.fileName}
            className="bg-white rounded-lg shadow-sm overflow-hidden hover:shadow-md transition-shadow"
          >
            <div className="aspect-[4/5] relative bg-gray-100">
              <img
                src={guide.imageUrl}
                alt={guide.title}
                className="w-full h-full object-contain p-2"
              />
            </div>
            <div className="p-4">
              <h4 className="font-medium text-sm mb-1">{guide.title}</h4>
              <p className="text-xs text-gray-500 mb-3">{guide.description}</p>
              <div className="flex gap-2">
                <button 
                  onClick={() => handleDownload(guide.imageUrl, guide.fileName)}
                  className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 text-sm border border-gray-200 rounded-md hover:bg-gray-50 transition-colors"
                >
                  <Download className="w-4 h-4" />
                  Download
                </button>
                <button 
                  onClick={() => handleShare(guide.title, guide.description, guide.imageUrl)}
                  className="flex items-center justify-center gap-1.5 px-3 py-1.5 text-sm border border-gray-200 rounded-md hover:bg-gray-50 transition-colors"
                >
                  <Share2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function Resources() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin' || user?.permissions?.includes('manage_resources');
  const { track } = useOnboardingTracker();

  const [resources, setResources] = useState<Resource[]>([]);
  const [favorites, setFavorites] = useState<Resource[]>([]);
  const [recentResources, setRecentResources] = useState<Resource[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState('smart');
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);

  // Track onboarding challenge on page load
  useEffect(() => {
    track('view_resources');
  }, []);

  // Load resources
  const loadResources = async () => {
    try {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams({
        sort: sortBy,
        ...(selectedCategory && { category: selectedCategory }),
        ...(searchTerm && { search: searchTerm }),
        ...(selectedTags.length > 0 && { tags: selectedTags.join(',') }),
      });

      console.log('Loading resources from API...');
      const [resourcesRes, favoritesRes, recentRes, tagsRes] = await Promise.all([
        fetch(`/api/resources?${params}`, { credentials: 'include' }),
        fetch('/api/resources/user/favorites', { credentials: 'include' }),
        fetch('/api/resources/user/recent?limit=5', { credentials: 'include' }),
        fetch('/api/resources/tags/all', { credentials: 'include' }),
      ]);

      // Check for critical errors
      if (!resourcesRes.ok) {
        const errorText = await resourcesRes.text();
        console.error('Resources API error:', errorText);
        throw new Error(`Failed to load resources: ${resourcesRes.status} ${errorText}`);
      }

      if (resourcesRes.ok) {
        const data = await resourcesRes.json();
        console.log('Resources loaded:', data.length);
        setResources(data);
      }

      if (favoritesRes.ok) {
        const data = await favoritesRes.json();
        setFavorites(data);
      } else {
        console.warn('Failed to load favorites');
      }

      if (recentRes.ok) {
        const data = await recentRes.json();
        setRecentResources(data);
      } else {
        console.warn('Failed to load recent resources');
      }

      if (tagsRes.ok) {
        const data = await tagsRes.json();
        setTags(data);
      } else {
        console.warn('Failed to load tags');
      }
    } catch (err) {
      console.error('Error loading resources:', err);
      setError(err instanceof Error ? err.message : 'Failed to load resources. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadResources();
  }, [sortBy, selectedCategory, searchTerm, selectedTags]);

  // Track resource access
  const trackAccess = async (resourceId: number) => {
    try {
      await fetch(`/api/resources/${resourceId}/access`, {
        method: 'POST',
        credentials: 'include',
      });
    } catch (error) {
      console.error('Error tracking access:', error);
    }
  };

  // Toggle favorite
  const toggleFavorite = async (resourceId: number) => {
    try {
      const res = await fetch(`/api/resources/${resourceId}/favorite`, {
        method: 'POST',
        credentials: 'include',
      });

      if (res.ok) {
        await loadResources();
      }
    } catch (error) {
      console.error('Error toggling favorite:', error);
    }
  };

  // Open resource
  const openResource = (resource: Resource) => {
    trackAccess(resource.resource.id);

    if (resource.resource.type === 'file' && resource.resource.documentId) {
      window.open(`/api/documents/${resource.resource.documentId}`, '_blank');
    } else if (resource.resource.url) {
      window.open(resource.resource.url, '_blank');
    }
  };

  // Copy link
  const copyLink = async (resource: Resource) => {
    let link = '';
    if (resource.resource.type === 'file' && resource.resource.documentId) {
      link = `${window.location.origin}/api/documents/${resource.resource.documentId}`;
    } else if (resource.resource.url) {
      link = resource.resource.url;
    }

    try {
      await navigator.clipboard.writeText(link);
      setCopiedId(resource.resource.id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (error) {
      console.error('Error copying link:', error);
    }
  };

  // Get category info
  const getCategoryInfo = (categoryId: string) => {
    return CATEGORIES.find((c) => c.id === categoryId) || CATEGORIES[0];
  };

  // Render resource card
  const ResourceCard = ({ item }: { item: Resource }) => {
    const category = getCategoryInfo(item.resource.category);
    const CategoryIcon = category.icon;
    const isCopied = copiedId === item.resource.id;
    const [previewError, setPreviewError] = useState(false);

    // Check if file type supports iframe preview (PDFs and images only)
    const canPreviewInIframe = () => {
      if (!item.document?.mimeType) {
        return false;
      }
      const previewableMimeTypes = [
        'application/pdf',
        'image/png',
        'image/jpg',
        'image/jpeg',
        'image/gif',
        'image/webp',
      ];
      return previewableMimeTypes.includes(item.document.mimeType);
    };

    // Get preview URL for documents (only for previewable types)
    const getPreviewUrl = () => {
      if (item.resource.type === 'file' && item.resource.documentId && canPreviewInIframe() && !previewError) {
        return `/api/documents/${item.resource.documentId}/preview`;
      }
      return null;
    };

    const previewUrl = getPreviewUrl();

    return (
      <div
        className={`border ${category.borderColor} ${category.bgColor} rounded-lg overflow-hidden hover:shadow-md transition-shadow relative flex flex-col`}
        data-testid={`resource-card-${item.resource.id}`}
      >
        {/* Pinned badge */}
        {item.resource.isPinnedGlobal && (
          <div className="absolute top-2 right-2 z-10">
            <Pin className="w-4 h-4 text-[#FBAD3F] fill-[#FBAD3F]" />
          </div>
        )}

        {/* Document Preview */}
        {previewUrl && (
          <div className="w-full h-48 bg-gray-100 relative overflow-hidden group cursor-pointer" onClick={() => openResource(item)}>
            {item.document?.mimeType === 'application/pdf' ? (
              <object
                data={`${previewUrl}#toolbar=0&navpanes=0&view=FitH`}
                type="application/pdf"
                className="w-full h-full pointer-events-none"
                aria-label={`Preview of ${item.resource.title}`}
              >
                <div className="w-full h-full flex items-center justify-center bg-gray-50">
                  <div className="text-center">
                    <FileText className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                    <span className="text-sm text-gray-500">PDF Preview</span>
                  </div>
                </div>
              </object>
            ) : (
              <img
                src={previewUrl}
                alt={`Preview of ${item.resource.title}`}
                className="w-full h-full object-cover pointer-events-none"
                onError={() => setPreviewError(true)}
              />
            )}
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center">
              <div className="opacity-0 group-hover:opacity-100 transition-opacity bg-white/90 rounded-full p-3">
                <ExternalLink className="w-6 h-6 text-[#236383]" />
              </div>
            </div>
          </div>
        )}

        {/* Fallback preview for non-previewable files */}
        {item.resource.type === 'file' && item.resource.documentId && !previewUrl && (
          <div
            className="w-full h-32 bg-gray-50 relative overflow-hidden group cursor-pointer flex items-center justify-center"
            onClick={() => openResource(item)}
          >
            <div className="text-center">
              <FileText className="w-12 h-12 text-gray-400 mx-auto mb-2" />
              <span className="text-sm text-gray-500">Click to open document</span>
            </div>
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center">
              <div className="opacity-0 group-hover:opacity-100 transition-opacity bg-white/90 rounded-full p-3">
                <ExternalLink className="w-6 h-6 text-[#236383]" />
              </div>
            </div>
          </div>
        )}

        <div className="p-4">
          {/* Header */}
          <div className="flex items-start gap-3 mb-3">
            <div className={`${category.bgColor} p-2 rounded`}>
              <CategoryIcon className={`w-5 h-5 ${category.color}`} />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-gray-900 mb-1 truncate">
                {item.resource.title}
              </h3>
              <p className="text-sm text-gray-600 line-clamp-2">
                {item.resource.description || 'No description'}
              </p>
            </div>
          </div>

        {/* Tags */}
        {item.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-3">
            {item.tags.map((tag) => (
              <span
                key={tag.id}
                className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded-full bg-gray-100 text-gray-700"
                style={
                  tag.color
                    ? { backgroundColor: `${tag.color}20`, color: tag.color }
                    : undefined
                }
              >
                <Tag className="w-3 h-3" />
                {tag.name}
              </span>
            ))}
          </div>
        )}

        {/* Metadata */}
        <div className="flex items-center gap-4 mb-3 text-xs text-gray-500">
          <span className="flex items-center gap-1">
            <TrendingUp className="w-3 h-3" />
            {item.resource.accessCount} views
          </span>
          {item.resource.lastAccessedAt && (
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {new Date(item.resource.lastAccessedAt).toLocaleDateString()}
            </span>
          )}
        </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => openResource(item)}
              className="flex-1 bg-[#236383] text-white px-3 py-2 rounded-lg text-sm font-medium hover:bg-[#007E8C] transition-colors flex items-center justify-center gap-2"
            >
              <ExternalLink className="w-4 h-4" />
              Open
            </button>

            <button
              onClick={() => copyLink(item)}
              className={`px-3 py-2 rounded-lg text-sm transition-colors ${
                isCopied
                  ? 'bg-[#007E8C]/20 text-[#007E8C]'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
              title="Copy link"
            >
              {isCopied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            </button>

            <button
              onClick={() => toggleFavorite(item.resource.id)}
              className={`px-3 py-2 rounded-lg text-sm transition-colors ${
                item.isFavorite
                  ? 'bg-[#FBAD3F]/20 text-[#FBAD3F]'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
              title={item.isFavorite ? 'Remove from favorites' : 'Add to favorites'}
            >
              <Star
                className={`w-4 h-4 ${item.isFavorite ? 'fill-[#FBAD3F]' : ''}`}
              />
            </button>
          </div>
        </div>
      </div>
    );
  };

  // Group resources by category
  const groupedResources = useMemo(() => {
    const groups: Record<string, Resource[]> = {};
    resources.forEach((resource) => {
      const cat = resource.resource.category;
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(resource);
    });
    return groups;
  }, [resources]);

  // Pinned resources
  const pinnedResources = useMemo(() => {
    return resources.filter((r) => r.resource.isPinnedGlobal);
  }, [resources]);

  // Error state
  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="bg-white rounded-lg shadow-sm p-8 max-w-md text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <X className="w-8 h-8 text-red-600" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            Failed to Load Resources
          </h3>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={() => loadResources()}
            className="bg-[#236383] text-white px-4 py-2 rounded-lg hover:bg-[#007E8C] transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  // Loading state
  if (loading && resources.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading resources...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {/* Admin Modal */}
      <ResourceAdminModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSuccess={loadResources}
        availableTags={tags}
      />

      <div className="max-w-7xl mx-auto">
        <PageBreadcrumbs segments={[
          { label: 'Documentation' },
          { label: 'Resources' }
        ]} />

        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Resources</h1>
              <p className="text-gray-600 mt-1">
                Your central hub for all important documents, links, and materials
              </p>
            </div>
            {isAdmin && (
              <button
                onClick={() => setShowAddModal(true)}
                className="bg-[#236383] text-white px-4 py-2 rounded-lg hover:bg-[#007E8C] transition-colors flex items-center gap-2"
              >
                <Plus className="w-5 h-5" />
                Add Resource
              </button>
            )}
          </div>

          {/* Search and Filters */}
          <div className="bg-white rounded-lg shadow-sm p-4" data-testid="resources-filters">
            <div className="flex flex-col lg:flex-row gap-4">
              {/* Search */}
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search resources..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  data-testid="resources-search"
                />
              </div>

              {/* Sort */}
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="smart">Smart Sort</option>
                <option value="alphabetical">Alphabetical</option>
                <option value="recent">Recently Accessed</option>
                <option value="popular">Most Popular</option>
                <option value="newest">Newest First</option>
              </select>

              {/* Filters Toggle */}
              <button
                onClick={() => setShowFilters(!showFilters)}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors flex items-center gap-2"
              >
                <Filter className="w-5 h-5" />
                Filters
                <ChevronDown
                  className={`w-4 h-4 transition-transform ${
                    showFilters ? 'rotate-180' : ''
                  }`}
                />
              </button>
            </div>

            {/* Expanded Filters */}
            {showFilters && (
              <div className="mt-4 pt-4 border-t border-gray-200">
                {/* Category Filter */}
                <div className="mb-4" data-testid="resources-categories">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Category
                  </label>
                  <div className="flex flex-wrap gap-2" data-testid="category-filter">
                    <button
                      onClick={() => setSelectedCategory(null)}
                      className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                        selectedCategory === null
                          ? 'bg-[#236383] text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      All
                    </button>
                    {CATEGORIES.map((cat) => {
                      const Icon = cat.icon;
                      return (
                        <button
                          key={cat.id}
                          onClick={() => setSelectedCategory(cat.id)}
                          className={`px-3 py-1.5 rounded-lg text-sm transition-colors flex items-center gap-1.5 ${
                            selectedCategory === cat.id
                              ? `${cat.bgColor} ${cat.color} border ${cat.borderColor}`
                              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                          }`}
                        >
                          <Icon className="w-4 h-4" />
                          {cat.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Tag Filter */}
                {tags.length > 0 && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Tags
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {tags.map((tag) => {
                        const isSelected = selectedTags.includes(tag.tag.name);
                        return (
                          <button
                            key={tag.tag.id}
                            onClick={() => {
                              if (isSelected) {
                                setSelectedTags(
                                  selectedTags.filter((t) => t !== tag.tag.name)
                                );
                              } else {
                                setSelectedTags([...selectedTags, tag.tag.name]);
                              }
                            }}
                            className={`px-3 py-1.5 rounded-full text-sm transition-colors flex items-center gap-1.5 ${
                              isSelected
                                ? 'bg-[#236383] text-white'
                                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                            }`}
                            style={
                              tag.tag.color && !isSelected
                                ? {
                                    backgroundColor: `${tag.tag.color}20`,
                                    color: tag.tag.color,
                                  }
                                : undefined
                            }
                          >
                            <Tag className="w-3 h-3" />
                            {tag.tag.name} ({tag.usageCount})
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Quick Access Sections */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          {/* Pinned Resources */}
          {pinnedResources.length > 0 && (
            <div className="bg-white rounded-lg shadow-sm p-4" data-testid="pinned-resources">
              <div className="flex items-center gap-2 mb-3">
                <Pin className="w-5 h-5 text-[#FBAD3F]" />
                <h2 className="font-semibold text-gray-900">Pinned</h2>
              </div>
              <div className="space-y-2">
                {pinnedResources.slice(0, 3).map((resource) => (
                  <button
                    key={resource.resource.id}
                    onClick={() => openResource(resource)}
                    className="w-full text-left p-2 rounded hover:bg-gray-50 transition-colors"
                  >
                    <p className="font-medium text-sm text-gray-900 truncate">
                      {resource.resource.title}
                    </p>
                    <p className="text-xs text-gray-500 truncate">
                      {resource.resource.accessCount} views
                    </p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Favorites */}
          {favorites.length > 0 && (
            <div className="bg-white rounded-lg shadow-sm p-4">
              <div className="flex items-center gap-2 mb-3">
                <Star className="w-5 h-5 text-[#FBAD3F] fill-[#FBAD3F]" />
                <h2 className="font-semibold text-gray-900">Your Favorites</h2>
              </div>
              <div className="space-y-2">
                {favorites.slice(0, 3).map((fav) => (
                  <button
                    key={fav.resource.id}
                    onClick={() => openResource(fav)}
                    className="w-full text-left p-2 rounded hover:bg-gray-50 transition-colors"
                  >
                    <p className="font-medium text-sm text-gray-900 truncate">
                      {fav.resource.title}
                    </p>
                    <p className="text-xs text-gray-500 truncate">
                      {fav.resource.accessCount} views
                    </p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Recently Accessed */}
          {recentResources.length > 0 && (
            <div className="bg-white rounded-lg shadow-sm p-4">
              <div className="flex items-center gap-2 mb-3">
                <Clock className="w-5 h-5 text-[#47B3CB]" />
                <h2 className="font-semibold text-gray-900">Recently Accessed</h2>
              </div>
              <div className="space-y-2">
                {recentResources.slice(0, 3).map((recent) => (
                  <button
                    key={recent.resource.id}
                    onClick={() => openResource(recent)}
                    className="w-full text-left p-2 rounded hover:bg-gray-50 transition-colors"
                  >
                    <p className="font-medium text-sm text-gray-900 truncate">
                      {recent.resource.title}
                    </p>
                    <p className="text-xs text-gray-500 truncate">
                      {recent.lastAccessed &&
                        new Date(recent.lastAccessed).toLocaleDateString()}
                    </p>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Sandwich Assembly Guides */}
        <SandwichAssemblyGuides />

        {/* All Resources */}
        {resources.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm p-8 text-center">
            <Folder className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              No resources found
            </h3>
            <p className="text-gray-600">
              {searchTerm || selectedCategory || selectedTags.length > 0
                ? 'Try adjusting your filters'
                : isAdmin
                ? 'Get started by adding your first resource'
                : 'Resources will appear here once they are added'}
            </p>
          </div>
        ) : (
          <div className="space-y-6" data-testid="resources-list">
            {CATEGORIES.map((category) => {
              const categoryResources = groupedResources[category.id] || [];
              if (categoryResources.length === 0) return null;

              const CategoryIcon = category.icon;

              // Separate labels from other resources for special layout
              const labelResources = categoryResources.filter(r => 
                r.resource.title.includes('Labels')
              );
              const otherResources = categoryResources.filter(r => 
                !r.resource.title.includes('Labels')
              );

              return (
                <div key={category.id}>
                  <div className={`flex items-center gap-3 mb-4 pb-3 border-b-2 ${category.borderColor}`}>
                    <div className={`${category.bgColor} p-3 rounded-lg`}>
                      <CategoryIcon className={`w-7 h-7 ${category.color}`} />
                    </div>
                    <h2 className="text-2xl font-bold text-gray-900">
                      {category.label}
                    </h2>
                    <span className="text-sm font-semibold text-gray-500 ml-auto">
                      {categoryResources.length} {categoryResources.length === 1 ? 'item' : 'items'}
                    </span>
                  </div>

                  {/* Labels displayed side-by-side */}
                  {labelResources.length > 0 && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                      {labelResources.map((resource) => (
                        <ResourceCard key={resource.resource.id} item={resource} />
                      ))}
                    </div>
                  )}

                  {/* Other resources in standard grid */}
                  {otherResources.length > 0 && (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
                      {otherResources.map((resource) => (
                        <ResourceCard key={resource.resource.id} item={resource} />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* AI Assistant */}
      <FloatingAIChat
        contextType="resources"
        title="Resources Assistant"
        subtitle="Ask about documents and links"
        contextData={{
          currentView: 'resources',
          filters: {
            searchTerm: searchTerm || undefined,
            selectedCategory,
            selectedTags,
            sortBy,
          },
          summaryStats: {
            totalResources: resources.length,
            favoriteCount: favorites.length,
            recentCount: recentResources.length,
          },
        }}
        getFullContext={() => ({
          rawData: resources.map(r => ({
            id: r.resource.id,
            title: r.resource.title,
            description: r.resource.description,
            type: r.resource.type,
            category: r.resource.category,
            url: r.resource.url,
            accessCount: r.resource.accessCount,
            isFavorite: r.isFavorite,
            tags: r.tags.map(t => t.name),
          })),
        })}
        suggestedQuestions={[
          "What resources are available?",
          "How many resources do we have?",
          "Show me training materials",
          "What are the most accessed resources?",
          "Show resources by category",
          "What templates are available?",
        ]}
      />
    </div>
  );
}
