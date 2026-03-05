import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Save, X } from 'lucide-react';

export interface Recipient {
  id: number;
  name: string;
}

interface RecipientSelectorProps {
  // Controlled component props
  value?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  className?: string;
  
  // Inline editing mode props
  isInlineEditing?: boolean;
  onSave?: () => void;
  onCancel?: () => void;
  
  // Other props
  disabled?: boolean;
  autoFocus?: boolean;
  'data-testid'?: string;
}

export const RecipientSelector: React.FC<RecipientSelectorProps> = ({
  value = '',
  onChange,
  placeholder = "Select recipient organization...",
  className = '',
  isInlineEditing = false,
  onSave,
  onCancel,
  disabled = false,
  autoFocus = false,
  'data-testid': testId,
}) => {
  const [selectedOption, setSelectedOption] = useState<string>('');
  const [customValue, setCustomValue] = useState<string>('');
  const [internalValue, setInternalValue] = useState<string>(value);

  // Fetch recipients from the API
  const {
    data: recipients = [],
    isLoading,
    error,
  } = useQuery<Recipient[]>({
    queryKey: ['/api/recipients'],
    staleTime: 10 * 60 * 1000, // 10 minutes
  });

  // Initialize state based on current value
  useEffect(() => {
    if (value !== undefined) {
      setInternalValue(value);
      
      // Check if current value matches any recipient
      const matchingRecipient = recipients.find(r => r.name === value);
      if (matchingRecipient) {
        setSelectedOption(value);
        setCustomValue('');
      } else if (value) {
        setSelectedOption('custom');
        setCustomValue(value);
      } else {
        setSelectedOption('');
        setCustomValue('');
      }
    }
  }, [value, recipients]);

  // Handle controlled component updates
  const handleValueChange = (newValue: string) => {
    setInternalValue(newValue);
    if (onChange) {
      onChange(newValue);
    }
  };

  // Handle select dropdown change
  const handleSelectChange = (newOption: string) => {
    setSelectedOption(newOption);
    
    if (newOption === 'custom') {
      // Keep existing custom value or clear if no current value
      const currentCustom = selectedOption === 'custom' ? customValue : '';
      setCustomValue(currentCustom);
      // In inline editing mode, immediately update parent state with current custom value
      handleValueChange(currentCustom);
    } else if (newOption) {
      // Selected a recipient from dropdown
      setCustomValue('');
      // Immediately update parent state with selected recipient name
      handleValueChange(newOption);
    } else {
      // Empty selection
      setCustomValue('');
      // Immediately update parent state with empty value
      handleValueChange('');
    }
  };

  // Handle custom input change
  const handleCustomChange = (newCustomValue: string) => {
    setCustomValue(newCustomValue);
    // Immediately update parent state with custom value
    handleValueChange(newCustomValue);
  };

  // Handle save for inline editing
  const handleSave = () => {
    // Parent state is already updated via onChange calls in handleSelectChange/handleCustomChange
    // Just trigger the save callback to complete the inline editing process
    if (onSave) {
      onSave();
    }
  };

  // Handle cancel for inline editing
  const handleCancel = () => {
    // Reset to original value
    setInternalValue(value);
    const matchingRecipient = recipients.find(r => r.name === value);
    if (matchingRecipient) {
      setSelectedOption(value);
      setCustomValue('');
    } else if (value) {
      setSelectedOption('custom');
      setCustomValue(value);
    } else {
      setSelectedOption('');
      setCustomValue('');
    }
    
    if (onCancel) {
      onCancel();
    }
  };

  // For controlled component mode (not inline editing)
  if (!isInlineEditing) {
    return (
      <div className={`space-y-2 ${className}`} data-testid={testId}>
        <Select 
          value={selectedOption} 
          onValueChange={handleSelectChange}
          disabled={disabled || isLoading}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder={isLoading ? "Loading recipients..." : placeholder} />
          </SelectTrigger>
          <SelectContent>
            {error && (
              <SelectItem value="error" disabled>
                Error loading recipients
              </SelectItem>
            )}
            {!error && recipients.length === 0 && !isLoading && (
              <SelectItem value="no-recipients" disabled>
                No recipients available
              </SelectItem>
            )}
            {recipients.map((recipient) => (
              <SelectItem key={recipient.id} value={recipient.name}>
                {recipient.name}
              </SelectItem>
            ))}
            <SelectItem value="custom">Custom destination...</SelectItem>
          </SelectContent>
        </Select>
        
        {selectedOption === 'custom' && (
          <Input
            type="text"
            placeholder="Enter custom destination..."
            value={customValue}
            onChange={(e) => handleCustomChange(e.target.value)}
            disabled={disabled}
            className="w-full"
            data-testid={testId ? `${testId}-custom-input` : undefined}
          />
        )}
      </div>
    );
  }

  // For inline editing mode
  return (
    <div className={`space-y-2 ${className}`} data-testid={testId}>
      <select
        value={selectedOption}
        onChange={(e) => handleSelectChange(e.target.value)}
        className="h-8 px-2 border border-gray-300 rounded text-sm w-full"
        autoFocus={autoFocus}
        disabled={disabled || isLoading}
        data-testid={testId ? `${testId}-select` : undefined}
      >
        <option value="">
          {isLoading ? "Loading recipients..." : placeholder}
        </option>
        {error && <option disabled>Error loading recipients</option>}
        {recipients.map((recipient) => (
          <option key={recipient.id} value={recipient.name}>
            {recipient.name}
          </option>
        ))}
        <option value="custom">Custom destination...</option>
      </select>
      
      {selectedOption === 'custom' && (
        <Input
          type="text"
          placeholder="Enter custom destination..."
          value={customValue}
          onChange={(e) => handleCustomChange(e.target.value)}
          disabled={disabled}
          className="h-8 w-full"
          data-testid={testId ? `${testId}-custom-input` : undefined}
        />
      )}
      
      <div className="flex gap-2">
        <Button size="sm" onClick={handleSave} disabled={disabled}>
          <Save className="w-3 h-3 mr-1" />
          Save
        </Button>
        <Button size="sm" variant="ghost" onClick={handleCancel} disabled={disabled}>
          <X className="w-3 h-3 mr-1" />
          Cancel
        </Button>
      </div>
    </div>
  );
};

export default RecipientSelector;