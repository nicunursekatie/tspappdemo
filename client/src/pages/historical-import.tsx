import { useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { useActivityTracker } from '@/hooks/useActivityTracker';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import {
  Upload,
  Download,
  FileSpreadsheet,
  CheckCircle,
  XCircle,
  AlertCircle,
  ArrowRight,
  Eye,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { invalidateEventRequestQueries } from '@/lib/queryClient';

interface ImportResult {
  success: boolean;
  totalRows: number;
  imported: number;
  skipped: number;
  errors: Array<{
    row: number;
    data: any;
    error: string;
  }>;
  summary: {
    newOrganizations: string[];
    updatedOrganizations: string[];
    totalSandwiches: number;
  };
}

interface PreviewData {
  totalRows: number;
  preview: any[];
  columns: string[];
}

export default function HistoricalImport() {
  const { trackView, trackFormSubmit } = useActivityTracker();
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    trackView(
      'Data Management',
      'Data Management',
      'Historical Import',
      'User accessed historical import page'
    );
  }, [trackView]);
  const queryClient = useQueryClient();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];

      // Validate file type
      const validTypes = [
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      ];

      if (!validTypes.includes(selectedFile.type)) {
        toast({
          title: 'Invalid File',
          description: 'Please upload an Excel file (.xls or .xlsx)',
          variant: 'destructive',
        });
        return;
      }

      setFile(selectedFile);
      setPreview(null);
      setResult(null);
    }
  };

  const handlePreview = async () => {
    if (!file) return;

    setUploading(true);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/sandwich-collections/historical-import/preview', {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to preview file');
      }

      const data = await response.json();
      setPreview(data);

      toast({
        title: 'Preview Loaded',
        description: `Found ${data.totalRows} rows in the Excel file`,
      });
    } catch (error) {
      toast({
        title: 'Preview Failed',
        description: error instanceof Error ? error.message : 'Failed to preview file',
        variant: 'destructive',
      });
    } finally {
      setUploading(false);
    }
  };

  const handleUpload = async () => {
    if (!file) return;

    setUploading(true);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/sandwich-collections/historical-import/upload', {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to upload file');
      }

      const data = await response.json();
      setResult(data.result);

      // Invalidate relevant queries
      invalidateEventRequestQueries(queryClient);
      queryClient.invalidateQueries({ queryKey: ['/api/recipients'] });
      queryClient.invalidateQueries({ queryKey: ['/api/groups-catalog'] });

      toast({
        title: 'Import Complete',
        description: data.message,
      });
    } catch (error) {
      toast({
        title: 'Upload Failed',
        description: error instanceof Error ? error.message : 'Failed to upload file',
        variant: 'destructive',
      });
    } finally {
      setUploading(false);
    }
  };

  const downloadTemplate = async () => {
    try {
      const response = await fetch('/api/sandwich-collections/historical-import/template', {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to download template');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'historical-events-template.xlsx';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast({
        title: 'Template Downloaded',
        description: 'Excel template has been downloaded successfully',
      });
    } catch (error) {
      toast({
        title: 'Download Failed',
        description: 'Failed to download template',
        variant: 'destructive',
      });
    }
  };

  const resetImport = () => {
    setFile(null);
    setPreview(null);
    setResult(null);
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="bg-gradient-to-r from-teal-600 to-cyan-600 text-white rounded-lg shadow-lg">
          <div className="p-8">
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <FileSpreadsheet className="h-8 w-8" />
              Historical Events Import
            </h1>
            <p className="text-teal-100 mt-2">
              Import historical group event records from Excel spreadsheets
            </p>
          </div>
        </div>

        {/* Instructions */}
        <Card>
          <CardHeader>
            <CardTitle>How It Works</CardTitle>
            <CardDescription>
              Follow these steps to import your historical event records
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="flex flex-col items-center text-center space-y-2">
                <div className="rounded-full bg-blue-100 p-3">
                  <Download className="h-6 w-6 text-blue-600" />
                </div>
                <h3 className="font-semibold">1. Download Template</h3>
                <p className="text-sm text-gray-600">
                  Get the Excel template with the correct column format
                </p>
              </div>
              <div className="flex flex-col items-center text-center space-y-2">
                <div className="rounded-full bg-purple-100 p-3">
                  <FileSpreadsheet className="h-6 w-6 text-purple-600" />
                </div>
                <h3 className="font-semibold">2. Fill In Data</h3>
                <p className="text-sm text-gray-600">
                  Add your historical event records to the template
                </p>
              </div>
              <div className="flex flex-col items-center text-center space-y-2">
                <div className="rounded-full bg-green-100 p-3">
                  <Upload className="h-6 w-6 text-green-600" />
                </div>
                <h3 className="font-semibold">3. Upload File</h3>
                <p className="text-sm text-gray-600">
                  Import the data into the system
                </p>
              </div>
            </div>

            <div className="mt-6">
              <Button
                onClick={downloadTemplate}
                variant="outline"
                className="w-full sm:w-auto"
              >
                <Download className="h-4 w-4 mr-2" />
                Download Excel Template
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Import Section */}
        {!result && (
          <Card>
            <CardHeader>
              <CardTitle>Upload Historical Records</CardTitle>
              <CardDescription>
                Select your completed Excel file to import historical event data
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="file">Excel File</Label>
                <div className="flex gap-2">
                  <Input
                    id="file"
                    type="file"
                    accept=".xls,.xlsx"
                    onChange={handleFileChange}
                    disabled={uploading}
                  />
                </div>
                {file && (
                  <p className="text-sm text-gray-600">
                    Selected: {file.name} ({(file.size / 1024).toFixed(2)} KB)
                  </p>
                )}
              </div>

              {file && !preview && (
                <div className="flex gap-2">
                  <Button
                    onClick={handlePreview}
                    disabled={uploading}
                    variant="outline"
                  >
                    <Eye className="h-4 w-4 mr-2" />
                    Preview Data
                  </Button>
                </div>
              )}

              {preview && (
                <div className="space-y-4">
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Data Preview</AlertTitle>
                    <AlertDescription>
                      Found {preview.totalRows} rows. Showing first{' '}
                      {Math.min(10, preview.totalRows)} for preview.
                    </AlertDescription>
                  </Alert>

                  <div className="border rounded-lg overflow-auto max-h-96">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          {preview.columns.map((col) => (
                            <TableHead key={col}>{col}</TableHead>
                          ))}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {preview.preview.map((row, idx) => (
                          <TableRow key={idx}>
                            {preview.columns.map((col) => (
                              <TableCell key={col}>
                                {row[col]?.toString() || '—'}
                              </TableCell>
                            ))}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>

                  <div className="flex gap-2">
                    <Button
                      onClick={handleUpload}
                      disabled={uploading}
                      className="bg-green-600 hover:bg-green-700"
                    >
                      {uploading ? (
                        <>Importing...</>
                      ) : (
                        <>
                          <Upload className="h-4 w-4 mr-2" />
                          Import {preview.totalRows} Records
                        </>
                      )}
                    </Button>
                    <Button
                      onClick={() => setPreview(null)}
                      variant="outline"
                      disabled={uploading}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              )}

              {uploading && (
                <div className="space-y-2">
                  <Progress value={undefined} className="h-2" />
                  <p className="text-sm text-center text-gray-600">
                    Processing your import...
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Results Section */}
        {result && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {result.success ? (
                  <CheckCircle className="h-6 w-6 text-green-600" />
                ) : (
                  <XCircle className="h-6 w-6 text-red-600" />
                )}
                Import {result.success ? 'Completed' : 'Completed with Errors'}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Summary Stats */}
              <div className="grid gap-4 md:grid-cols-4">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="text-2xl font-bold text-blue-700">
                    {result.totalRows}
                  </div>
                  <div className="text-sm text-blue-600">Total Rows</div>
                </div>
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <div className="text-2xl font-bold text-green-700">
                    {result.imported}
                  </div>
                  <div className="text-sm text-green-600">Imported</div>
                </div>
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <div className="text-2xl font-bold text-yellow-700">
                    {result.skipped}
                  </div>
                  <div className="text-sm text-yellow-600">Skipped</div>
                </div>
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <div className="text-2xl font-bold text-red-700">
                    {result.errors.length}
                  </div>
                  <div className="text-sm text-red-600">Errors</div>
                </div>
              </div>

              {/* Summary Details */}
              <div className="space-y-4">
                <div>
                  <h3 className="font-semibold mb-2">Import Summary</h3>
                  <div className="grid gap-2">
                    <div className="flex justify-between items-center p-3 bg-gray-50 rounded">
                      <span className="text-sm text-gray-700">New Organizations</span>
                      <Badge variant="secondary">
                        {result.summary.newOrganizations.length}
                      </Badge>
                    </div>
                    <div className="flex justify-between items-center p-3 bg-gray-50 rounded">
                      <span className="text-sm text-gray-700">Updated Organizations</span>
                      <Badge variant="secondary">
                        {result.summary.updatedOrganizations.length}
                      </Badge>
                    </div>
                    <div className="flex justify-between items-center p-3 bg-gray-50 rounded">
                      <span className="text-sm text-gray-700">Total Sandwiches</span>
                      <Badge variant="secondary">
                        {result.summary.totalSandwiches.toLocaleString()}
                      </Badge>
                    </div>
                  </div>
                </div>

                {result.summary.newOrganizations.length > 0 && (
                  <div>
                    <h3 className="font-semibold mb-2">New Organizations Created</h3>
                    <div className="flex flex-wrap gap-2">
                      {result.summary.newOrganizations.slice(0, 10).map((org, idx) => (
                        <Badge key={idx} variant="outline" className="bg-green-50">
                          {org}
                        </Badge>
                      ))}
                      {result.summary.newOrganizations.length > 10 && (
                        <Badge variant="outline">
                          +{result.summary.newOrganizations.length - 10} more
                        </Badge>
                      )}
                    </div>
                  </div>
                )}

                {/* Errors */}
                {result.errors.length > 0 && (
                  <div>
                    <h3 className="font-semibold mb-2 text-red-700">
                      Import Errors ({result.errors.length})
                    </h3>
                    <div className="border rounded-lg overflow-auto max-h-64">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Row</TableHead>
                            <TableHead>Error</TableHead>
                            <TableHead>Data</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {result.errors.slice(0, 20).map((error, idx) => (
                            <TableRow key={idx}>
                              <TableCell className="font-mono">
                                {error.row}
                              </TableCell>
                              <TableCell className="text-red-700">
                                {error.error}
                              </TableCell>
                              <TableCell className="text-xs text-gray-600">
                                {JSON.stringify(error.data).substring(0, 100)}...
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex gap-2">
                <Button onClick={resetImport}>
                  <Upload className="h-4 w-4 mr-2" />
                  Import Another File
                </Button>
                <Button
                  variant="outline"
                  onClick={() =>
                    (window.location.href = '/event-requests?status=completed')
                  }
                >
                  View Imported Events
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Information Card */}
        <Card>
          <CardHeader>
            <CardTitle>Import Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h3 className="font-semibold mb-2">Required Columns</h3>
              <ul className="list-disc list-inside text-sm text-gray-700 space-y-1">
                <li><strong>organizationName</strong> - Name of the organization (required)</li>
                <li><strong>eventDate</strong> - Date of the event (YYYY-MM-DD format)</li>
                <li><strong>sandwichesProvided</strong> - Number of sandwiches distributed</li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold mb-2">Optional Columns</h3>
              <ul className="list-disc list-inside text-sm text-gray-700 space-y-1">
                <li>contactName, contactEmail, contactPhone - Organization contact information</li>
                <li>department, location - Additional organizational details</li>
                <li>eventType - Type of event (defaults to "sandwich_distribution")</li>
                <li>status - Event status (defaults to "completed" for historical records)</li>
                <li>tspContact - TSP staff member who handled the event</li>
                <li>notes - Additional notes about the event</li>
              </ul>
            </div>
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Import Behavior</AlertTitle>
              <AlertDescription>
                <ul className="list-disc list-inside text-sm space-y-1 mt-2">
                  <li>Existing organizations will be matched by name and updated with new contact info</li>
                  <li>New organizations will be created automatically</li>
                  <li>Events will be added to the completed events category</li>
                  <li>All imported data will appear in the groups catalog</li>
                  <li>Historical records are marked as inactive by default</li>
                </ul>
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
