/**
 * BackupContactSection - Secondary/Backup Contact Information
 *
 * Collapsible section for managing backup contact details in the event scheduling form.
 * Extracted from EventSchedulingForm.tsx for better organization.
 */

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ChevronDown } from 'lucide-react';
import type { FormSectionProps } from './types';

interface BackupContactSectionProps extends FormSectionProps {
  /** Whether section is expanded */
  isExpanded: boolean;
  /** Toggle section expansion */
  onToggle: () => void;
}

export const BackupContactSection: React.FC<BackupContactSectionProps> = ({
  formData,
  setFormData,
  isExpanded,
  onToggle,
}) => {
  return (
    <div className="border rounded-lg">
      <Button
        type="button"
        variant="ghost"
        className="w-full flex justify-between items-center p-4"
        onClick={onToggle}
      >
        <span className="font-semibold text-sm text-gray-700">
          Backup/Secondary Contact (Optional)
        </span>
        <ChevronDown className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
      </Button>

      {isExpanded && (
        <div className="p-4 border-t bg-gray-50 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="backupFirstName" className="text-sm">First Name</Label>
            <Input
              id="backupFirstName"
              value={formData.backupContactFirstName || ''}
              onChange={(e) => setFormData(prev => ({ ...prev, backupContactFirstName: e.target.value }))}
              placeholder="Enter first name"
            />
          </div>
          <div>
            <Label htmlFor="backupLastName" className="text-sm">Last Name</Label>
            <Input
              id="backupLastName"
              value={formData.backupContactLastName || ''}
              onChange={(e) => setFormData(prev => ({ ...prev, backupContactLastName: e.target.value }))}
              placeholder="Enter last name"
            />
          </div>
          <div>
            <Label htmlFor="backupEmail" className="text-sm">Email</Label>
            <Input
              id="backupEmail"
              type="email"
              value={formData.backupContactEmail || ''}
              onChange={(e) => setFormData(prev => ({ ...prev, backupContactEmail: e.target.value }))}
              placeholder="Enter email address"
            />
          </div>
          <div>
            <Label htmlFor="backupPhone" className="text-sm">Phone</Label>
            <Input
              id="backupPhone"
              value={formData.backupContactPhone || ''}
              onChange={(e) => setFormData(prev => ({ ...prev, backupContactPhone: e.target.value }))}
              placeholder="Enter phone number"
            />
          </div>
          <div className="md:col-span-2">
            <Label htmlFor="backupRole" className="text-sm">Role/Title</Label>
            <Input
              id="backupRole"
              value={formData.backupContactRole || ''}
              onChange={(e) => setFormData(prev => ({ ...prev, backupContactRole: e.target.value }))}
              placeholder="e.g., Assistant Principal, Events Coordinator"
            />
          </div>
        </div>
      )}
    </div>
  );
};
