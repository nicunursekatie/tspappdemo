import { useEffect, useState } from 'react';
import { X, Download, ExternalLink, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface DocumentPreviewProps {
  documentPath: string;
  documentName: string;
  documentType: string;
  onClose: () => void;
}

export function DocumentPreview({
  documentPath,
  documentName,
  documentType,
  onClose,
}: DocumentPreviewProps) {
  const [isLoading, setIsLoading] = useState(
    documentType?.toLowerCase() === 'pdf'
  );
  const [showFallback, setShowFallback] = useState(false);

  useEffect(() => {
    setShowFallback(false);
    if (documentType?.toLowerCase() === 'pdf') {
      setIsLoading(true);
    } else {
      setIsLoading(false);
    }
  }, [documentPath, documentType]);

  const handleDownload = async () => {
    try {
      const response = await fetch(documentPath);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = documentName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Download failed:', error);
      window.open(documentPath, '_blank');
    }
  };

  const handleOpenInNewTab = () => {
    window.open(documentPath, '_blank');
  };

  const renderPreview = () => {
    switch (documentType?.toLowerCase()) {
      case 'pdf':
        return (
          <div className="h-full flex flex-col">
            {/* Header with buttons - compact */}
            <div className="flex-shrink-0 flex items-center justify-between p-3 bg-gray-50 border-b">
              <h3 className="text-sm font-medium truncate">{documentName}</h3>
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleDownload}
                  className="flex items-center gap-1 h-8 px-2"
                  title="Download PDF"
                >
                  <Download className="w-3 h-3" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleOpenInNewTab}
                  className="flex items-center gap-1 h-8 px-2"
                  title="Open in New Tab"
                >
                  <ExternalLink className="w-3 h-3" />
                </Button>
              </div>
            </div>

            {/* PDF viewer - takes full space */}
            <div className="flex-1 bg-white">
              {showFallback ? (
                <div className="flex flex-col items-center justify-center h-full p-8 text-center">
                  <div className="mb-4">
                    <FileText className="w-16 h-16 text-red-500 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold mb-2">
                      PDF Preview Blocked
                    </h3>
                    <p className="text-gray-600 mb-6 max-w-md">
                      Your browser (likely Brave or another privacy-focused
                      browser) has blocked the PDF preview for security reasons.
                      Use the buttons above to download the file or open it in a
                      new tab.
                    </p>
                  </div>
                  <div className="flex gap-4">
                    <Button
                      onClick={handleDownload}
                      className="flex items-center gap-2"
                    >
                      <Download className="w-4 h-4" />
                      Download PDF
                    </Button>
                    <Button
                      variant="outline"
                      onClick={handleOpenInNewTab}
                      className="flex items-center gap-2"
                    >
                      <ExternalLink className="w-4 h-4" />
                      Open in New Tab
                    </Button>
                  </div>
                </div>
              ) : (
                <iframe
                  src={documentPath}
                  className="w-full h-full border-0"
                  onLoad={() => {
                    setIsLoading(false);
                    // Check if iframe loaded properly after a short delay
                    setTimeout(() => {
                      const iframe = document.querySelector(
                        'iframe[title="' + documentName + '"]'
                      ) as HTMLIFrameElement;
                      if (iframe) {
                        try {
                          // Try to access the iframe content - this will fail if blocked
                          if (
                            !iframe.contentDocument &&
                            !iframe.contentWindow
                          ) {
                            setShowFallback(true);
                          }
                        } catch (e) {
                          setShowFallback(true);
                        }
                      }
                    }, 1000);
                  }}
                  onError={() => {
                    setIsLoading(false);
                    setShowFallback(true);
                  }}
                  title={documentName}
                  style={{
                    display: 'block',
                    border: 'none',
                  }}
                />
              )}
            </div>
          </div>
        );
      case 'docx':
        // For DOCX files, show a download option since viewing requires conversion
        return (
          <div className="flex flex-col items-center justify-center h-full p-8 text-center">
            <div className="mb-4">
              <FileText className="w-16 h-16 text-blue-500 mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">{documentName}</h3>
              <p className="text-gray-600 mb-6">
                Word documents require download to view. Click the download
                button to save the file to your device.
              </p>
            </div>
            <div className="flex gap-4">
              <Button
                onClick={handleDownload}
                className="flex items-center gap-2"
              >
                <Download className="w-4 h-4" />
                Download Document
              </Button>
              <Button
                variant="outline"
                onClick={handleOpenInNewTab}
                className="flex items-center gap-2"
              >
                <ExternalLink className="w-4 h-4" />
                Open in New Tab
              </Button>
            </div>
          </div>
        );
      case 'xlsx':
        // For Excel files, show a download option since viewing requires conversion
        return (
          <div className="flex flex-col items-center justify-center h-full p-8 text-center">
            <div className="mb-4">
              <FileText className="w-16 h-16 text-green-500 mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">{documentName}</h3>
              <p className="text-gray-600 mb-6">
                Excel files require download to view. Click the download button
                to save the file to your device.
              </p>
            </div>
            <div className="flex gap-4">
              <Button
                onClick={handleDownload}
                className="flex items-center gap-2"
              >
                <Download className="w-4 h-4" />
                Download Document
              </Button>
              <Button
                variant="outline"
                onClick={handleOpenInNewTab}
                className="flex items-center gap-2"
              >
                <ExternalLink className="w-4 h-4" />
                Open in New Tab
              </Button>
            </div>
          </div>
        );
      default:
        return (
          <div className="flex flex-col items-center justify-center h-full p-8 text-center">
            <div className="mb-4">
              <FileText className="w-16 h-16 text-gray-500 mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">{documentName}</h3>
              <p className="text-gray-600 mb-6">
                Preview not available for this file type. Download or open in a
                new tab to view.
              </p>
            </div>
            <div className="flex gap-4">
              <Button
                onClick={handleDownload}
                className="flex items-center gap-2"
              >
                <Download className="w-4 h-4" />
                Download Document
              </Button>
              <Button
                variant="outline"
                onClick={handleOpenInNewTab}
                className="flex items-center gap-2"
              >
                <ExternalLink className="w-4 h-4" />
                Open in New Tab
              </Button>
            </div>
          </div>
        );
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-5xl h-5/6 flex flex-col ml-0 lg:ml-64 mr-4">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <h2 className="text-lg font-semibold text-gray-900 truncate">
              {documentName}
            </h2>
            <span className="px-2 py-1 text-xs font-medium bg-brand-primary-light text-brand-primary-dark rounded-full">
              {documentType?.toUpperCase() || 'FILE'}
            </span>
          </div>
          <div className="flex items-center space-x-2">
            <Button onClick={handleDownload} variant="ghost" size="sm">
              <Download className="w-4 h-4" />
            </Button>
            <Button onClick={handleOpenInNewTab} variant="ghost" size="sm">
              <ExternalLink className="w-4 h-4" />
            </Button>
            <Button onClick={onClose} variant="ghost" size="sm">
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Preview Content */}
        <div className="flex-1 relative">
          {documentType?.toLowerCase() === 'pdf' && isLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-50">
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-primary mx-auto mb-2"></div>
                <p className="text-gray-600">Loading preview...</p>
              </div>
            </div>
          )}
          {renderPreview()}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-200 bg-gray-50">
          <div className="flex justify-between items-center">
            <p className="text-sm text-gray-600">
              Use the buttons above to download or open in a new tab
            </p>
            <Button onClick={onClose} variant="outline">
              Close Preview
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
