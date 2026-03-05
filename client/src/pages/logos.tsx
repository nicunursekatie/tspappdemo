import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Download, Eye, FileImage, Palette, ImageIcon } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { useAnalytics } from '@/hooks/useAnalytics';
import { useActivityTracker } from '@/hooks/useActivityTracker';
import { logger } from '@/lib/logger';

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

export default function LogosPage() {
  const [selectedLogo, setSelectedLogo] = useState<
    (typeof logoFiles)[0] | null
  >(null);
  const { trackDownload, trackButtonClick } = useAnalytics();
  const { trackView } = useActivityTracker();

  useEffect(() => {
    trackView(
      'Logos',
      'Logos',
      'Logo Downloads',
      'User accessed logo downloads page'
    );
  }, [trackView]);

  const handleDownload = async (filename: string, displayName: string) => {
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

      // Track the download
      trackDownload(displayName, 'logo');
    } catch (error) {
      logger.error('Download failed:', error);
      alert('Failed to download logo. Please try again.');
    }
  };

  const handlePreview = (logo: (typeof logoFiles)[0]) => {
    setSelectedLogo(logo);
    trackButtonClick('preview_logo', `logos_page - ${logo.name}`);
  };

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <div className="border-b border-brand-primary/20 pb-4">
        <h1 className="text-3xl font-bold text-brand-primary flex items-center gap-3">
          <FileImage className="h-8 w-8" />
          The Sandwich Project Logos
        </h1>
        <p className="text-[#646464] mt-2">
          Download official logos for use in presentations, documents, and
          communications. All logos are available for free use by volunteers and
          partner organizations.
        </p>
      </div>

      {/* Usage Guidelines */}
      <Card className="border-brand-primary/20">
        <CardHeader className="pb-3">
          <CardTitle className="text-brand-primary text-lg">
            Usage Guidelines
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-[#646464] text-sm">
            • Use these logos to represent The Sandwich Project in official
            communications
          </p>
          <p className="text-[#646464] text-sm">
            • Maintain proper spacing and don't modify colors or proportions
          </p>
          <p className="text-[#646464] text-sm">
            • For print materials, use the CMYK version for best color accuracy
          </p>
          <p className="text-[#646464] text-sm">
            • Use transparent versions when overlaying on colored backgrounds
          </p>
        </CardContent>
      </Card>

      {/* Logo Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {logoFiles.map((logo) => (
          <Card
            key={logo.id}
            className="border-brand-primary/20 hover:shadow-lg transition-shadow"
          >
            <CardHeader className="pb-3">
              <CardTitle className="text-brand-primary text-lg flex items-center gap-2">
                {logo.icon}
                {logo.name}
              </CardTitle>
              <Badge variant="secondary" className="w-fit">
                {logo.type}
              </Badge>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Logo Preview */}
              <div
                className="w-full h-32 rounded-lg border border-gray-200 flex items-center justify-center overflow-hidden"
                style={{ backgroundColor: logo.bgColor }}
              >
                <img
                  src={`/attached_assets/LOGOS/${logo.filename}`}
                  alt={logo.name}
                  className="max-w-full max-h-full object-contain p-2"
                  onError={(e) => {
                    e.currentTarget.src =
                      'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjQiIGhlaWdodD0iNjQiIHZpZXdCb3g9IjAgMCA2NCA2NCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjY0IiBoZWlnaHQ9IjY0IiBmaWxsPSIjZjNmNGY2Ii8+CjxwYXRoIGQ9Ik0yMCAyMEg0NFY0NEgyMFYyMFoiIGZpbGw9IiNkMWQ1ZGIiLz4KPC9zdmc+';
                  }}
                />
              </div>

              <div className="space-y-2">
                <p className="text-sm text-[#646464]">{logo.description}</p>
                <p className="text-xs text-[#646464] font-medium">
                  Best for: {logo.usage}
                </p>
              </div>

              <div className="flex gap-2">
                <Dialog>
                  <DialogTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 border-brand-primary text-brand-primary hover:bg-brand-primary hover:text-white"
                      onClick={() => handlePreview(logo)}
                    >
                      <Eye className="h-4 w-4 mr-1" />
                      Preview
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
                          <strong className="text-brand-primary">File Type:</strong>{' '}
                          {logo.type}
                        </div>
                        <div>
                          <strong className="text-brand-primary">Filename:</strong>{' '}
                          {logo.filename}
                        </div>
                        <div className="col-span-2">
                          <strong className="text-brand-primary">Usage:</strong>{' '}
                          {logo.usage}
                        </div>
                      </div>
                      <Button
                        onClick={() => handleDownload(logo.filename, logo.name)}
                        className="w-full bg-brand-primary hover:bg-brand-primary-dark"
                      >
                        <Download className="h-4 w-4 mr-2" />
                        Download {logo.name}
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>

                <Button
                  onClick={() => handleDownload(logo.filename, logo.name)}
                  size="sm"
                  className="flex-1 bg-brand-primary hover:bg-brand-primary-dark"
                >
                  <Download className="h-4 w-4 mr-1" />
                  Download
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Download All Section */}
      <Card className="border-brand-primary/20">
        <CardHeader>
          <CardTitle className="text-brand-primary">
            Download Complete Logo Package
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-[#646464] mb-4">
            Need all logos? Download each one individually using the buttons
            above, or contact your administrator for a complete package.
          </p>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-sm text-[#646464]">
            <div>✓ Print-ready CMYK version</div>
            <div>✓ Web-optimized PNG files</div>
            <div>✓ Transparent backgrounds</div>
            <div>✓ Multiple size variants</div>
            <div>✓ Light and dark versions</div>
            <div>✓ Icon variations</div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
