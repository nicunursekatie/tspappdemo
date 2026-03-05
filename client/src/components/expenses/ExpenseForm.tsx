import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Upload, Loader2, FileText, X } from 'lucide-react';
import { logger } from '@/lib/logger';

const expenseFormSchema = z.object({
  description: z.string().min(1, 'Description is required'),
  amount: z.string().regex(/^\d+(\.\d{1,2})?$/, 'Invalid amount format'),
  category: z.enum(['food', 'supplies', 'transport', 'reimbursement', 'other']).optional(),
  vendor: z.string().optional(),
  purchaseDate: z.string().optional(),
  notes: z.string().optional(),
  contextType: z.enum(['event', 'project', 'general']).optional(),
  contextId: z.string().optional(),
});

type ExpenseFormData = z.infer<typeof expenseFormSchema>;

interface ExpenseFormProps {
  contextType?: 'event' | 'project' | 'general';
  contextId?: number;
  onSuccess?: () => void;
  onCancel?: () => void;
}

export function ExpenseForm({
  contextType,
  contextId,
  onSuccess,
  onCancel,
}: ExpenseFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const { toast } = useToast();

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
  } = useForm<ExpenseFormData>({
    resolver: zodResolver(expenseFormSchema),
    defaultValues: {
      contextType: contextType || 'general',
      contextId: contextId?.toString(),
      category: 'other',
    },
  });

  const categoryValue = watch('category');

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file size (10MB limit)
    if (file.size > 10 * 1024 * 1024) {
      toast({
        title: 'File too large',
        description: 'Receipt must be smaller than 10MB',
        variant: 'destructive',
      });
      return;
    }

    // Validate file type
    const allowedTypes = [
      'application/pdf',
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/gif',
      'image/webp',
      'image/heic',
      'image/heif'
    ];
    if (!allowedTypes.includes(file.type)) {
      toast({
        title: 'Invalid file type',
        description: 'Please upload a PDF or image file (JPG, PNG, GIF, WEBP, HEIC)',
        variant: 'destructive',
      });
      return;
    }

    setSelectedFile(file);
  };

  const clearFile = () => {
    setSelectedFile(null);
    const fileInput = document.getElementById('receipt-file-input') as HTMLInputElement;
    if (fileInput) fileInput.value = '';
  };

  const onSubmit = async (data: ExpenseFormData) => {
    setIsSubmitting(true);
    try {
      // Create FormData for multipart upload
      const formData = new FormData();
      formData.append('description', data.description);
      formData.append('amount', data.amount);
      if (data.category) formData.append('category', data.category);
      if (data.vendor) formData.append('vendor', data.vendor);
      if (data.purchaseDate) formData.append('purchaseDate', new Date(data.purchaseDate).toISOString());
      if (data.notes) formData.append('notes', data.notes);
      if (data.contextType) formData.append('contextType', data.contextType);
      if (data.contextId) formData.append('contextId', data.contextId);
      if (selectedFile) formData.append('receipt', selectedFile);

      const response = await fetch('/api/expenses', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create expense');
      }

      const expense = await response.json();

      toast({
        title: 'Expense created',
        description: 'Expense and receipt uploaded successfully',
      });

      logger.info('Expense created successfully', { expenseId: expense.id });
      onSuccess?.();
    } catch (error) {
      logger.error('Error creating expense', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to create expense',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="description">Description *</Label>
        <Textarea
          id="description"
          placeholder="What was this expense for?"
          {...register('description')}
          className={errors.description ? 'border-red-500' : ''}
        />
        {errors.description && (
          <p className="text-sm text-red-500">{errors.description.message}</p>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="amount">Amount ($) *</Label>
          <Input
            id="amount"
            type="text"
            placeholder="0.00"
            {...register('amount')}
            className={errors.amount ? 'border-red-500' : ''}
          />
          {errors.amount && (
            <p className="text-sm text-red-500">{errors.amount.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="category">Category</Label>
          <Select
            value={categoryValue}
            onValueChange={(value) => setValue('category', value as any)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="food">Food</SelectItem>
              <SelectItem value="supplies">Supplies</SelectItem>
              <SelectItem value="transport">Transport</SelectItem>
              <SelectItem value="reimbursement">Reimbursement</SelectItem>
              <SelectItem value="other">Other</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="vendor">Vendor</Label>
          <Input
            id="vendor"
            type="text"
            placeholder="Where was this purchased?"
            {...register('vendor')}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="purchaseDate">Purchase Date</Label>
          <Input
            id="purchaseDate"
            type="date"
            {...register('purchaseDate')}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="notes">Notes</Label>
        <Textarea
          id="notes"
          placeholder="Additional notes or details..."
          {...register('notes')}
        />
      </div>

      {/* Receipt Upload */}
      <div className="space-y-2">
        <Label htmlFor="receipt">Receipt</Label>
        <div className="flex items-center gap-2">
          <input
            type="file"
            id="receipt-file-input"
            accept=".pdf,.jpg,.jpeg,.png,.gif,.webp,.heic,.heif"
            onChange={handleFileSelect}
            className="hidden"
          />
          <Button
            type="button"
            variant="outline"
            onClick={() => document.getElementById('receipt-file-input')?.click()}
            className="flex-1"
          >
            <Upload className="w-4 h-4 mr-2" />
            {selectedFile ? 'Change Receipt' : 'Upload Receipt'}
          </Button>
        </div>
        {selectedFile && (
          <div className="flex items-center gap-2 p-2 bg-secondary rounded-md">
            <FileText className="w-4 h-4" />
            <span className="text-sm flex-1 truncate">{selectedFile.name}</span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={clearFile}
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        )}
        <p className="text-xs text-muted-foreground">
          PDF or image files (JPG, PNG, GIF, WEBP, HEIC) up to 10MB
        </p>
      </div>

      {/* Form Actions */}
      <div className="flex gap-2 pt-4">
        <Button
          type="submit"
          disabled={isSubmitting}
          className="flex-1"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Creating...
            </>
          ) : (
            'Create Expense'
          )}
        </Button>
        {onCancel && (
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
        )}
      </div>
    </form>
  );
}
