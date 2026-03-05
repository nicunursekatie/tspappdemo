import { useState, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { logger } from '@/lib/logger';

// Interfaces
export interface UploadedFile {
  url: string;
  name: string;
}

export interface FileUploadOptions {
  maxSizeMB?: number;
  allowedTypes?: string[];
  onProgress?: (progress: number) => void;
}

// Custom hook for file upload operations
export function useFiles() {
  const { toast } = useToast();
  const [uploadedFiles, setUploadedFiles] = useState<Record<number, UploadedFile[]>>({});
  const [uploadingFiles, setUploadingFiles] = useState<Record<number, boolean>>({});
  const [uploadProgress, setUploadProgress] = useState<Record<number, number>>({});

  // Upload file handler
  const uploadFile = useCallback(async (
    file: File,
    projectId: number,
    options?: FileUploadOptions
  ): Promise<UploadedFile | null> => {
    const {
      maxSizeMB = 10,
      allowedTypes = ['image/*', 'application/pdf', '.doc', '.docx', '.xls', '.xlsx'],
      onProgress
    } = options || {};

    // Validate file size
    const maxSizeBytes = maxSizeMB * 1024 * 1024;
    if (file.size > maxSizeBytes) {
      toast({
        title: 'File Too Large',
        description: `File size must be less than ${maxSizeMB}MB`,
        variant: 'destructive',
      });
      return null;
    }

    // Validate file type
    const isTypeAllowed = allowedTypes.some(type => {
      if (type.includes('*')) {
        const baseType = type.replace('*', '');
        return file.type.startsWith(baseType);
      }
      return file.type === type || file.name.endsWith(type);
    });

    if (!isTypeAllowed) {
      toast({
        title: 'Invalid File Type',
        description: `File type ${file.type || 'unknown'} is not allowed`,
        variant: 'destructive',
      });
      return null;
    }

    setUploadingFiles(prev => ({ ...prev, [projectId]: true }));
    setUploadProgress(prev => ({ ...prev, [projectId]: 0 }));

    try {
      // Create FormData for file upload
      const formData = new FormData();
      formData.append('file', file);
      formData.append('projectId', projectId.toString());

      // Upload file with progress tracking
      const xhr = new XMLHttpRequest();
      
      // Track upload progress
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          const progress = Math.round((event.loaded / event.total) * 100);
          setUploadProgress(prev => ({ ...prev, [projectId]: progress }));
          if (onProgress) {
            onProgress(progress);
          }
        }
      };

      // Create a promise to handle the XHR request
      const uploadPromise = new Promise<UploadedFile>((resolve, reject) => {
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              const response = JSON.parse(xhr.responseText);
              resolve({
                url: response.url,
                name: file.name,
              });
            } catch (error) {
              reject(new Error('Invalid response from server'));
            }
          } else {
            reject(new Error(`Upload failed: ${xhr.statusText}`));
          }
        };

        xhr.onerror = () => {
          reject(new Error('Network error during file upload'));
        };

        // Send the request
        xhr.open('POST', `/api/projects/${projectId}/files`);
        xhr.withCredentials = true; // Include cookies
        xhr.send(formData);
      });

      const uploadedFile = await uploadPromise;

      // Update local state
      setUploadedFiles(prev => ({
        ...prev,
        [projectId]: [...(prev[projectId] || []), uploadedFile],
      }));

      toast({
        title: 'File Uploaded',
        description: `${file.name} has been uploaded successfully`,
      });

      return uploadedFile;

    } catch (error) {
      logger.error('File upload error:', error);
      toast({
        title: 'Upload Failed',
        description: error instanceof Error ? error.message : 'Failed to upload file',
        variant: 'destructive',
      });
      return null;
    } finally {
      setUploadingFiles(prev => ({ ...prev, [projectId]: false }));
      setUploadProgress(prev => ({ ...prev, [projectId]: 0 }));
    }
  }, [toast]);

  // Upload multiple files
  const uploadMultipleFiles = useCallback(async (
    files: FileList | File[],
    projectId: number,
    options?: FileUploadOptions
  ): Promise<UploadedFile[]> => {
    const filesArray = Array.from(files);
    const uploadPromises = filesArray.map(file => uploadFile(file, projectId, options));
    const results = await Promise.all(uploadPromises);
    return results.filter((file): file is UploadedFile => file !== null);
  }, [uploadFile]);

  // Delete file handler
  const deleteFile = useCallback(async (
    fileUrl: string,
    projectId: number
  ): Promise<boolean> => {
    try {
      await apiRequest('DELETE', `/api/projects/${projectId}/files`, { fileUrl });

      // Update local state
      setUploadedFiles(prev => ({
        ...prev,
        [projectId]: (prev[projectId] || []).filter(file => file.url !== fileUrl),
      }));

      toast({
        title: 'File Deleted',
        description: 'File has been removed successfully',
      });

      return true;
    } catch (error) {
      logger.error('File deletion error:', error);
      toast({
        title: 'Deletion Failed',
        description: 'Failed to delete file',
        variant: 'destructive',
      });
      return false;
    }
  }, [toast]);

  // Get files for a specific project
  const getProjectFiles = useCallback((projectId: number): UploadedFile[] => {
    return uploadedFiles[projectId] || [];
  }, [uploadedFiles]);

  // Clear files for a project
  const clearProjectFiles = useCallback((projectId: number) => {
    setUploadedFiles(prev => {
      const updated = { ...prev };
      delete updated[projectId];
      return updated;
    });
  }, []);

  // Handle drag and drop
  const handleFileDrop = useCallback(async (
    event: React.DragEvent<HTMLElement>,
    projectId: number,
    options?: FileUploadOptions
  ): Promise<UploadedFile[]> => {
    event.preventDefault();
    event.stopPropagation();

    const files = event.dataTransfer.files;
    if (files.length > 0) {
      return await uploadMultipleFiles(files, projectId, options);
    }
    return [];
  }, [uploadMultipleFiles]);

  // Handle file input change
  const handleFileInputChange = useCallback(async (
    event: React.ChangeEvent<HTMLInputElement>,
    projectId: number,
    options?: FileUploadOptions
  ): Promise<UploadedFile[]> => {
    const files = event.target.files;
    if (files && files.length > 0) {
      return await uploadMultipleFiles(files, projectId, options);
    }
    return [];
  }, [uploadMultipleFiles]);

  // Create a file input click handler
  const triggerFileInput = useCallback((
    projectId: number,
    options?: FileUploadOptions & { multiple?: boolean; accept?: string }
  ) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = options?.multiple !== false;
    input.accept = options?.accept || '*';

    input.onchange = async (event) => {
      const target = event.target as HTMLInputElement;
      if (target.files && target.files.length > 0) {
        await uploadMultipleFiles(target.files, projectId, options);
      }
    };

    input.click();
  }, [uploadMultipleFiles]);

  return {
    // State
    uploadedFiles,
    uploadingFiles,
    uploadProgress,

    // Actions
    uploadFile,
    uploadMultipleFiles,
    deleteFile,
    clearProjectFiles,
    
    // Utilities
    getProjectFiles,
    handleFileDrop,
    handleFileInputChange,
    triggerFileInput,

    // Setters for external state management
    setUploadedFiles,
  };
}