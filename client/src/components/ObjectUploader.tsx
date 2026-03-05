import { useState } from 'react';
import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Upload, FileText, Loader2 } from 'lucide-react';
import { logger } from '@/lib/logger';

interface ObjectUploaderProps {
  maxNumberOfFiles?: number;
  maxFileSize?: number;
  onComplete?: (uploadedFiles: { url: string; name: string }[]) => void;
  buttonClassName?: string;
  children: ReactNode;
}

/**
 * A simple file upload component that handles file uploads to object storage.
 *
 * Features:
 * - File selection and validation
 * - Upload progress tracking
 * - Error handling and user feedback
 *
 * @param props - Component props
 * @param props.maxNumberOfFiles - Maximum number of files allowed (default: 1)
 * @param props.maxFileSize - Maximum file size in bytes (default: 10MB)
 * @param props.onComplete - Callback when uploads complete successfully
 * @param props.buttonClassName - Optional CSS class for button styling
 * @param props.children - Content to render inside the button
 */
export function ObjectUploader({
  maxNumberOfFiles = 1,
  maxFileSize = 10485760, // 10MB default
  onComplete,
  buttonClassName,
  children,
}: ObjectUploaderProps) {
  const [isUploading, setIsUploading] = useState(false);
  const { toast } = useToast();

  const handleFileSelect = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const files = Array.from(event.target.files || []);

    if (files.length === 0) return;

    // Validate file count
    if (files.length > maxNumberOfFiles) {
      toast({
        title: 'Too many files',
        description: `Please select at most ${maxNumberOfFiles} file(s)`,
        variant: 'destructive',
      });
      return;
    }

    // Validate file sizes
    const oversizedFiles = files.filter((file) => file.size > maxFileSize);
    if (oversizedFiles.length > 0) {
      toast({
        title: 'File too large',
        description: `Files must be smaller than ${Math.round(maxFileSize / 1048576)}MB`,
        variant: 'destructive',
      });
      return;
    }

    setIsUploading(true);

    try {
      const uploadedFiles = [];

      for (const file of files) {
        // Get upload URL from backend
        const uploadResponse = await fetch('/api/objects/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        });

        if (!uploadResponse.ok) {
          throw new Error('Failed to get upload URL');
        }

        const { uploadURL } = await uploadResponse.json();

        // Upload file directly to object storage
        const uploadFileResponse = await fetch(uploadURL, {
          method: 'PUT',
          body: file,
          headers: {
            'Content-Type': file.type,
          },
        });

        if (!uploadFileResponse.ok) {
          throw new Error(`Failed to upload ${file.name}`);
        }

        uploadedFiles.push({
          url: uploadURL.split('?')[0], // Remove query parameters
          name: file.name,
        });
      }

      toast({
        title: 'Upload successful',
        description: `Uploaded ${uploadedFiles.length} file(s) successfully`,
      });

      onComplete?.(uploadedFiles);
    } catch (error) {
      logger.error('Upload error:', error);
      toast({
        title: 'Upload failed',
        description:
          error instanceof Error ? error.message : 'Unknown error occurred',
        variant: 'destructive',
      });
    } finally {
      setIsUploading(false);
      // Reset the input
      event.target.value = '';
    }
  };

  return (
    <div>
      <input
        type="file"
        multiple={maxNumberOfFiles > 1}
        onChange={handleFileSelect}
        style={{ display: 'none' }}
        id="file-upload-input"
        accept="*/*"
      />
      <div
        onClick={() => document.getElementById('file-upload-input')?.click()}
        className="cursor-pointer"
      >
        {children}
      </div>
    </div>
  );
}
