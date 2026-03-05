import { useState, useCallback } from 'react';
import type { Recipient } from '@shared/schema';

// Default empty form state
export const getDefaultRecipientForm = () => ({
  name: '',
  phone: '',
  email: '',
  website: '',
  instagramHandle: '',
  address: '',
  region: '',
  preferences: '',
  status: 'active' as const,
  contactPersonName: '',
  contactPersonPhone: '',
  contactPersonEmail: '',
  contactPersonRole: '',
  secondContactPersonName: '',
  secondContactPersonPhone: '',
  secondContactPersonEmail: '',
  secondContactPersonRole: '',
  reportingGroup: '',
  estimatedSandwiches: '',
  sandwichType: '',
  focusAreas: [] as string[],
  tspContact: '',
  tspContactUserId: '',
  contractSigned: false,
  contractSignedDate: '',
  collectionDay: '',
  collectionTime: '',
  feedingDay: '',
  feedingTime: '',
  hasSharedPost: false,
  sharedPostDate: '',
  averagePeopleServed: '',
  peopleServedFrequency: '',
  partnershipStartDate: '',
  partnershipYears: '',
  receivingFruit: false,
  receivingSnacks: false,
  wantsFruit: false,
  wantsSnacks: false,
  fruitSnacksNotes: '',
  hasSeasonalChanges: false,
  seasonalChangesDescription: '',
  summerNeeds: '',
  winterNeeds: '',
  preferredContactMethods: [] as string[],
  allowedContactMethods: [] as string[],
  doNotContact: false,
  contactMethodNotes: '',
  impactStories: [] as Array<{ story: string; date: string; source: string }>,
});

export type RecipientFormData = ReturnType<typeof getDefaultRecipientForm>;

// Section open/close state
export const getDefaultSectionState = (prefix: string = '') => ({
  [`${prefix}basicInfo`]: true,
  [`${prefix}contact`]: true,
  [`${prefix}secondContact`]: false,
  [`${prefix}operational`]: false,
  [`${prefix}socialMedia`]: false,
  [`${prefix}peopleServed`]: false,
  [`${prefix}partnership`]: false,
  [`${prefix}fruitSnacks`]: false,
  [`${prefix}seasonalChanges`]: false,
  [`${prefix}communicationPreferences`]: false,
  [`${prefix}impactStories`]: false,
});

export type SectionState = Record<string, boolean>;

interface UseRecipientFormOptions {
  initialData?: Partial<RecipientFormData> | Recipient | null;
  mode: 'add' | 'edit';
}

export function useRecipientForm({ initialData, mode }: UseRecipientFormOptions) {
  // Normalize recipient data when editing
  const normalizeRecipient = useCallback((recipient: Partial<RecipientFormData> | Recipient | null): RecipientFormData => {
    if (!recipient) return getDefaultRecipientForm();

    // Handle focusAreas - support both array and legacy string
    let focusAreas: string[] = [];
    if (Array.isArray((recipient as any).focusAreas) && (recipient as any).focusAreas.length > 0) {
      focusAreas = (recipient as any).focusAreas;
    } else if ((recipient as any).focusArea && typeof (recipient as any).focusArea === 'string') {
      focusAreas = [(recipient as any).focusArea];
    }

    // Handle preferredContactMethods - support both array and legacy string
    let preferredContactMethods: string[] = [];
    if (Array.isArray((recipient as any).preferredContactMethods) && (recipient as any).preferredContactMethods.length > 0) {
      preferredContactMethods = (recipient as any).preferredContactMethods;
    } else if ((recipient as any).preferredContactMethod && typeof (recipient as any).preferredContactMethod === 'string') {
      preferredContactMethods = [(recipient as any).preferredContactMethod];
    }

    return {
      ...getDefaultRecipientForm(),
      ...recipient,
      focusAreas,
      preferredContactMethods,
      allowedContactMethods: Array.isArray((recipient as any).allowedContactMethods)
        ? (recipient as any).allowedContactMethods
        : ['text', 'email'],
      impactStories: Array.isArray((recipient as any).impactStories)
        ? (recipient as any).impactStories
        : [],
      // Convert numeric fields to strings for form inputs
      estimatedSandwiches: (recipient as any).estimatedSandwiches?.toString() || '',
      averagePeopleServed: (recipient as any).averagePeopleServed?.toString() || '',
      partnershipYears: (recipient as any).partnershipYears?.toString() || '',
      // Convert date fields to strings for form inputs
      contractSignedDate: (recipient as any).contractSignedDate
        ? new Date((recipient as any).contractSignedDate).toISOString().split('T')[0]
        : '',
      partnershipStartDate: (recipient as any).partnershipStartDate
        ? new Date((recipient as any).partnershipStartDate).toISOString().split('T')[0]
        : '',
      sharedPostDate: (recipient as any).sharedPostDate
        ? new Date((recipient as any).sharedPostDate).toISOString().split('T')[0]
        : '',
    };
  }, []);

  const [formData, setFormData] = useState<RecipientFormData>(() =>
    normalizeRecipient(initialData)
  );

  const sectionPrefix = mode === 'edit' ? 'edit' : '';
  const [sections, setSections] = useState<SectionState>(() =>
    getDefaultSectionState(sectionPrefix)
  );

  // Update a single field
  const updateField = useCallback(<K extends keyof RecipientFormData>(
    field: K,
    value: RecipientFormData[K]
  ) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  }, []);

  // Update multiple fields at once
  const updateFields = useCallback((updates: Partial<RecipientFormData>) => {
    setFormData(prev => ({ ...prev, ...updates }));
  }, []);

  // Toggle a section open/close
  const updateSection = useCallback((section: string, open: boolean) => {
    setSections(prev => ({ ...prev, [section]: open }));
  }, []);

  // Reset form to initial state
  const resetForm = useCallback(() => {
    setFormData(getDefaultRecipientForm());
  }, []);

  // Set form data from a recipient (for editing)
  const setRecipient = useCallback((recipient: Recipient | null) => {
    setFormData(normalizeRecipient(recipient));
  }, [normalizeRecipient]);

  // Prepare data for submission (convert types)
  const prepareSubmissionData = useCallback(() => {
    return {
      ...formData,
      // Ensure website has protocol
      website: formData.website && !formData.website.startsWith('http://') && !formData.website.startsWith('https://')
        ? `https://${formData.website}`
        : formData.website,
      // Convert string fields to appropriate types
      estimatedSandwiches: formData.estimatedSandwiches
        ? parseInt(formData.estimatedSandwiches, 10)
        : null,
      contractSignedDate: formData.contractSignedDate
        ? new Date(formData.contractSignedDate)
        : null,
      sharedPostDate: formData.sharedPostDate
        ? new Date(formData.sharedPostDate)
        : null,
      averagePeopleServed: formData.averagePeopleServed
        ? parseInt(formData.averagePeopleServed, 10)
        : null,
      partnershipStartDate: formData.partnershipStartDate
        ? new Date(formData.partnershipStartDate)
        : null,
      partnershipYears: formData.partnershipYears
        ? parseInt(formData.partnershipYears, 10)
        : null,
    };
  }, [formData]);

  // Validate required fields
  const validate = useCallback((): { valid: boolean; errors: string[] } => {
    const errors: string[] = [];
    if (!formData.name) {
      errors.push('Name is required');
    }
    return { valid: errors.length === 0, errors };
  }, [formData]);

  return {
    formData,
    setFormData,
    sections,
    updateField,
    updateFields,
    updateSection,
    resetForm,
    setRecipient,
    prepareSubmissionData,
    validate,
    sectionPrefix,
  };
}
