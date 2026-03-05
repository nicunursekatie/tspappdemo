import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  Upload,
  Download,
  Trash2,
  FileText,
  Lock,
  Users,
  Calendar,
  User,
  AlertCircle,
  CheckCircle,
  Loader2,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useAuth } from '@/hooks/useAuth';
import type { ConfidentialDocument } from '@shared/schema';
import { logger } from '@/lib/logger';

interface ConfidentialDocumentResponse {
  documents: ConfidentialDocument[];
}

export function ConfidentialDocuments() {
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [allowedEmails, setAllowedEmails] = useState<string>('');
  const [isDragActive, setIsDragActive] = useState(false);
  const [expandedAccess, setExpandedAccess] = useState<Record<number, boolean>>({});
  const { toast } = useToast();
  const { user } = useAuth();

  // Query for listing confidential documents
  const {
    data: documentsData,
    isLoading: isLoadingDocuments,
    error: documentsError,
  } = useQuery<ConfidentialDocumentResponse>({
    queryKey: ['/api/storage/confidential'],
  });

  // Upload mutation
  const uploadMutation = useMutation({
    mutationKey: ['upload-confidential-document'],
    mutationFn: async ({
      file,
      emails,
    }: {
      file: File;
      emails: string[];
    }) => {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('allowedEmails', JSON.stringify(emails));

      return apiRequest('POST', '/api/storage/confidential', formData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/storage/confidential'] });
      toast({
        title: 'Upload Successful',
        description: 'Confidential document has been uploaded successfully.',
        duration: 5000,
      });
      setUploadDialogOpen(false);
      setSelectedFile(null);
      setAllowedEmails('');
    },
    onError: (error) => {
      logger.error('Upload error:', error);
      toast({
        title: 'Upload Failed',
        description:
          error instanceof Error ? error.message : 'Unknown error occurred',
        variant: 'destructive',
        duration: 7000,
      });
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationKey: ['delete-confidential-document'],
    mutationFn: async (id: number) => {
      return apiRequest('DELETE', `/api/storage/confidential/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/storage/confidential'] });
      toast({
        title: 'Document Deleted',
        description: 'Confidential document has been deleted successfully.',
        duration: 5000,
      });
    },
    onError: (error) => {
      logger.error('Delete error:', error);
      toast({
        title: 'Delete Failed',
        description:
          error instanceof Error ? error.message : 'Failed to delete document',
        variant: 'destructive',
        duration: 7000,
      });
    },
  });

  const handleFileSelect = (file: File) => {
    if (file.size > 100 * 1024 * 1024) {
      // 100MB limit
      toast({
        title: 'File Too Large',
        description: 'Please select a file smaller than 100MB.',
        variant: 'destructive',
      });
      return;
    }
    setSelectedFile(file);
    // Set current user email as default if available
    if (user?.email && !allowedEmails) {
      setAllowedEmails(user.email);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragActive(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragActive(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragActive(false);
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      handleFileSelect(files[0]);
    }
  };

  const handleUpload = () => {
    if (!selectedFile) {
      toast({
        title: 'No File Selected',
        description: 'Please select a file to upload.',
        variant: 'destructive',
      });
      return;
    }

    if (!allowedEmails.trim()) {
      toast({
        title: 'No Access Emails',
        description: 'Please specify at least one email address for access.',
        variant: 'destructive',
      });
      return;
    }

    // Parse and validate emails
    const emails = allowedEmails
      .split(',')
      .map((email) => email.trim())
      .filter((email) => email.length > 0);

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const invalidEmails = emails.filter((email) => !emailRegex.test(email));

    if (invalidEmails.length > 0) {
      toast({
        title: 'Invalid Email Addresses',
        description: `Please check: ${invalidEmails.join(', ')}`,
        variant: 'destructive',
      });
      return;
    }

    uploadMutation.mutate({ file: selectedFile, emails });
  };

  const handleDownload = async (doc: ConfidentialDocument) => {
    try {
      const response = await fetch(
        `/api/storage/confidential/${doc.id}/download`,
        {
          credentials: 'include',
        }
      );

      if (!response.ok) {
        if (response.status === 403) {
          throw new Error('You do not have permission to download this file.');
        }
        if (response.status === 404) {
          throw new Error('File not found.');
        }
        throw new Error('Failed to download file.');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = window.document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = doc.originalName || doc.fileName;
      window.document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      window.document.body.removeChild(a);

      toast({
        title: 'Download Complete',
        description: `${doc.originalName} has been downloaded successfully.`,
      });
    } catch (error) {
      logger.error('Download error:', error);
      toast({
        title: 'Download Failed',
        description:
          error instanceof Error ? error.message : 'Unknown error occurred',
        variant: 'destructive',
      });
    }
  };

  const handleDelete = (doc: ConfidentialDocument) => {
    deleteMutation.mutate(doc.id);
  };

  const toggleAccessExpanded = (documentId: number) => {
    setExpandedAccess(prev => ({
      ...prev,
      [documentId]: !prev[documentId]
    }));
  };

  const canDeleteDocument = (doc: ConfidentialDocument): boolean => {
    // Allow deletion if user is the uploader, admin, or has access to the document
    const isUploader = user?.id === doc.uploadedBy;
    const isAdmin = user?.email === 'admin@sandwich.project' || user?.email === 'katielong2316@gmail.com';
    const hasAccess = user?.email && doc.allowedEmails?.includes(user.email);
    
    return isUploader || isAdmin || hasAccess;
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (dateString: string): string => {
    try {
      return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateString;
    }
  };

  const documents = documentsData?.documents || [];

  return (
    <div className="min-h-screen bg-white p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-16">
          <div className="flex items-center gap-4 mb-6">
            <div className="p-3 bg-gradient-to-br from-brand-primary to-brand-primary-dark rounded-xl shadow-[0_4px_12px_rgba(35,99,131,0.15),0_2px_4px_rgba(35,99,131,0.1)] hover:shadow-[0_8px_24px_rgba(35,99,131,0.2),0_4px_8px_rgba(35,99,131,0.15)] transition-all duration-300 ease-in-out">
              <Lock className="h-8 w-8 text-white" />
            </div>
            <div>
              <h1 className="text-4xl font-bold text-gray-900 mb-2">
                Confidential Documents
              </h1>
              <p className="text-lg text-gray-600">
                Secure document storage with email-based access control
              </p>
              <div className="mt-3 bg-red-50 border border-red-200 rounded-lg px-3 py-2 inline-flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-red-600" />
                <div className="text-sm text-red-700 font-medium">
                  Restricted Access • Admin Only
                </div>
              </div>
            </div>
          </div>

          {/* Upload Button */}
          <div className="flex justify-end">
            <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
              <DialogTrigger asChild>
                <Button
                  className="px-6 py-3 text-sm font-medium bg-gradient-to-r from-brand-primary to-brand-primary-dark text-white border-0 shadow-[0_4px_12px_rgba(35,99,131,0.25),0_2px_4px_rgba(35,99,131,0.1)] transform hover:scale-[1.02] hover:shadow-[0_6px_20px_rgba(35,99,131,0.3),0_4px_8px_rgba(35,99,131,0.15)] transition-all duration-200 ease-in-out rounded-lg"
                  data-testid="button-upload-confidential"
                >
                  <Upload className="w-4 h-4 mr-2" />
                  Upload Confidential Document
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <Lock className="h-5 w-5 text-brand-primary" />
                    Upload Confidential Document
                  </DialogTitle>
                  <DialogDescription>
                    Upload a confidential document with restricted access. Only
                    specified email addresses will have access.
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-6">
                  {/* File Upload Area */}
                  <div>
                    <Label htmlFor="file-upload">Document File</Label>
                    <div
                      className={`mt-2 border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
                        isDragActive
                          ? 'border-brand-primary bg-brand-primary/5'
                          : 'border-gray-300 hover:border-brand-primary/50'
                      }`}
                      onDragOver={handleDragOver}
                      onDragLeave={handleDragLeave}
                      onDrop={handleDrop}
                    >
                      {selectedFile ? (
                        <div className="flex items-center justify-center gap-3">
                          <FileText className="h-8 w-8 text-brand-primary" />
                          <div>
                            <p className="font-medium text-gray-900">
                              {selectedFile.name}
                            </p>
                            <p className="text-sm text-gray-500">
                              {formatFileSize(selectedFile.size)}
                            </p>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setSelectedFile(null)}
                            data-testid="button-remove-file"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      ) : (
                        <div>
                          <Upload className="mx-auto h-12 w-12 text-gray-400" />
                          <p className="mt-2 text-sm text-gray-600">
                            Drag and drop a file, or{' '}
                            <button
                              type="button"
                              className="font-medium text-brand-primary hover:text-brand-primary-dark"
                              onClick={() =>
                                document.getElementById('file-input')?.click()
                              }
                            >
                              browse
                            </button>
                          </p>
                          <p className="text-xs text-gray-500 mt-1">
                            PDF, DOC, DOCX, XLS, XLSX (max 100MB)
                          </p>
                        </div>
                      )}
                      <input
                        id="file-input"
                        type="file"
                        className="hidden"
                        accept=".pdf,.doc,.docx,.xls,.xlsx"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleFileSelect(file);
                        }}
                        data-testid="input-file-upload"
                      />
                    </div>
                  </div>

                  {/* Email Access Control */}
                  <div>
                    <Label htmlFor="allowed-emails">
                      Allowed Email Addresses
                    </Label>
                    <Input
                      id="allowed-emails"
                      type="text"
                      placeholder="user1@example.com, user2@example.com"
                      value={allowedEmails}
                      onChange={(e) => setAllowedEmails(e.target.value)}
                      className="mt-2"
                      data-testid="input-allowed-emails"
                    />
                    <p className="text-sm text-gray-500 mt-1">
                      Separate multiple email addresses with commas
                    </p>
                  </div>

                  {/* Upload Actions */}
                  <div className="flex justify-end gap-3">
                    <Button
                      variant="outline"
                      onClick={() => setUploadDialogOpen(false)}
                      data-testid="button-cancel-upload"
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={handleUpload}
                      disabled={uploadMutation.isPending}
                      className="bg-brand-primary hover:bg-brand-primary-dark"
                      data-testid="button-confirm-upload"
                    >
                      {uploadMutation.isPending ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Uploading...
                        </>
                      ) : (
                        <>
                          <Upload className="w-4 h-4 mr-2" />
                          Upload Document
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Documents List */}
        <div className="space-y-6">
          {isLoadingDocuments ? (
            <div className="flex items-center justify-center py-12">
              <div className="flex items-center gap-3">
                <Loader2 className="h-6 w-6 animate-spin text-brand-primary" />
                <p className="text-lg text-gray-600">Loading documents...</p>
              </div>
            </div>
          ) : documentsError ? (
            <Card className="border-red-200 bg-red-50">
              <CardContent className="p-6">
                <div className="flex items-center gap-3">
                  <AlertCircle className="h-6 w-6 text-red-600" />
                  <div>
                    <h3 className="font-semibold text-red-800">
                      Error Loading Documents
                    </h3>
                    <p className="text-red-600 mt-1">
                      {documentsError instanceof Error
                        ? documentsError.message
                        : 'Unknown error occurred'}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : documents.length === 0 ? (
            <Card>
              <CardContent className="p-12 text-center">
                <Lock className="mx-auto h-16 w-16 text-gray-400 mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  No Confidential Documents
                </h3>
                <p className="text-gray-600 mb-6">
                  Upload your first confidential document to get started.
                </p>
                <Button
                  onClick={() => setUploadDialogOpen(true)}
                  className="bg-brand-primary hover:bg-brand-primary-dark"
                  data-testid="button-upload-first"
                >
                  <Upload className="w-4 h-4 mr-2" />
                  Upload Document
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
              {documents.map((document) => (
                <Card
                  key={document.id}
                  className="group transition-all duration-300 ease-in-out h-full flex flex-col bg-white border-0 shadow-[0_4px_12px_rgba(0,0,0,0.08),0_2px_4px_rgba(0,0,0,0.04),0_8px_24px_rgba(35,99,131,0.04)] hover:shadow-[0_12px_32px_rgba(0,0,0,0.12),0_4px_8px_rgba(0,0,0,0.08),0_16px_48px_rgba(35,99,131,0.08)] hover:-translate-y-2 rounded-lg overflow-hidden"
                  data-testid={`card-document-${document.id}`}
                >
                  <CardHeader className="pb-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className="p-2 bg-red-100 rounded-lg">
                          <Lock className="h-6 w-6 text-red-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <CardTitle className="text-lg font-semibold text-gray-900 truncate">
                            {document.originalName || document.fileName}
                          </CardTitle>
                          <CardDescription className="text-sm text-gray-500 mt-1">
                            Confidential Document
                          </CardDescription>
                        </div>
                      </div>
                      <Badge
                        variant="secondary"
                        className="text-xs bg-red-100 text-red-800 shrink-0"
                      >
                        <Lock className="w-3 h-3 mr-1" />
                        Restricted
                      </Badge>
                    </div>
                  </CardHeader>

                  <CardContent className="flex-1 flex flex-col">
                    {/* Document Details */}
                    <div className="space-y-3 flex-1">
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <Calendar className="h-4 w-4" />
                        <span>
                          Uploaded {formatDate(document.uploadedAt.toString())}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <User className="h-4 w-4" />
                        <span>By {document.uploadedBy}</span>
                      </div>

                      {/* Access List */}
                      <div>
                        <button
                          onClick={() => toggleAccessExpanded(document.id)}
                          className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2 hover:text-brand-primary transition-colors w-full text-left"
                          data-testid={`button-toggle-access-${document.id}`}
                        >
                          <Users className="h-4 w-4" />
                          <span>Allowed Access ({document.allowedEmails.length})</span>
                          {expandedAccess[document.id] ? (
                            <ChevronUp className="h-4 w-4 ml-auto" />
                          ) : (
                            <ChevronDown className="h-4 w-4 ml-auto" />
                          )}
                        </button>
                        {expandedAccess[document.id] && (
                          <div className="space-y-1">
                            {document.allowedEmails.map((email: string, index: number) => (
                              <div
                                key={index}
                                className="text-xs bg-gray-100 px-2 py-1 rounded-md font-mono"
                              >
                                {email}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    <Separator className="my-4" />

                    {/* Actions */}
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDownload(document)}
                        className="flex-1 border-brand-primary text-brand-primary hover:bg-brand-primary hover:text-white"
                        data-testid={`button-download-${document.id}`}
                      >
                        <Download className="w-4 h-4 mr-1" />
                        Download
                      </Button>

                      {canDeleteDocument(document) && (
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="outline"
                              size="sm"
                              className="border-red-300 text-red-600 hover:bg-red-600 hover:text-white"
                              data-testid={`button-delete-${document.id}`}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete Document</AlertDialogTitle>
                              <AlertDialogDescription>
                                Are you sure you want to delete "
                                {document.originalName || document.fileName}"?
                                This action cannot be undone and will remove
                                access for all authorized users.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel data-testid="button-cancel-delete">
                                Cancel
                              </AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleDelete(document)}
                                className="bg-red-600 hover:bg-red-700"
                                disabled={deleteMutation.isPending}
                                data-testid="button-confirm-delete"
                              >
                                {deleteMutation.isPending ? (
                                  <>
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                    Deleting...
                                  </>
                                ) : (
                                  'Delete Document'
                                )}
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}