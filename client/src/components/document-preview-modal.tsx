import * as React from 'react';
import { X, Download, ExternalLink, FileText, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface DocumentPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  documentPath: string;
  documentName: string;
  documentType: string;
}

export function DocumentPreviewModal({
  isOpen,
  onClose,
  documentPath,
  documentName,
  documentType,
}: DocumentPreviewModalProps) {
  const [isLoading, setIsLoading] = React.useState(true);
  const [hasError, setHasError] = React.useState(false);

  React.useEffect(() => {
    if (isOpen) {
      setIsLoading(true);
      setHasError(false);
    }
  }, [isOpen, documentPath]);

  const downloadPath = documentPath.replace('/preview', '/download');

  const handleDownload = async () => {
    try {
      const response = await fetch(downloadPath);
      if (!response.ok) throw new Error('Download failed');
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
      window.open(downloadPath, '_blank');
    }
  };

  const handleOpenInNewTab = () => {
    window.open(documentPath, '_blank');
  };

  const truncatedName = documentName.length > 40
    ? documentName.substring(0, 37) + '...'
    : documentName;

  const renderPreview = () => {
    if (hasError) {
      return (
        <div className="flex flex-col items-center justify-center h-64 p-8 text-center">
          <AlertTriangle className="w-12 h-12 text-amber-500 mb-4" />
          <h3 className="text-lg font-semibold mb-2">File Not Available</h3>
          <p className="text-gray-600 text-sm">
            This file could not be loaded. It may have been removed or is temporarily unavailable.
          </p>
        </div>
      );
    }

    const type = documentType?.toLowerCase();

    if (type === 'docx') {
      return (
        <div className="flex flex-col items-center justify-center py-12 px-8 text-center">
          <FileText className="w-14 h-14 text-blue-500 mb-4" />
          <h3 className="text-base font-semibold mb-2 break-all">{documentName}</h3>
          <p className="text-gray-600 text-sm mb-6 max-w-md">
            Word documents require download to view. Click below to save the file to your device.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <Button onClick={handleDownload} size="sm" className="gap-2">
              <Download className="w-4 h-4" />
              Download
            </Button>
            <Button variant="outline" size="sm" onClick={handleOpenInNewTab} className="gap-2">
              <ExternalLink className="w-4 h-4" />
              Open in New Tab
            </Button>
          </div>
        </div>
      );
    }

    if (type === 'xlsx') {
      return (
        <div className="flex flex-col items-center justify-center py-12 px-8 text-center">
          <FileText className="w-14 h-14 text-green-500 mb-4" />
          <h3 className="text-base font-semibold mb-2 break-all">{documentName}</h3>
          <p className="text-gray-600 text-sm mb-6 max-w-md">
            Excel files require download to view. Click below to save the file to your device.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <Button onClick={handleDownload} size="sm" className="gap-2">
              <Download className="w-4 h-4" />
              Download
            </Button>
            <Button variant="outline" size="sm" onClick={handleOpenInNewTab} className="gap-2">
              <ExternalLink className="w-4 h-4" />
              Open in New Tab
            </Button>
          </div>
        </div>
      );
    }

    if (type === 'image') {
      return (
        <div className="flex items-center justify-center p-4">
          <img
            src={documentPath}
            alt={documentName}
            className="max-w-full max-h-[60vh] object-contain rounded"
            onLoad={() => setIsLoading(false)}
            onError={() => { setIsLoading(false); setHasError(true); }}
          />
        </div>
      );
    }

    return (
      <iframe
        src={documentPath}
        className="w-full border-0 rounded-lg"
        onLoad={() => setIsLoading(false)}
        onError={() => { setIsLoading(false); setHasError(true); }}
        title={documentName}
        style={{ minHeight: '550px' }}
      />
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="w-[95vw] max-w-4xl max-h-[90vh] p-0 gap-0">
        <DialogHeader className="flex-shrink-0 px-4 py-3 border-b border-gray-200">
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <FileText className="h-4 w-4 text-gray-500 flex-shrink-0" />
                <DialogTitle className="text-sm font-semibold text-gray-900 truncate" title={documentName}>
                  {truncatedName}
                </DialogTitle>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDownload}
                  className="h-8 px-2 text-xs gap-1"
                >
                  <Download className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Download</span>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleOpenInNewTab}
                  className="h-8 px-2 text-xs gap-1"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">New Tab</span>
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onClose}
                  className="h-8 w-8 p-0"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </DialogHeader>
        <div
          className="overflow-auto px-4 py-3"
          style={{ maxHeight: 'calc(90vh - 60px)' }}
        >
          {isLoading && (documentType?.toLowerCase() === 'pdf' || documentType?.toLowerCase() === 'other') && (
            <div className="flex items-center justify-center h-64">
              <div className="text-center">
                <FileText className="w-10 h-10 text-gray-400 mx-auto mb-3 animate-pulse" />
                <p className="text-gray-500 text-sm">Loading document...</p>
              </div>
            </div>
          )}
          {renderPreview()}
        </div>
      </DialogContent>
    </Dialog>
  );
}
