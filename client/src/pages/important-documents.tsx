import { useState, useEffect } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  FileText,
  Download,
  Eye,
  ExternalLink,
  FileImage,
  Palette,
  ImageIcon,
  Share2,
  Copy,
  Lock,
} from 'lucide-react';
import { DocumentPreview } from '@/components/document-preview';
import { ConfidentialDocuments } from '@/components/confidential-documents';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { useOnboardingTracker } from '@/hooks/useOnboardingTracker';
import { useActivityTracker } from '@/hooks/useActivityTracker';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { PERMISSIONS } from '@shared/auth-utils';
import { logger } from '@/lib/logger';

export interface AdminDocument {
  id: string;
  name: string;
  description: string;
  category: string;
  path: string;
  type: 'pdf' | 'docx' | 'xlsx' | 'link' | 'image';
  size?: string;
  lastModified?: string;
  importance: 'critical' | 'high' | 'normal';
}

export const adminDocuments: AdminDocument[] = [
  // Legal & Tax Documents
  {
    id: 'tax-exempt-letter',
    name: 'IRS Tax Exempt Letter',
    description: 'IRS Tax Exempt determination letter containing EIN',
    category: 'Legal & Tax',
    path: '/attached_assets/IRS Tax Exempt Letter (Contains EIN).pdf',
    type: 'pdf',
    importance: 'critical',
  },
  {
    id: 'articles-incorporation',
    name: 'Articles of Incorporation',
    description: 'Official Articles of Incorporation for The Sandwich Project',
    category: 'Legal & Tax',
    path: '/attached_assets/Articles of Incorporation.pdf',
    type: 'pdf',
    importance: 'critical',
  },
  {
    id: 'georgia-code',
    name: '2020 Georgia Code Title 51',
    description: 'Georgia state legal code reference for nonprofit operations',
    category: 'Legal & Tax',
    path: '/attached_assets/2020 Georgia Code Title 51.pdf',
    type: 'pdf',
    importance: 'high',
  },
  
  // Governance Documents
  {
    id: 'bylaws-2024',
    name: 'The Sandwich Project Bylaws 2024',
    description: 'Official bylaws document outlining organizational structure, governance, and operational procedures',
    category: 'Governance',
    path: '/attached_assets/The Sandwich Project Bylaws 2024(1)_1750871081277.pdf',
    type: 'pdf',
    importance: 'critical',
  },
  
  // Forms
  {
    id: 'volunteer-driver-agreement',
    name: 'TSP Volunteer Driver Agreement',
    description: 'Required agreement form for volunteer drivers',
    category: 'Forms',
    path: '/attached_assets/TSP Volunteer Driver Agreement (1).pdf',
    type: 'pdf',
    importance: 'critical',
  },
  {
    id: 'community-service-hours',
    name: 'TSP Community Service Hours',
    description: 'Form for tracking and documenting community service hours',
    category: 'Forms',
    path: '/attached_assets/TSP COMMUNITY SERVICE HOURS (1) (1) (1).pdf',
    type: 'pdf',
    importance: 'high',
  },
  {
    id: 'sandwich-signin-form',
    name: 'Sandwich Sign-In Form',
    description: 'Simple sign-in form for tracking sandwich collection participants without requiring email addresses',
    category: 'Forms',
    path: '/attached_assets/Sandwich Project - Sign In Sheet correct qrs.pdf',
    type: 'pdf',
    importance: 'high',
  },
  
  // Safety Guidelines
  {
    id: 'summer-food-safety',
    name: 'Summer Food Safety Guidelines',
    description: 'Updated guidelines for no cooler collections, proper refrigeration temperatures (33-36°F), and summer heat safety protocols for home hosts',
    category: 'Safety Guidelines',
    path: '/attached_assets/Summer Food Safety Guidelines_1751569876472.pdf',
    type: 'pdf',
    importance: 'critical',
  },
  {
    id: 'food-safety-volunteers',
    name: 'Food Safety Volunteers Guide',
    description: 'Comprehensive safety protocols for volunteers preparing and delivering sandwiches',
    category: 'Tools',
    path: '/attached_assets/20230525-TSP-Food Safety Volunteers_1749341933308.pdf',
    type: 'pdf',
    importance: 'critical',
  },
  {
    id: 'food-safety-hosts',
    name: 'Food Safety Hosts Guide',
    description: 'Safety standards and procedures for hosts collecting and storing sandwiches',
    category: 'Safety Guidelines',
    path: '/attached_assets/20230525-TSP-Food Safety Hosts (1)_1753670644140.pdf',
    type: 'pdf',
    importance: 'critical',
  },
  {
    id: 'food-safety-recipients',
    name: 'Food Safety Recipients Guide',
    description: 'Safety standards for recipient organizations handling perishable food donations',
    category: 'Safety Guidelines',
    path: '/attached_assets/20250205-TSP-Food Safety Recipients_1753670644140.pdf',
    type: 'pdf',
    importance: 'critical',
  },
  {
    id: 'food-safety-recipients-alt',
    name: 'Food Safety Recipients (Alternate)',
    description: 'Additional safety guidelines for 501(c)(3) recipient organizations',
    category: 'Safety Guidelines',
    path: '/attached_assets/Copy of Copy of Food Safety TSP.RECIPIENTS.04042023_1753670644141.pdf',
    type: 'pdf',
    importance: 'high',
  },
  
  // Labels & Printing
  {
    id: 'deli-labels',
    name: 'Deli Labels',
    description: 'Official TSP labels for deli sandwich identification and tracking',
    category: 'Labels & Printing',
    path: '/attached_assets/Deli Labels_1756865384146.pdf',
    type: 'pdf',
    importance: 'high',
  },
  {
    id: 'pbj-labels',
    name: 'PBJ Labels',
    description: 'Labels and guidelines for peanut butter and jelly sandwiches',
    category: 'Labels & Printing',
    path: '/attached_assets/PBJ Labels_1756865384146.pdf',
    type: 'pdf',
    importance: 'high',
  },
  
  // Sandwich Making Guides
  {
    id: 'deli-sandwich-guide',
    name: 'Deli Sandwich Making 101',
    description: 'Complete guide to preparing deli sandwiches according to TSP standards',
    category: 'Sandwich Making',
    path: '/attached_assets/20240622-TSP-Deli Sandwich Making 101_1749341916236.pdf',
    type: 'pdf',
    importance: 'high',
  },
  {
    id: 'pbj-sandwich-guide',
    name: 'PBJ Sandwich Making 101',
    description: 'Step-by-step instructions for making peanut butter and jelly sandwiches',
    category: 'Sandwich Making',
    path: '/attached_assets/20250622-TSP-PBJ Sandwich Making 101_1749341916236.pdf',
    type: 'pdf',
    importance: 'high',
  },
  
  // Tools
  {
    id: 'inventory-calculator',
    name: 'Inventory Calculator',
    description: 'Interactive tool for calculating sandwich inventory and planning quantities for collections',
    category: 'Tools',
    path: 'https://nicunursekatie.github.io/sandwichinventory/inventorycalculator.html',
    type: 'link',
    importance: 'high',
  },
  
  // Reference Lists
  {
    id: 'master-congregations-list',
    name: 'Master Congregations List',
    description: 'Comprehensive final confirmed list of all congregations including churches, synagogues, and religious organizations',
    category: 'Reference Lists',
    path: '/attached_assets/Master_Congregations_List_Final_1759034641771.pdf',
    type: 'pdf',
    importance: 'high',
  },
  {
    id: 'tsp-company-partners',
    name: 'TSP Company Partners List',
    description: 'Complete directory of corporate partners, businesses, and company organizations working with The Sandwich Project',
    category: 'Reference Lists',
    path: '/attached_assets/TSP Company List _1759034641773.pdf',
    type: 'pdf',
    importance: 'high',
  },
  {
    id: 'unified-schools-list',
    name: 'Unified Schools List',
    description: 'Comprehensive list of educational institutions including elementary, middle, high schools, and universities',
    category: 'Reference Lists',
    path: '/attached_assets/Unified_Schools_List_1759034641773.pdf',
    type: 'pdf',
    importance: 'high',
  },
  {
    id: 'uploaded-document-oct-22',
    name: 'Important Document',
    description: 'Recently uploaded reference document',
    category: 'Legal & Tax',
    path: '/attached_assets/900F2271-08DB-4E61-8E25-03D21F987178_1761090885143.jpeg',
    type: 'image',
    importance: 'high',
  },
];

const categories = ['All', 'Legal & Tax', 'Governance', 'Forms', 'Safety Guidelines', 'Labels & Printing', 'Sandwich Making', 'Reference Lists', 'Toolkit'];

// Logo files information
const logoFiles = [
  {
    id: 1,
    name: 'CMYK Print Logo',
    filename: 'CMYK_PRINT_TSP-01-01.jpg',
    description: 'High-quality CMYK version for professional printing',
    type: 'JPEG',
    usage: 'Print materials, brochures, professional documents',
    bgColor: 'white',
    icon: <Palette className="h-5 w-5" />,
  },
  {
    id: 2,
    name: 'Main Transparent Logo',
    filename: 'TSP_transparent.png',
    description: 'Primary logo with transparent background',
    type: 'PNG',
    usage: 'Web, presentations, overlays on any background',
    bgColor: '#f8f9fa',
    icon: <ImageIcon className="h-5 w-5" />,
  },
  {
    id: 3,
    name: 'Reverse Transparent Logo',
    filename: 'TSP_reverse_transparent.png',
    description: 'Inverted colors for dark backgrounds',
    type: 'PNG',
    usage: 'Dark backgrounds, night mode interfaces',
    bgColor: '#2d3748',
    icon: <Eye className="h-5 w-5" />,
  },
  {
    id: 4,
    name: 'Sandwich Logo',
    filename: 'sandwich logo.png',
    description: 'Simple sandwich icon logo',
    type: 'PNG',
    usage: 'Icons, favicons, small applications',
    bgColor: 'white',
    icon: <FileImage className="h-5 w-5" />,
  },
  {
    id: 5,
    name: 'Transparent Logo (Copy)',
    filename: 'Copy of TSP_transparent.png',
    description: 'Backup copy of transparent logo',
    type: 'PNG',
    usage: 'Backup version for web and digital use',
    bgColor: '#f8f9fa',
    icon: <ImageIcon className="h-5 w-5" />,
  },
];

export default function ImportantDocuments() {
  const [selectedCategory, setSelectedCategory] = useState('All');
  const { toast } = useToast();
  const { user, isLoading: isAuthLoading } = useAuth();
  const { track } = useOnboardingTracker();
  const { trackView, trackClick } = useActivityTracker();
  const [previewDocument, setPreviewDocument] = useState<AdminDocument | null>(
    null
  );

  // Track page view for activity tracking
  useEffect(() => {
    trackView(
      'Documents',
      'Documents',
      'Important Documents',
      'User accessed important documents page'
    );
  }, [trackView]);

  // Track page visit for onboarding challenge
  useEffect(() => {
    track('view_important_documents');
  }, []);

  // Show confidential tab only to admin users
  const hasConfidentialAccess = !!user && !isAuthLoading &&
    (user.email === 'admin@sandwich.project' || user.email === 'katielong2316@gmail.com');

  const filteredDocuments = adminDocuments.filter(
    (doc) => {
      if (selectedCategory === 'All') return true;
      // Map "Toolkit" filter to "Tools" category for backward compatibility
      const categoryToMatch = selectedCategory === 'Toolkit' ? 'Tools' : selectedCategory;
      return doc.category === categoryToMatch;
    }
  );

  const handleDownload = async (doc: AdminDocument) => {
    if (doc.type === 'link') {
      window.open(doc.path, '_blank');
    } else {
      try {
        const response = await fetch(doc.path);
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = doc.name;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
      } catch (error) {
        logger.error('Download failed:', error);
        window.open(doc.path, '_blank');
      }
    }
  };

  const handlePreview = (doc: AdminDocument) => {
    if (doc.type === 'link') {
      window.open(doc.path, '_blank');
    } else {
      setPreviewDocument(doc);
    }
  };

  const handleShare = async (doc: AdminDocument) => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: doc.name,
          text: doc.description,
          url: doc.path,
        });
        toast({
          title: 'Shared Successfully',
          description: `${doc.name} has been shared.`,
        });
      } catch (error: any) {
        if (error.name !== 'AbortError') {
          await navigator.clipboard.writeText(doc.path);
          toast({
            title: 'Link Copied',
            description: 'Link has been copied to clipboard instead.',
          });
        }
      }
    } else {
      await navigator.clipboard.writeText(doc.path);
      toast({
        title: 'Link Copied',
        description: 'Link has been copied to clipboard.',
      });
    }
  };

  const handleLogoDownload = async (filename: string, displayName: string) => {
    try {
      const response = await fetch(`/attached_assets/LOGOS/${filename}`);
      if (!response.ok) throw new Error('Logo not found');

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast({
        title: 'Download Complete',
        description: `${displayName} has been downloaded successfully.`,
      });
    } catch (error) {
      logger.error('Download failed:', error);
      toast({
        title: 'Download Failed',
        description: 'Failed to download logo. Please try again.',
        variant: 'destructive',
      });
    }
  };

  const handleLogoShare = async (filename: string, displayName: string) => {
    const logoUrl = `${window.location.origin}/attached_assets/LOGOS/${filename}`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: `The Sandwich Project - ${displayName}`,
          text: `Check out this logo from The Sandwich Project`,
          url: logoUrl,
        });
        toast({
          title: 'Shared Successfully',
          description: `${displayName} has been shared.`,
        });
      } catch (error: any) {
        if (error.name !== 'AbortError') {
          logger.error('Share failed:', error);
          toast({
            title: 'Share Failed',
            description:
              'Failed to share logo. The link has been copied instead.',
            variant: 'destructive',
          });
          await navigator.clipboard.writeText(logoUrl);
        }
      }
    } else {
      await navigator.clipboard.writeText(logoUrl);
      toast({
        title: 'Link Copied',
        description: `Link to ${displayName} has been copied to clipboard.`,
      });
    }
  };

  const handleLogoCopy = async (filename: string, displayName: string) => {
    try {
      const response = await fetch(`/attached_assets/LOGOS/${filename}`);
      if (!response.ok) throw new Error('Logo not found');

      const blob = await response.blob();
      const item = new ClipboardItem({ [blob.type]: blob });
      await navigator.clipboard.write([item]);

      toast({
        title: 'Image Copied',
        description: `${displayName} has been copied to clipboard.`,
      });
    } catch (error) {
      logger.error('Copy failed:', error);
      // Fallback to copying the URL
      const logoUrl = `${window.location.origin}/attached_assets/LOGOS/${filename}`;
      await navigator.clipboard.writeText(logoUrl);
      toast({
        title: 'Link Copied',
        description: `Link to ${displayName} has been copied to clipboard instead.`,
      });
    }
  };

  const getImportanceBadge = (importance: string) => {
    switch (importance) {
      case 'critical':
        return (
          <Badge
            variant="secondary"
            className="text-xs bg-brand-primary-light text-brand-primary-dark"
          >
            Important
          </Badge>
        );
      case 'high':
        return (
          <Badge variant="outline" className="text-xs">
            Reference
          </Badge>
        );
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-white p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-16">
          <div className="flex items-center gap-4 mb-6">
            <div className="p-3 bg-gradient-to-br from-brand-primary to-brand-primary-dark rounded-xl shadow-[0_4px_12px_rgba(35,99,131,0.15),0_2px_4px_rgba(35,99,131,0.1)] hover:shadow-[0_8px_24px_rgba(35,99,131,0.2),0_4px_8px_rgba(35,99,131,0.15)] transition-all duration-300 ease-in-out">
              <FileText className="h-8 w-8 text-white" />
            </div>
            <div>
              <h1 className="text-4xl font-bold text-gray-900 mb-2">
                Important Documents & Logos
              </h1>
              <p className="text-lg text-gray-600">
                Key documents, forms, and official logos for The Sandwich
                Project
              </p>
              <div className="mt-3 bg-teal-50 border border-teal-200 rounded-lg px-3 py-2 inline-block">
                <div className="text-xs text-teal-700 font-medium uppercase tracking-wide">
                  Organization EIN
                </div>
                <div className="text-lg font-bold text-teal-900 font-mono">
                  87-0939484
                </div>
              </div>
            </div>
          </div>
        </div>

        <Tabs defaultValue="documents" className="w-full">
          <TabsList className={`grid w-full ${hasConfidentialAccess ? 'grid-cols-3' : 'grid-cols-2'} h-auto p-1 mb-8 border-0 shadow-[0_2px_8px_rgba(0,0,0,0.08)] rounded-lg bg-white`}>
            <TabsTrigger
              value="documents"
              className="flex items-center gap-2 py-4 px-6 rounded-lg font-medium text-brand-primary hover:bg-brand-primary/5 transition-all duration-200 ease-in-out data-[state=active]:bg-gradient-to-r data-[state=active]:from-brand-primary data-[state=active]:to-brand-primary-dark data-[state=active]:text-white data-[state=active]:shadow-[0_2px_8px_rgba(35,99,131,0.25)]"
            >
              <FileText className="h-4 w-4" />
              Documents
            </TabsTrigger>
            <TabsTrigger
              value="logos"
              className="flex items-center gap-2 py-4 px-6 rounded-lg font-medium text-brand-primary hover:bg-brand-primary/5 transition-all duration-200 ease-in-out data-[state=active]:bg-gradient-to-r data-[state=active]:from-brand-primary data-[state=active]:to-brand-primary-dark data-[state=active]:text-white data-[state=active]:shadow-[0_2px_8px_rgba(35,99,131,0.25)]"
              data-tour="logos-tab"
              data-testid="tab-logos"
            >
              <FileImage className="h-4 w-4" />
              Logos & Branding
            </TabsTrigger>
            {hasConfidentialAccess && (
              <TabsTrigger
                value="confidential"
                className="flex items-center gap-2 py-4 px-6 rounded-lg font-medium text-brand-primary hover:bg-brand-primary/5 transition-all duration-200 ease-in-out data-[state=active]:bg-gradient-to-r data-[state=active]:from-brand-primary data-[state=active]:to-brand-primary-dark data-[state=active]:text-white data-[state=active]:shadow-[0_2px_8px_rgba(35,99,131,0.25)]"
                data-testid="tab-confidential"
              >
                <Lock className="h-4 w-4" />
                Confidential
              </TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="documents" className="space-y-6">
            {/* Category Filter */}
            <div className="mb-12">
              <h3 className="text-sm font-semibold text-gray-700 mb-4 uppercase tracking-wide">
                Filter by Category
              </h3>
              <div className="flex flex-wrap gap-4">
                {categories.map((category) => (
                  <Button
                    key={category}
                    variant={
                      selectedCategory === category ? 'default' : 'outline'
                    }
                    onClick={() => setSelectedCategory(category)}
                    className={
                      selectedCategory === category
                        ? 'px-6 py-3 text-sm font-medium bg-gradient-to-r from-brand-primary to-brand-primary-dark text-white border-0 shadow-[0_4px_12px_rgba(35,99,131,0.25),0_2px_4px_rgba(35,99,131,0.1)] transform hover:scale-[1.02] hover:shadow-[0_6px_20px_rgba(35,99,131,0.3),0_4px_8px_rgba(35,99,131,0.15)] transition-all duration-200 ease-in-out rounded-lg'
                        : 'px-6 py-3 text-sm font-medium border-2 border-brand-primary text-brand-primary hover:bg-brand-primary hover:text-white bg-white shadow-[0_2px_8px_rgba(0,0,0,0.08)] transform hover:scale-[1.02] hover:shadow-[0_4px_12px_rgba(35,99,131,0.15)] transition-all duration-200 ease-in-out rounded-lg'
                    }
                    data-tour={`category-${category.toLowerCase().replace(/\s+/g, '-')}`}
                    data-testid={`category-${category.toLowerCase().replace(/\s+/g, '-')}`}
                  >
                    {category}
                  </Button>
                ))}
              </div>
            </div>

            {/* Documents Grid - Professional design */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8 mb-16" data-testid="file-list">
              {filteredDocuments.map((doc) => (
                <Card
                  key={doc.id}
                  data-testid={`document-${doc.id}`}
                  className="group transition-all duration-300 ease-in-out h-full flex flex-col bg-white border-0 shadow-[0_4px_12px_rgba(0,0,0,0.08),0_2px_4px_rgba(0,0,0,0.04),0_8px_24px_rgba(35,99,131,0.04)] hover:shadow-[0_12px_32px_rgba(0,0,0,0.12),0_4px_8px_rgba(0,0,0,0.08),0_16px_48px_rgba(35,99,131,0.08)] hover:-translate-y-2 rounded-lg overflow-hidden"
                >
                  <CardHeader className="pb-6 flex-shrink-0 bg-gradient-to-r from-gray-50 to-white">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-start space-x-4 min-w-0 flex-1">
                        <div className="flex-shrink-0 p-3 bg-gradient-to-br from-brand-primary/10 to-brand-primary/5 rounded-xl shadow-inner">
                          <FileText className="h-5 w-5 text-brand-primary" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <CardTitle className="text-lg font-bold text-gray-900 leading-tight group-hover:text-brand-primary transition-colors break-words">
                            {doc.name}
                          </CardTitle>
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                      <Badge className="text-xs font-semibold px-3 py-1 bg-gradient-to-r from-purple-100 to-purple-50 text-purple-800 rounded-full shadow-sm">
                        {doc.category}
                      </Badge>
                      <Badge
                        variant="outline"
                        className="text-xs font-semibold px-3 py-1 border border-brand-primary text-brand-primary rounded-full bg-white shadow-sm"
                      >
                        {doc.type.toUpperCase()}
                      </Badge>
                      {getImportanceBadge(doc.importance)}
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0 flex-1 flex flex-col px-6 pb-6">
                    <CardDescription className="mb-6 flex-1 text-base leading-relaxed text-gray-600 line-clamp-3">
                      {doc.description}
                    </CardDescription>
                    {/* Action buttons - Better mobile responsive design */}
                    <div className="flex flex-col gap-3 mt-auto">
                      {doc.type === 'link' ? (
                        <>
                          <Button
                            variant="default"
                            onClick={() => handleDownload(doc)}
                            className="w-full h-11 text-sm font-medium bg-brand-primary hover:bg-brand-primary-dark text-white transition-all duration-200 ease-in-out rounded-lg py-3 px-4 shadow-sm hover:shadow-md"
                          >
                            <ExternalLink className="h-4 w-4 mr-2 flex-shrink-0" />
                            <span>Open Tool</span>
                          </Button>
                          <Button
                            variant="ghost"
                            onClick={() => handleShare(doc)}
                            className="w-full h-11 text-sm font-medium text-brand-primary hover:bg-brand-primary/10 hover:text-brand-primary transition-all duration-200 ease-in-out rounded-lg py-3 px-4"
                          >
                            <Share2 className="h-4 w-4 mr-2 flex-shrink-0" />
                            <span>Share Link</span>
                          </Button>
                        </>
                      ) : (
                        <>
                          <Button
                            variant="ghost"
                            onClick={() => handlePreview(doc)}
                            className="w-full h-11 text-sm font-medium text-brand-primary hover:bg-brand-primary/10 hover:text-brand-primary transition-all duration-200 ease-in-out rounded-lg py-3 px-4"
                          >
                            <Eye className="h-4 w-4 mr-2 flex-shrink-0" />
                            <span>Preview</span>
                          </Button>
                          <Button
                            variant="default"
                            onClick={() => handleDownload(doc)}
                            className="w-full h-11 text-sm font-medium bg-brand-primary hover:bg-brand-primary-dark text-white transition-all duration-200 ease-in-out rounded-lg py-3 px-4 shadow-sm hover:shadow-md"
                          >
                            <Download className="h-4 w-4 mr-2 flex-shrink-0" />
                            <span>Download</span>
                          </Button>
                          <Button
                            variant="ghost"
                            onClick={() => handleShare(doc)}
                            className="w-full h-11 text-sm font-medium text-brand-primary hover:bg-brand-primary/10 hover:text-brand-primary transition-all duration-200 ease-in-out rounded-lg py-3 px-4"
                          >
                            <Share2 className="h-4 w-4 mr-2 flex-shrink-0" />
                            <span>Share Document</span>
                          </Button>
                        </>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="logos" className="space-y-8">
            {/* Logo Grid - Professional design */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
              {logoFiles.map((logo) => (
                <Card
                  key={logo.id}
                  className="group transition-all duration-300 ease-in-out h-full flex flex-col bg-white border-0 shadow-[0_4px_12px_rgba(0,0,0,0.08),0_2px_4px_rgba(0,0,0,0.04),0_8px_24px_rgba(35,99,131,0.04)] hover:shadow-[0_12px_32px_rgba(0,0,0,0.12),0_4px_8px_rgba(0,0,0,0.08),0_16px_48px_rgba(35,99,131,0.08)] hover:-translate-y-2 rounded-lg overflow-hidden"
                >
                  <CardHeader className="pb-8 bg-gradient-to-r from-gray-50 to-white">
                    <div className="flex items-center justify-between mb-3">
                      <CardTitle className="text-brand-primary text-xl font-bold flex items-center gap-4 group-hover:text-brand-primary-dark transition-colors duration-200">
                        <div className="p-2 bg-gradient-to-br from-brand-primary/10 to-brand-primary/5 rounded-lg shadow-inner">
                          {logo.icon}
                        </div>
                        {logo.name}
                      </CardTitle>
                    </div>
                    <Badge
                      variant="secondary"
                      className="w-fit px-4 py-2 bg-gradient-to-r from-purple-100 to-purple-50 text-purple-800 rounded-full font-medium shadow-sm"
                    >
                      {logo.type}
                    </Badge>
                  </CardHeader>
                  <CardContent className="space-y-8 p-8">
                    {/* Logo Preview */}
                    <div
                      className="w-full h-40 rounded-lg border-0 shadow-[inset_0_2px_4px_rgba(0,0,0,0.06)] flex items-center justify-center overflow-hidden group-hover:shadow-[inset_0_4px_8px_rgba(0,0,0,0.08)] transition-all duration-300 ease-in-out"
                      style={{ backgroundColor: logo.bgColor }}
                    >
                      <img
                        src={`/attached_assets/LOGOS/${logo.filename}`}
                        alt={logo.name}
                        className="max-w-full max-h-full object-contain p-4 group-hover:scale-105 transition-transform duration-300 ease-in-out"
                        onError={(e) => {
                          e.currentTarget.src =
                            'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjQiIGhlaWdodD0iNjQiIHZpZXdCb3g9IjAgMCA2NCA2NCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjY0IiBoZWlnaHQ9IjY0IiBmaWxsPSIjZjNmNGY2Ii8+CjxwYXRoIGQ9Ik0yMCAyMEg0NFY0NEgyMFYyMFoiIGZpbGw9IiNkMWQ1ZGIiLz4KPC9zdmc+';
                        }}
                      />
                    </div>

                    <div className="space-y-4">
                      <p className="text-base text-gray-700 leading-relaxed font-medium">
                        {logo.description}
                      </p>
                      <div className="bg-brand-primary/5 p-4 rounded-lg">
                        <p className="text-sm text-brand-primary font-semibold">
                          Best for: {logo.usage}
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-3 pt-4">
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button
                            variant="ghost"
                            className="w-full h-10 text-sm font-medium text-brand-primary hover:bg-brand-primary/10 hover:text-brand-primary transition-all duration-200 ease-in-out rounded-lg py-2.5 px-4"
                          >
                            <Eye className="h-4 w-4 mr-2 flex-shrink-0" />
                            <span>Preview</span>
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-2xl">
                          <DialogHeader>
                            <DialogTitle className="text-brand-primary">
                              {logo.name}
                            </DialogTitle>
                          </DialogHeader>
                          <div className="space-y-4">
                            <div
                              className="w-full h-64 rounded-lg border border-gray-200 flex items-center justify-center"
                              style={{ backgroundColor: logo.bgColor }}
                            >
                              <img
                                src={`/attached_assets/LOGOS/${logo.filename}`}
                                alt={logo.name}
                                className="max-w-full max-h-full object-contain p-4"
                              />
                            </div>
                            <div className="grid grid-cols-2 gap-4 text-sm">
                              <div>
                                <strong className="text-brand-primary">
                                  File Type:
                                </strong>{' '}
                                {logo.type}
                              </div>
                              <div>
                                <strong className="text-brand-primary">
                                  Filename:
                                </strong>{' '}
                                {logo.filename}
                              </div>
                              <div className="col-span-2">
                                <strong className="text-brand-primary">
                                  Usage:
                                </strong>{' '}
                                {logo.usage}
                              </div>
                            </div>
                            <Button
                              onClick={() =>
                                handleLogoDownload(logo.filename, logo.name)
                              }
                              className="w-full bg-brand-primary hover:bg-brand-primary-dark"
                            >
                              <Download className="h-4 w-4 mr-2" />
                              Download {logo.name}
                            </Button>
                          </div>
                        </DialogContent>
                      </Dialog>

                      <Button
                        onClick={() =>
                          handleLogoDownload(logo.filename, logo.name)
                        }
                        className="w-full h-10 text-sm font-medium bg-brand-primary hover:bg-brand-primary-dark text-white transition-all duration-200 ease-in-out rounded-lg py-2.5 px-4 shadow-sm hover:shadow-md"
                      >
                        <Download className="h-4 w-4 mr-2 flex-shrink-0" />
                        <span>Download</span>
                      </Button>

                      <Button
                        onClick={() =>
                          handleLogoShare(logo.filename, logo.name)
                        }
                        variant="outline"
                        className="w-full h-10 text-sm font-medium border border-brand-orange text-brand-orange hover:bg-brand-orange hover:text-white transition-all duration-200 ease-in-out rounded-lg py-2.5 px-4 shadow-sm hover:shadow-md"
                      >
                        <Share2 className="h-4 w-4 mr-2 flex-shrink-0" />
                        <span>Share</span>
                      </Button>

                      <Button
                        onClick={() => handleLogoCopy(logo.filename, logo.name)}
                        variant="outline"
                        className="w-full h-10 text-sm font-medium border border-gray-400 text-gray-600 hover:bg-gray-100 hover:text-gray-800 transition-all duration-200 ease-in-out rounded-lg py-2.5 px-4 shadow-sm hover:shadow-md"
                      >
                        <Copy className="h-4 w-4 mr-2 flex-shrink-0" />
                        <span>Copy</span>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          {hasConfidentialAccess && (
            <TabsContent value="confidential" className="space-y-8">
              <ConfidentialDocuments />
            </TabsContent>
          )}
        </Tabs>

        {/* Document Preview Modal */}
        {previewDocument && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-6 z-50">
            <div className="bg-white rounded-lg shadow-[0_20px_60px_rgba(0,0,0,0.15),0_8px_24px_rgba(0,0,0,0.1)] max-w-4xl w-full max-h-[90vh] overflow-hidden">
              <div className="p-4 border-b border-gray-200 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <FileText className="h-5 w-5 text-brand-primary" />
                  <div>
                    <h3 className="font-semibold text-lg">
                      {previewDocument.name}
                    </h3>
                    <p className="text-sm text-gray-500">
                      {previewDocument.description}
                    </p>
                  </div>
                  {getImportanceBadge(previewDocument.importance)}
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDownload(previewDocument)}
                  >
                    <Download className="h-4 w-4 mr-1" />
                    Download
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => window.open(previewDocument.path, '_blank')}
                  >
                    <ExternalLink className="h-4 w-4 mr-1" />
                    Open
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setPreviewDocument(null)}
                  >
                    Close
                  </Button>
                </div>
              </div>

              <div
                className="p-4 overflow-auto"
                style={{ maxHeight: 'calc(90vh - 120px)' }}
              >
                <DocumentPreview
                  documentName={previewDocument.name}
                  documentPath={previewDocument.path}
                  documentType={previewDocument.type}
                  onClose={() => setPreviewDocument(null)}
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
