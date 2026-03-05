/**
 * Host Resources Page
 *
 * A centralized hub for host volunteers to access all the tools and documents
 * they need for running their collection site.
 */

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'wouter';
import { useAuth } from '@/hooks/useAuth';

// UI Components
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';

// Icons
import {
  Building2,
  MapPin,
  Users,
  FileText,
  ClipboardList,
  Download,
  ExternalLink,
  Sandwich,
  Tag,
  UserCheck,
  Phone,
  Mail,
  BookOpen,
  HelpCircle,
  Share2,
  Eye,
  Image,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';

// Brand colors: #236383 (dark teal), #47b3cb (light teal), #007e8c (primary teal), #a31c41 (burgundy), #fbad3f (gold)

// Resource card component
function ResourceCard({
  title,
  description,
  icon: Icon,
  href,
  isExternal = false,
  variant = 'default',
}: {
  title: string;
  description: string;
  icon: React.ElementType;
  href: string;
  isExternal?: boolean;
  variant?: 'default' | 'primary' | 'secondary';
}) {
  const bgClass = variant === 'primary'
    ? 'bg-[#007e8c]/10 border-[#007e8c]/30 hover:bg-[#007e8c]/20'
    : variant === 'secondary'
    ? 'bg-[#fbad3f]/10 border-[#fbad3f]/30 hover:bg-[#fbad3f]/20'
    : 'bg-white hover:bg-gray-50';

  const iconColor = variant === 'primary'
    ? 'text-[#007e8c]'
    : variant === 'secondary'
    ? 'text-[#fbad3f]'
    : 'text-[#236383]';

  const content = (
    <Card className={`${bgClass} transition-colors cursor-pointer h-full`}>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div className="p-2 bg-white rounded-lg shadow-sm">
            <Icon className={`w-5 h-5 ${iconColor}`} />
          </div>
          {isExternal && (
            <ExternalLink className="w-4 h-4 text-gray-400" />
          )}
        </div>
        <CardTitle className="text-base mt-2">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <CardDescription>{description}</CardDescription>
      </CardContent>
    </Card>
  );

  if (isExternal) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className="block h-full">
        {content}
      </a>
    );
  }

  return (
    <Link href={`/${href}`} className="block h-full">
      {content}
    </Link>
  );
}

// Image guide card with download and share
function ImageGuideCard({
  title,
  description,
  imageUrl,
  fileName,
}: {
  title: string;
  description: string;
  imageUrl: string;
  fileName: string;
}) {
  const { toast } = useToast();

  const handleDownload = async (e: React.MouseEvent) => {
    e.preventDefault();
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

  const handleShare = async (e: React.MouseEvent) => {
    e.preventDefault();
    const shareUrl = window.location.origin + imageUrl;

    if (navigator.share) {
      try {
        await navigator.share({
          title: title,
          text: description,
          url: shareUrl,
        });
      } catch (error) {
        // User cancelled or error
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
    <Card className="bg-white hover:shadow-md transition-shadow overflow-hidden border-l-4 border-l-[#007e8c]">
      <div className="aspect-[4/5] relative bg-gray-100">
        <img
          src={imageUrl}
          alt={title}
          className="w-full h-full object-contain p-2"
        />
      </div>
      <CardContent className="p-4">
        <h4 className="font-medium text-sm mb-1">{title}</h4>
        <p className="text-xs text-muted-foreground mb-3">{description}</p>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            className="flex-1 gap-1.5 bg-[#007e8c] hover:bg-[#236383] text-white border-none"
            onClick={handleDownload}
          >
            <Download className="w-4 h-4" />
            Download
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={handleShare}
          >
            <Share2 className="w-4 h-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// Document download card with preview
function DocumentCard({
  title,
  description,
  fileType,
  downloadUrl,
}: {
  title: string;
  description: string;
  fileType: string;
  downloadUrl: string;
}) {
  const [previewOpen, setPreviewOpen] = React.useState(false);
  const { toast } = useToast();

  const handleDownload = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      const response = await fetch(downloadUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const filename = downloadUrl.split('/').pop() || 'document.pdf';
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Download failed:', error);
      window.open(downloadUrl, '_blank');
    }
  };

  const handleShare = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const shareUrl = `${window.location.origin}${downloadUrl}`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: title,
          text: description,
          url: shareUrl,
        });
      } catch (error) {
        // User cancelled or share failed, fall back to clipboard
        await copyToClipboard(shareUrl);
      }
    } else {
      await copyToClipboard(shareUrl);
    }
  };

  const copyToClipboard = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      toast({
        title: 'Link copied!',
        description: 'The document link has been copied to your clipboard.',
      });
    } catch (error) {
      toast({
        title: 'Copy failed',
        description: 'Could not copy link. Please try again.',
        variant: 'destructive',
      });
    }
  };

  return (
    <>
      <Card
        className="bg-white hover:bg-gray-50 transition-colors cursor-pointer border-l-4 border-l-[#a31c41]"
        onClick={() => setPreviewOpen(true)}
      >
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            {/* PDF Thumbnail Preview */}
            <div className="relative w-full sm:w-32 h-40 sm:h-24 bg-gray-100 rounded-lg overflow-hidden flex-shrink-0 group">
              <iframe
                src={`${downloadUrl}#toolbar=0&navpanes=0&scrollbar=0&view=FitH`}
                className="w-full h-full pointer-events-none"
                title={`Preview of ${title}`}
              />
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center">
                <div className="opacity-0 group-hover:opacity-100 transition-opacity bg-white/90 rounded-full p-2">
                  <Eye className="w-4 h-4 text-[#007e8c]" />
                </div>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0 flex flex-col justify-between">
              <div>
                <h4 className="font-medium text-sm">{title}</h4>
                <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{description}</p>
                <Badge variant="outline" className="mt-2 text-[10px] bg-[#a31c41]/10 text-[#a31c41] border-[#a31c41]/30">
                  {fileType}
                </Badge>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2 mt-3">
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 flex-1 sm:flex-none"
                  onClick={(e) => {
                    e.stopPropagation();
                    setPreviewOpen(true);
                  }}
                >
                  <Eye className="w-4 h-4" />
                  <span className="hidden sm:inline">Preview</span>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 flex-1 sm:flex-none bg-[#007e8c] hover:bg-[#236383] text-white border-none"
                  onClick={handleDownload}
                >
                  <Download className="w-4 h-4" />
                  <span className="hidden sm:inline">Download</span>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 flex-1 sm:flex-none"
                  onClick={handleShare}
                >
                  <Share2 className="w-4 h-4" />
                  <span className="hidden sm:inline">Share</span>
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Full Preview Dialog */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-4xl h-[90vh] p-0 overflow-hidden">
          <DialogHeader className="p-4 pb-2 border-b bg-white">
            <div className="flex items-center justify-between">
              <div>
                <DialogTitle className="text-lg">{title}</DialogTitle>
                <p className="text-sm text-muted-foreground mt-1">{description}</p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 bg-[#007e8c] hover:bg-[#236383] text-white border-none"
                  onClick={handleDownload}
                >
                  <Download className="w-4 h-4" />
                  Download
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  onClick={handleShare}
                >
                  <Share2 className="w-4 h-4" />
                  Share
                </Button>
              </div>
            </div>
          </DialogHeader>
          <div className="flex-1 h-full bg-gray-100">
            <iframe
              src={`${downloadUrl}#toolbar=1&navpanes=1`}
              className="w-full h-[calc(90vh-80px)]"
              title={`Full preview of ${title}`}
            />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default function HostResources() {
  const { user } = useAuth();

  return (
    <div className="p-4 sm:p-6 space-y-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="text-center space-y-2">
        <div className="flex items-center justify-center gap-3">
          <div className="p-3 bg-[#007e8c]/10 rounded-full">
            <Building2 className="w-8 h-8 text-[#007e8c]" />
          </div>
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold">Host Resources</h1>
        <p className="text-muted-foreground max-w-xl mx-auto">
          Everything you need to run your sandwich collection site.
          Access tools, download documents, and find important information all in one place.
        </p>
      </div>

      {/* Quick Links Section */}
      <section>
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Sandwich className="w-5 h-5 text-[#fbad3f]" />
          Collection Tools
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <ResourceCard
            title="Log Your Collections"
            description="Record sandwich collections from your site with the easy-to-use collection form."
            icon={ClipboardList}
            href="collections"
            variant="primary"
          />
          <ResourceCard
            title="Collection History"
            description="View your past collection entries and see your site's impact over time."
            icon={Sandwich}
            href="collections"
          />
          <ResourceCard
            title="Recipient Database"
            description="Browse the database of recipient organizations that receive sandwiches."
            icon={Users}
            href="recipients"
          />
        </div>
      </section>

      {/* Maps Section */}
      <section>
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <MapPin className="w-5 h-5 text-[#007e8c]" />
          Maps & Locations
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <ResourceCard
            title="Host Locations Map"
            description="See all host collection sites on an interactive map. Great for finding nearby hosts!"
            icon={MapPin}
            href="route-map"
            variant="secondary"
          />
          <ResourceCard
            title="All Hosts Directory"
            description="Browse the complete list of host collection sites and their details."
            icon={Building2}
            href="hosts"
          />
        </div>
      </section>

      {/* Documents Section */}
      <section>
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <FileText className="w-5 h-5 text-[#a31c41]" />
          Downloadable Documents
        </h2>
        <p className="text-sm text-muted-foreground mb-4">
          Download and print these documents for your collection site.
        </p>
        <div className="space-y-3">
          <DocumentCard
            title="TSP Host Handbook"
            description="Complete guide for host collection sites — everything you need to know about hosting a sandwich collection"
            fileType="PDF"
            downloadUrl="/attached_assets/TSP-New-Host-Handbook.pdf"
          />
          <DocumentCard
            title="Deli Sandwich Labels"
            description="Pre-formatted labels for deli meat sandwiches with ingredient info"
            fileType="PDF"
            downloadUrl="/documents/deli-labels.pdf"
          />
          <DocumentCard
            title="PB&J Sandwich Labels"
            description="Pre-formatted labels for peanut butter & jelly sandwiches"
            fileType="PDF"
            downloadUrl="/documents/pbj-labels.pdf"
          />
          <DocumentCard
            title="Volunteer Sign-In Sheet"
            description="Sign-in sheet for tracking volunteer attendance at your site"
            fileType="PDF"
            downloadUrl="/documents/volunteer-sign-in-sheet.pdf"
          />
          <DocumentCard
            title="Food Safety for Hosts"
            description="Food safety guidelines and best practices for host collection sites"
            fileType="PDF"
            downloadUrl="/documents/food-safety-hosts.pdf"
          />
          <DocumentCard
            title="Deli Sandwich Making 101"
            description="Step-by-step guide for making deli sandwiches"
            fileType="PDF"
            downloadUrl="/documents/deli-sandwich-making-101.pdf"
          />
          <DocumentCard
            title="PB&J Sandwich Making 101"
            description="Step-by-step guide for making peanut butter & jelly sandwiches"
            fileType="PDF"
            downloadUrl="/documents/pbj-sandwich-making-101.pdf"
          />
        </div>
      </section>

      {/* Sandwich Assembly Guides Section */}
      <section>
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Image className="w-5 h-5 text-[#007e8c]" />
          Sandwich Assembly Guides
        </h2>
        <p className="text-sm text-muted-foreground mb-4">
          Visual guides for proper sandwich assembly. Download or share these with your volunteers.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <ImageGuideCard
            title="Sandwich Assembly"
            description="Basic sandwich assembly guide showing cheese, meat, and cheese layers"
            imageUrl="/images/sandwich-assembly.png"
            fileName="sandwich-assembly.png"
          />
          <ImageGuideCard
            title="White Bread Sandwich"
            description="Complete sandwich with white bread - bread, cheese, meat, cheese, bread"
            imageUrl="/images/sandwich-white-bread.png"
            fileName="sandwich-white-bread.png"
          />
          <ImageGuideCard
            title="Why Cheese on the Bottom"
            description="Cheese acts as a moisture barrier to keep bread from getting soggy"
            imageUrl="/images/why-cheese-bottom.png"
            fileName="why-cheese-bottom.png"
          />
          <ImageGuideCard
            title="PB&J Assembly"
            description="Peanut butter on both slices, jelly on one - 3 easy steps"
            imageUrl="/images/pbj-assembly.png"
            fileName="pbj-assembly.png"
          />
        </div>
      </section>

      {/* Contact Section */}
      <section>
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <HelpCircle className="w-5 h-5 text-[#236383]" />
          Need Help?
        </h2>
        <Card className="bg-gradient-to-r from-[#47b3cb]/10 to-[#007e8c]/10 border-[#007e8c]/30">
          <CardContent className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h3 className="font-medium mb-3">Contact TSP Staff</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Mail className="w-4 h-4" />
                    <a href="mailto:info@thesandwichproject.org" className="hover:text-primary">
                      info@thesandwichproject.org
                    </a>
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Phone className="w-4 h-4" />
                    <span>Check the directory for direct contacts</span>
                  </div>
                </div>
              </div>
              <div>
                <h3 className="font-medium mb-3">Quick Resources</h3>
                <div className="space-y-2">
                  <Link href="/help">
                    <Button variant="outline" size="sm" className="w-full justify-start gap-2">
                      <BookOpen className="w-4 h-4" />
                      Help Center
                    </Button>
                  </Link>
                  <Link href="/suggestions">
                    <Button variant="outline" size="sm" className="w-full justify-start gap-2">
                      <HelpCircle className="w-4 h-4" />
                      Submit a Question
                    </Button>
                  </Link>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* Tips Section */}
      <section>
        <Card className="bg-[#fbad3f]/10 border-[#fbad3f]/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Tag className="w-5 h-5 text-[#fbad3f]" />
              Host Tips
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="text-sm space-y-2 text-muted-foreground">
              <li className="flex items-start gap-2">
                <span className="text-[#fbad3f] font-bold">•</span>
                Log your collections promptly so we can track our impact accurately.
              </li>
              <li className="flex items-start gap-2">
                <span className="text-[#fbad3f] font-bold">•</span>
                Use the sign-in sheets to track volunteer hours for service hour verification.
              </li>
              <li className="flex items-start gap-2">
                <span className="text-[#fbad3f] font-bold">•</span>
                Labels should include date made and allergen info (especially for PB&J).
              </li>
              <li className="flex items-start gap-2">
                <span className="text-[#fbad3f] font-bold">•</span>
                Connect with other hosts on the map to share best practices!
              </li>
            </ul>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
