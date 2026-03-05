import { useState, useEffect } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ExternalLink } from 'lucide-react';
import { useActivityTracker } from '@/hooks/useActivityTracker';
import { logger } from '@/lib/logger';
import { PageBreadcrumbs } from '@/components/page-breadcrumbs';
import { FloatingAIChat } from '@/components/floating-ai-chat';

export default function Flyers() {
  const { trackView } = useActivityTracker();

  useEffect(() => {
    trackView(
      'Flyers',
      'Flyers',
      'Flyers & Promotional Materials',
      'User accessed flyers page'
    );
  }, [trackView]);

  // Flyers configuration - add more flyers here as they become available
  const flyers = [
    {
      id: 'ncl',
      name: 'NCL Flyer - Social Media & QR Codes',
      url: 'https://nicunursekatie.github.io/sandwichprojectcollectionsites/Flyers/NCLflyer.html',
      description: 'Social media QR codes, newsletter signup, and Amazon wishlist',
    },
    {
      id: 'digital',
      name: 'Digital Flyer',
      url: 'https://nicunursekatie.github.io/sandwichprojectcollectionsites/Flyers/digital-flyer.html',
      description: 'Digital promotional flyer for The Sandwich Project',
    },
    {
      id: 'qr-margins',
      name: 'QR Code Flyer with Margins',
      url: 'https://nicunursekatie.github.io/sandwichprojectcollectionsites/Flyers/QR%20Code%20flyer%20with%20margins.pdf',
      description: 'Printable QR code flyer with margins for easy printing',
    },
  ];

  const [selectedFlyerId, setSelectedFlyerId] = useState(flyers[0].id);
  const selectedFlyer = flyers.find(f => f.id === selectedFlyerId) || flyers[0];

  return (
    <div className="h-full flex flex-col bg-gray-50 p-3 sm:p-6">
      <div className="hidden sm:block">
        <PageBreadcrumbs segments={[
          { label: 'Resources & Tools' },
          { label: 'Flyers' }
        ]} />
      </div>

      <div className="mb-4 sm:mb-6">
        <h1 className="text-xl sm:text-3xl font-bold text-brand-primary mb-1 sm:mb-2">
          📄 Flyers & Promotional Materials
        </h1>
        <p className="text-xs sm:text-base text-gray-600">
          Download and share flyers to promote The Sandwich Project
        </p>
      </div>

      <Card className="flex-1 flex flex-col">
        <CardHeader className="p-4 sm:p-6">
          <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
            📄 Flyers & Promotional Materials
          </CardTitle>
          <CardDescription className="text-xs sm:text-sm">
            {selectedFlyer.description}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex-1 flex flex-col p-4 sm:p-6 pt-0 sm:pt-0">
          <div className="space-y-3 sm:space-y-4 flex-1 flex flex-col">
            {/* Flyer Selector - Only show if multiple flyers available */}
            {flyers.length > 1 && (
              <div className="bg-gradient-to-r from-[#236383]/10 to-[#47B3CB]/10 border border-[#47B3CB]/30 rounded-lg p-3 sm:p-4">
                <label className="block text-xs sm:text-sm font-semibold text-[#236383] mb-2">
                  Select Flyer:
                </label>
                <select
                  value={selectedFlyerId}
                  onChange={(e) => setSelectedFlyerId(e.target.value)}
                  className="w-full px-3 sm:px-4 py-2 border border-[#47B3CB] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#236383] bg-white text-sm h-11"
                >
                  {flyers.map((flyer) => (
                    <option key={flyer.id} value={flyer.id}>
                      {flyer.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
              <Button
                size="lg"
                onClick={() => window.open(selectedFlyer.url, '_blank')}
                className="bg-gradient-to-r from-[#FBAD3F] to-yellow-500 hover:from-[#FBAD3F]/90 hover:to-yellow-500/90 text-white font-semibold px-4 sm:px-8 py-3 text-sm sm:text-base flex-1 h-11"
              >
                <ExternalLink className="w-4 h-4 sm:w-5 sm:h-5 mr-2" />
                Open Flyer Page
              </Button>
              <Button
                size="lg"
                variant="outline"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(selectedFlyer.url);
                    alert('Link copied to clipboard!');
                  } catch (error) {
                    logger.error('Failed to copy:', error);
                  }
                }}
                className="border-[#FBAD3F] text-[#FBAD3F] hover:bg-yellow-50 px-4 sm:px-6 py-3 font-medium h-11"
              >
                📋 Copy Link
              </Button>
            </div>

            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 sm:p-4">
              <h3 className="font-semibold text-yellow-900 mb-2 text-sm sm:text-base">Shareable Link:</h3>
              <code className="text-xs sm:text-sm bg-white px-2 sm:px-3 py-2 rounded border border-yellow-200 block break-all">
                {selectedFlyer.url}
              </code>
              <p className="text-xs sm:text-sm text-yellow-700 mt-2">
                Share this flyer to promote The Sandwich Project
              </p>
            </div>

            {/* Flyer-specific content info - only show for NCL flyer */}
            {selectedFlyer.id === 'ncl' && (
              <div className="grid grid-cols-2 gap-2 sm:gap-4 p-3 sm:p-4 bg-gradient-to-br from-blue-50 to-yellow-50 rounded-lg border">
                <div className="text-center">
                  <p className="text-xs sm:text-sm font-semibold text-gray-700 mb-1">✅ Social Media QR</p>
                  <p className="text-[10px] sm:text-xs text-gray-600">Facebook, Instagram, LinkedIn</p>
                </div>
                <div className="text-center">
                  <p className="text-xs sm:text-sm font-semibold text-gray-700 mb-1">📧 Newsletter</p>
                  <p className="text-[10px] sm:text-xs text-gray-600">QR code for newsletter</p>
                </div>
                <div className="text-center">
                  <p className="text-xs sm:text-sm font-semibold text-gray-700 mb-1">🎁 Amazon Wishlist</p>
                  <p className="text-[10px] sm:text-xs text-gray-600">QR code for donations</p>
                </div>
                <div className="text-center">
                  <p className="text-xs sm:text-sm font-semibold text-gray-700 mb-1">🌐 Website</p>
                  <p className="text-[10px] sm:text-xs text-gray-600">thesandwichproject.org</p>
                </div>
              </div>
            )}

            {/* Embedded Flyers - Hidden on mobile */}
            <div className="border rounded-lg overflow-hidden flex-1 hidden sm:block">
              <iframe
                key={selectedFlyer.id}
                src={selectedFlyer.url}
                className="w-full h-full border-0"
                style={{
                  minHeight: '600px',
                  height: '100%',
                }}
                title={selectedFlyer.name}
                loading="eager"
                referrerPolicy="no-referrer"
              />
            </div>
            <div className="sm:hidden bg-gray-100 rounded-lg p-4 text-center">
              <p className="text-sm text-gray-600 mb-3">For the best experience, open the flyer in a new tab on mobile.</p>
              <Button
                onClick={() => window.open(selectedFlyer.url, '_blank')}
                className="bg-gradient-to-r from-[#FBAD3F] to-yellow-500 text-white h-11"
              >
                <ExternalLink className="w-4 h-4 mr-2" />
                Open Flyer
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* AI Assistant */}
      <FloatingAIChat
        contextType="flyers"
        title="Flyers Assistant"
        subtitle="Ask about promotional materials"
        contextData={{
          currentView: 'flyers',
          summaryStats: {
            totalFlyers: flyers.length,
          },
        }}
        getFullContext={() => ({
          rawData: flyers.map(f => ({ name: f.name, url: f.url, description: f.description })),
        })}
        suggestedQuestions={[
          "What flyers are available?",
          "How do I print a flyer?",
          "What's on the NCL flyer?",
          "How do I share a flyer?",
        ]}
      />
    </div>
  );
}
