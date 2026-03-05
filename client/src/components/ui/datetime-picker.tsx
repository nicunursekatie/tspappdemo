import * as React from 'react';
import { CalendarIcon, Clock } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { formatTime12Hour } from '@/components/event-requests/utils';
import { logger } from '@/lib/logger';

interface DateTimePickerProps {
  value?: string; // ISO string or datetime value
  onChange?: (value: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  minDate?: Date; // Minimum selectable date
  maxDate?: Date; // Maximum selectable date
  defaultToEventDate?: string; // Default date (e.g., event date)
  'data-testid'?: string;
}

export function DateTimePicker({
  value,
  onChange,
  placeholder = "Select date and time",
  className,
  disabled = false,
  minDate,
  maxDate,
  defaultToEventDate,
  'data-testid': testId,
}: DateTimePickerProps) {
  const [selectedDate, setSelectedDate] = React.useState<Date>();
  const [selectedTime, setSelectedTime] = React.useState<string>('');
  const [isOpen, setIsOpen] = React.useState(false);

  // Parse the input value and set initial state
  React.useEffect(() => {
    if (value) {
      try {
        const date = new Date(value);
        if (!isNaN(date.getTime())) {
          setSelectedDate(date);
          // Format time for HTML5 time input (HH:mm)
          const hours = date.getHours().toString().padStart(2, '0');
          const minutes = date.getMinutes().toString().padStart(2, '0');
          setSelectedTime(`${hours}:${minutes}`);
        }
      } catch (error) {
        logger.warn('Invalid datetime value:', value);
      }
    } else {
      // If no value but we have a default event date, use that for the date
      if (defaultToEventDate) {
        try {
          const defaultDate = new Date(defaultToEventDate);
          if (!isNaN(defaultDate.getTime())) {
            setSelectedDate(defaultDate);
          }
        } catch (error) {
          logger.warn('Invalid default event date:', defaultToEventDate);
        }
      }
    }
  }, [value, defaultToEventDate]);

  // Handle date selection
  const handleDateSelect = (date: Date | undefined) => {
    setSelectedDate(date);
    if (date && selectedTime) {
      // Combine date and time - create local datetime string without timezone conversion
      const [hours, minutes] = selectedTime.split(':');
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const localDateTime = `${year}-${month}-${day}T${hours}:${minutes}:00`;
      onChange?.(localDateTime);
    }
  };

  // Handle time change
  const handleTimeChange = (time: string) => {
    setSelectedTime(time);
    if (selectedDate && time) {
      // Combine date and time - create local datetime string without timezone conversion
      const [hours, minutes] = time.split(':');
      const year = selectedDate.getFullYear();
      const month = String(selectedDate.getMonth() + 1).padStart(2, '0');
      const day = String(selectedDate.getDate()).padStart(2, '0');
      const localDateTime = `${year}-${month}-${day}T${hours}:${minutes}:00`;
      onChange?.(localDateTime);
    }
  };

  // Clear the selection
  const handleClear = () => {
    setSelectedDate(undefined);
    setSelectedTime('');
    onChange?.('');
  };

  // Format display text
  const getDisplayText = () => {
    if (!selectedDate) return placeholder;
    
    const dateStr = format(selectedDate, 'MMM dd, yyyy');
    const timeStr = selectedTime ? formatTime12Hour(selectedTime) : '';
    
    if (timeStr) {
      return `${dateStr} at ${timeStr}`;
    }
    return dateStr;
  };

  // Validate if the selected datetime is valid according to constraints
  const isValidSelection = () => {
    if (!selectedDate || !selectedTime) return true; // Allow partial selection
    
    const combinedDateTime = new Date(selectedDate);
    const [hours, minutes] = selectedTime.split(':');
    combinedDateTime.setHours(parseInt(hours), parseInt(minutes), 0, 0);
    
    if (minDate && combinedDateTime < minDate) return false;
    if (maxDate && combinedDateTime > maxDate) return false;
    
    return true;
  };

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className={cn(
              'w-full justify-start text-left font-normal',
              !selectedDate && 'text-muted-foreground'
            )}
            disabled={disabled}
            data-testid={testId}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {getDisplayText()}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <div className="p-4 space-y-4">
            {/* Date Selection */}
            <div>
              <label className="text-sm font-medium mb-2 block">Select Date</label>
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={handleDateSelect}
                disabled={(date) => {
                  if (disabled) return true;
                  if (minDate && date < minDate) return true;
                  if (maxDate && date > maxDate) return true;
                  return false;
                }}
                initialFocus
              />
            </div>
            
            {/* Time Selection */}
            <div>
              <label className="text-sm font-medium mb-2 block">
                <Clock className="inline w-4 h-4 mr-1" />
                Select Time
              </label>
              <Input
                type="time"
                value={selectedTime}
                onChange={(e) => handleTimeChange(e.target.value)}
                className="w-full"
                disabled={disabled}
                data-testid={testId ? `${testId}-time` : undefined}
              />
            </div>

            {/* Validation message */}
            {!isValidSelection() && (
              <div className="text-sm text-red-600">
                Selected time is outside the allowed range
              </div>
            )}

            {/* Action buttons */}
            <div className="flex gap-2 pt-2">
              <Button
                size="sm"
                onClick={() => setIsOpen(false)}
                disabled={!isValidSelection()}
                className="flex-1"
              >
                Done
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={handleClear}
                className="flex-1"
              >
                Clear
              </Button>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}

DateTimePicker.displayName = 'DateTimePicker';