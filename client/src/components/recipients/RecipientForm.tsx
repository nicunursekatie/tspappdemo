import { useState } from 'react';
import { ChevronDown, ChevronRight, Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import type { RecipientFormData, SectionState } from '@/hooks/useRecipientForm';

interface RecipientFormProps {
  formData: RecipientFormData;
  sections: SectionState;
  onFieldChange: <K extends keyof RecipientFormData>(field: K, value: RecipientFormData[K]) => void;
  onSectionChange: (section: string, open: boolean) => void;
  mode: 'add' | 'edit';
  idPrefix?: string;
}

// Predefined focus areas
const FOCUS_AREAS = ['Youth', 'Veterans', 'Seniors', 'Families', 'Unhoused', 'Refugees', 'Disabilities', 'Other'];

// Contact methods
const CONTACT_METHODS = [
  { id: 'text', label: 'Text' },
  { id: 'email', label: 'Email' },
  { id: 'call', label: 'Call' },
  { id: 'whatsapp', label: 'WhatsApp' },
  { id: 'facebook', label: 'Facebook' },
];

export function RecipientForm({
  formData,
  sections,
  onFieldChange,
  onSectionChange,
  mode,
  idPrefix = '',
}: RecipientFormProps) {
  const [customFocusArea, setCustomFocusArea] = useState('');

  // Section keys depend on mode
  const sectionKey = (name: string) => mode === 'edit' ? `edit${name.charAt(0).toUpperCase()}${name.slice(1)}` : name;
  const inputId = (name: string) => idPrefix ? `${idPrefix}-${name}` : name;

  const toggleFocusArea = (area: string) => {
    const updated = formData.focusAreas.includes(area)
      ? formData.focusAreas.filter(a => a !== area)
      : [...formData.focusAreas, area];
    onFieldChange('focusAreas', updated);
  };

  const addCustomFocusArea = () => {
    const trimmed = customFocusArea.trim();
    if (trimmed && !formData.focusAreas.includes(trimmed)) {
      onFieldChange('focusAreas', [...formData.focusAreas, trimmed]);
      setCustomFocusArea('');
    }
  };

  const toggleContactMethod = (
    field: 'preferredContactMethods' | 'allowedContactMethods',
    method: string,
    checked: boolean
  ) => {
    const methods = checked
      ? [...formData[field], method]
      : formData[field].filter(m => m !== method);
    onFieldChange(field, methods);
  };

  const updateImpactStory = (index: number, updates: Partial<{ story: string; date: string; source: string }>) => {
    const updated = [...formData.impactStories];
    updated[index] = { ...updated[index], ...updates };
    onFieldChange('impactStories', updated);
  };

  const removeImpactStory = (index: number) => {
    const updated = formData.impactStories.filter((_, i) => i !== index);
    onFieldChange('impactStories', updated);
  };

  const addImpactStory = () => {
    onFieldChange('impactStories', [
      ...formData.impactStories,
      { story: '', date: '', source: '' }
    ]);
  };

  return (
    <div className="space-y-4">
      {/* Basic Information Section */}
      <Collapsible
        open={sections[sectionKey('basicInfo')]}
        onOpenChange={(open) => onSectionChange(sectionKey('basicInfo'), open)}
      >
        <div>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" className="w-full justify-between p-0 h-auto">
              <h4 className="font-medium text-sm text-slate-700">Basic Information</h4>
              {sections[sectionKey('basicInfo')] ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-3">
            <div className="space-y-4">
              <div>
                <Label htmlFor={inputId('name')}>Name *</Label>
                <Input
                  id={inputId('name')}
                  value={formData.name}
                  onChange={(e) => onFieldChange('name', e.target.value)}
                  placeholder="Enter recipient name"
                />
              </div>
              <div>
                <Label htmlFor={inputId('phone')}>Phone Number *</Label>
                <Input
                  id={inputId('phone')}
                  value={formData.phone}
                  onChange={(e) => onFieldChange('phone', e.target.value)}
                  placeholder="(555) 123-4567"
                />
              </div>
              <div>
                <Label htmlFor={inputId('email')}>Email</Label>
                <Input
                  id={inputId('email')}
                  type="email"
                  value={formData.email}
                  onChange={(e) => onFieldChange('email', e.target.value)}
                  placeholder="email@example.com"
                />
              </div>
              <div>
                <Label htmlFor={inputId('website')}>Website</Label>
                <Input
                  id={inputId('website')}
                  type="text"
                  value={formData.website}
                  onChange={(e) => onFieldChange('website', e.target.value)}
                  placeholder="www.organization.org or https://organization.org"
                />
              </div>
              <div>
                <Label htmlFor={inputId('instagramHandle')}>Instagram Handle</Label>
                <Input
                  id={inputId('instagramHandle')}
                  type="text"
                  value={formData.instagramHandle}
                  onChange={(e) => onFieldChange('instagramHandle', e.target.value)}
                  placeholder="@organizationhandle"
                />
              </div>
              <div>
                <Label htmlFor={inputId('address')}>Street Address</Label>
                <Input
                  id={inputId('address')}
                  value={formData.address}
                  onChange={(e) => onFieldChange('address', e.target.value)}
                  placeholder="123 Main St, City, State 12345"
                />
              </div>
              <div>
                <Label htmlFor={inputId('region')}>Region/Area</Label>
                <Input
                  id={inputId('region')}
                  value={formData.region}
                  onChange={(e) => onFieldChange('region', e.target.value)}
                  placeholder="Downtown, Sandy Springs, Buckhead, etc."
                />
              </div>
              <div>
                <Label htmlFor={inputId('preferences')}>Preferences</Label>
                <Input
                  id={inputId('preferences')}
                  value={formData.preferences}
                  onChange={(e) => onFieldChange('preferences', e.target.value)}
                  placeholder="Dietary restrictions or preferences"
                />
              </div>
            </div>
          </CollapsibleContent>
        </div>
      </Collapsible>

      {/* Contact Person Section */}
      <Collapsible
        open={sections[sectionKey('contact')]}
        onOpenChange={(open) => onSectionChange(sectionKey('contact'), open)}
      >
        <div className="border-t pt-4 mt-4">
          <CollapsibleTrigger asChild>
            <Button variant="ghost" className="w-full justify-between p-0 h-auto">
              <h4 className="font-medium text-sm text-slate-700">Contact Person Information</h4>
              {sections[sectionKey('contact')] ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor={inputId('contactPersonName')}>Contact Name</Label>
                <Input
                  id={inputId('contactPersonName')}
                  value={formData.contactPersonName}
                  onChange={(e) => onFieldChange('contactPersonName', e.target.value)}
                  placeholder="John Smith"
                />
              </div>
              <div>
                <Label htmlFor={inputId('contactPersonRole')}>Role/Title</Label>
                <Input
                  id={inputId('contactPersonRole')}
                  value={formData.contactPersonRole}
                  onChange={(e) => onFieldChange('contactPersonRole', e.target.value)}
                  placeholder="Manager, Director, etc."
                />
              </div>
              <div>
                <Label htmlFor={inputId('contactPersonPhone')}>Contact Phone</Label>
                <Input
                  id={inputId('contactPersonPhone')}
                  value={formData.contactPersonPhone}
                  onChange={(e) => onFieldChange('contactPersonPhone', e.target.value)}
                  placeholder="(555) 123-4567"
                />
              </div>
              <div>
                <Label htmlFor={inputId('contactPersonEmail')}>Contact Email</Label>
                <Input
                  id={inputId('contactPersonEmail')}
                  type="email"
                  value={formData.contactPersonEmail}
                  onChange={(e) => onFieldChange('contactPersonEmail', e.target.value)}
                  placeholder="john@organization.org"
                />
              </div>
            </div>
          </CollapsibleContent>
        </div>
      </Collapsible>

      {/* Second Contact Person Section */}
      <Collapsible
        open={sections[sectionKey('secondContact')]}
        onOpenChange={(open) => onSectionChange(sectionKey('secondContact'), open)}
      >
        <div className="border-t pt-4 mt-4">
          <CollapsibleTrigger asChild>
            <Button variant="ghost" className="w-full justify-between p-0 h-auto">
              <h4 className="font-medium text-sm text-slate-700">Second Contact Person (Optional)</h4>
              {sections[sectionKey('secondContact')] ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor={inputId('secondContactPersonName')}>Contact Name</Label>
                <Input
                  id={inputId('secondContactPersonName')}
                  value={formData.secondContactPersonName}
                  onChange={(e) => onFieldChange('secondContactPersonName', e.target.value)}
                  placeholder="Jane Doe"
                />
              </div>
              <div>
                <Label htmlFor={inputId('secondContactPersonRole')}>Role/Title</Label>
                <Input
                  id={inputId('secondContactPersonRole')}
                  value={formData.secondContactPersonRole}
                  onChange={(e) => onFieldChange('secondContactPersonRole', e.target.value)}
                  placeholder="Assistant Manager, Volunteer Coordinator, etc."
                />
              </div>
              <div>
                <Label htmlFor={inputId('secondContactPersonPhone')}>Contact Phone</Label>
                <Input
                  id={inputId('secondContactPersonPhone')}
                  value={formData.secondContactPersonPhone}
                  onChange={(e) => onFieldChange('secondContactPersonPhone', e.target.value)}
                  placeholder="(555) 987-6543"
                />
              </div>
              <div>
                <Label htmlFor={inputId('secondContactPersonEmail')}>Contact Email</Label>
                <Input
                  id={inputId('secondContactPersonEmail')}
                  type="email"
                  value={formData.secondContactPersonEmail}
                  onChange={(e) => onFieldChange('secondContactPersonEmail', e.target.value)}
                  placeholder="jane@organization.org"
                />
              </div>
            </div>
          </CollapsibleContent>
        </div>
      </Collapsible>

      {/* Enhanced Operational Fields */}
      <Collapsible
        open={sections[sectionKey('operational')]}
        onOpenChange={(open) => onSectionChange(sectionKey('operational'), open)}
      >
        <div className="border-t pt-4 mt-4">
          <CollapsibleTrigger asChild>
            <Button variant="ghost" className="w-full justify-between p-0 h-auto">
              <h4 className="font-medium text-sm text-slate-700">Operational Details</h4>
              {sections[sectionKey('operational')] ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor={inputId('reportingGroup')}>Reporting Group</Label>
                <Input
                  id={inputId('reportingGroup')}
                  value={formData.reportingGroup}
                  onChange={(e) => onFieldChange('reportingGroup', e.target.value)}
                  placeholder="Corresponds to host locations"
                />
              </div>
              <div>
                <Label htmlFor={inputId('estimatedSandwiches')}>Estimated Sandwiches</Label>
                <Input
                  id={inputId('estimatedSandwiches')}
                  type="number"
                  value={formData.estimatedSandwiches}
                  onChange={(e) => onFieldChange('estimatedSandwiches', e.target.value)}
                  placeholder="Number of sandwiches needed"
                />
              </div>
              <div>
                <Label htmlFor={inputId('sandwichType')}>Sandwich Type</Label>
                <Input
                  id={inputId('sandwichType')}
                  value={formData.sandwichType}
                  onChange={(e) => onFieldChange('sandwichType', e.target.value)}
                  placeholder="Type preferred (e.g., PB&J, Deli, Mixed)"
                />
              </div>
              <div>
                <Label htmlFor={inputId('focusAreas')}>Focus Areas</Label>
                <div className="space-y-2">
                  <div className="flex flex-wrap gap-2 mb-2">
                    {FOCUS_AREAS.map((area) => (
                      <Badge
                        key={area}
                        variant={formData.focusAreas.includes(area) ? "default" : "outline"}
                        className="cursor-pointer"
                        onClick={() => toggleFocusArea(area)}
                      >
                        {area}
                      </Badge>
                    ))}
                    {formData.focusAreas
                      .filter((area) => !FOCUS_AREAS.includes(area))
                      .map((area) => (
                        <Badge
                          key={area}
                          variant="default"
                          className="cursor-pointer"
                          onClick={() => toggleFocusArea(area)}
                        >
                          {area} ×
                        </Badge>
                      ))}
                  </div>
                  <div className="flex gap-2">
                    <Input
                      placeholder="Add custom focus area..."
                      value={customFocusArea}
                      onChange={(e) => setCustomFocusArea(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          addCustomFocusArea();
                        }
                      }}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        addCustomFocusArea();
                      }}
                    >
                      Add
                    </Button>
                  </div>
                </div>
              </div>
              <div>
                <Label htmlFor={inputId('tspContact')}>TSP Contact</Label>
                <Input
                  id={inputId('tspContact')}
                  value={formData.tspContact}
                  onChange={(e) => onFieldChange('tspContact', e.target.value)}
                  placeholder="TSP team member name"
                />
              </div>
              <div className="col-span-2">
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id={inputId('contractSigned')}
                    checked={formData.contractSigned}
                    onChange={(e) => onFieldChange('contractSigned', e.target.checked)}
                    className="h-4 w-4 text-brand-primary focus:ring-brand-primary border-gray-300 rounded"
                  />
                  <Label htmlFor={inputId('contractSigned')} className="text-sm">
                    Contract Signed
                  </Label>
                </div>
              </div>
              {formData.contractSigned && (
                <div>
                  <Label htmlFor={inputId('contractSignedDate')}>Contract Signed Date</Label>
                  <Input
                    id={inputId('contractSignedDate')}
                    type="date"
                    value={formData.contractSignedDate}
                    onChange={(e) => onFieldChange('contractSignedDate', e.target.value)}
                  />
                </div>
              )}

              {/* Collection and Feeding Schedule Fields */}
              <div className="col-span-2 border-t pt-3 mt-3">
                <h5 className="font-medium text-sm text-slate-700 mb-3">
                  Collection & Feeding Schedule
                </h5>
              </div>
              <div>
                <Label htmlFor={inputId('collectionDay')}>Collection Day</Label>
                <Input
                  id={inputId('collectionDay')}
                  type="text"
                  value={formData.collectionDay}
                  onChange={(e) => onFieldChange('collectionDay', e.target.value)}
                  placeholder="Monday"
                  data-testid="input-collection-day"
                />
              </div>
              <div>
                <Label htmlFor={inputId('collectionTime')}>Collection Time</Label>
                <Input
                  id={inputId('collectionTime')}
                  type="text"
                  value={formData.collectionTime}
                  onChange={(e) => onFieldChange('collectionTime', e.target.value)}
                  placeholder="9:00 AM"
                  data-testid="input-collection-time"
                />
              </div>
              <div>
                <Label htmlFor={inputId('feedingDay')}>Feeding Day</Label>
                <Input
                  id={inputId('feedingDay')}
                  type="text"
                  value={formData.feedingDay}
                  onChange={(e) => onFieldChange('feedingDay', e.target.value)}
                  placeholder="Wednesday"
                  data-testid="input-feeding-day"
                />
              </div>
              <div>
                <Label htmlFor={inputId('feedingTime')}>Feeding Time</Label>
                <Input
                  id={inputId('feedingTime')}
                  type="text"
                  value={formData.feedingTime}
                  onChange={(e) => onFieldChange('feedingTime', e.target.value)}
                  placeholder="12:00 PM"
                  data-testid="input-feeding-time"
                />
              </div>
            </div>
          </CollapsibleContent>
        </div>
      </Collapsible>

      {/* Social Media Tracking */}
      <Collapsible
        open={sections[sectionKey('socialMedia')]}
        onOpenChange={(open) => onSectionChange(sectionKey('socialMedia'), open)}
      >
        <div className="border-t pt-4 mt-4">
          <CollapsibleTrigger asChild>
            <Button variant="ghost" className="w-full justify-between p-0 h-auto">
              <h4 className="font-medium text-sm text-slate-700">Social Media Tracking</h4>
              {sections[sectionKey('socialMedia')] ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-3">
            <div className="grid grid-cols-1 gap-3">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id={inputId('hasSharedPost')}
                  checked={formData.hasSharedPost}
                  onCheckedChange={(checked) => onFieldChange('hasSharedPost', !!checked)}
                  data-testid="checkbox-shared-post"
                />
                <Label
                  htmlFor={inputId('hasSharedPost')}
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  Has shared a post about us on social media
                </Label>
              </div>
              {formData.hasSharedPost && (
                <div>
                  <Label htmlFor={inputId('sharedPostDate')}>Date post was shared</Label>
                  <Input
                    id={inputId('sharedPostDate')}
                    type="date"
                    value={formData.sharedPostDate}
                    onChange={(e) => onFieldChange('sharedPostDate', e.target.value)}
                    data-testid="input-shared-post-date"
                  />
                </div>
              )}
            </div>
          </CollapsibleContent>
        </div>
      </Collapsible>

      {/* People Served Section */}
      <Collapsible
        open={sections[sectionKey('peopleServed')]}
        onOpenChange={(open) => onSectionChange(sectionKey('peopleServed'), open)}
      >
        <div className="border-t pt-4 mt-4">
          <CollapsibleTrigger asChild>
            <Button variant="ghost" className="w-full justify-between p-0 h-auto">
              <h4 className="font-medium text-sm text-slate-700">People Served</h4>
              {sections[sectionKey('peopleServed')] ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor={inputId('averagePeopleServed')}>Average # of people served</Label>
                <Input
                  id={inputId('averagePeopleServed')}
                  type="number"
                  value={formData.averagePeopleServed}
                  onChange={(e) => onFieldChange('averagePeopleServed', e.target.value)}
                  placeholder="Enter number"
                  data-testid="input-average-people-served"
                />
              </div>
              <div>
                <Label htmlFor={inputId('peopleServedFrequency')}>How often</Label>
                <Select
                  value={formData.peopleServedFrequency}
                  onValueChange={(value) => onFieldChange('peopleServedFrequency', value)}
                >
                  <SelectTrigger data-testid="select-people-served-frequency">
                    <SelectValue placeholder="Select frequency" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="daily">Daily</SelectItem>
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="monthly">Monthly</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CollapsibleContent>
        </div>
      </Collapsible>

      {/* Partnership Section */}
      <Collapsible
        open={sections[sectionKey('partnership')]}
        onOpenChange={(open) => onSectionChange(sectionKey('partnership'), open)}
      >
        <div className="border-t pt-4 mt-4">
          <CollapsibleTrigger asChild>
            <Button variant="ghost" className="w-full justify-between p-0 h-auto">
              <h4 className="font-medium text-sm text-slate-700">Partnership</h4>
              {sections[sectionKey('partnership')] ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor={inputId('partnershipStartDate')}>Partnership start date</Label>
                <Input
                  id={inputId('partnershipStartDate')}
                  type="date"
                  value={formData.partnershipStartDate}
                  onChange={(e) => onFieldChange('partnershipStartDate', e.target.value)}
                  data-testid="input-partnership-start-date"
                />
              </div>
              <div>
                <Label htmlFor={inputId('partnershipYears')}>Years partnered</Label>
                <Input
                  id={inputId('partnershipYears')}
                  type="number"
                  value={formData.partnershipYears}
                  onChange={(e) => onFieldChange('partnershipYears', e.target.value)}
                  placeholder="Number of years"
                  data-testid="input-partnership-years"
                />
              </div>
            </div>
          </CollapsibleContent>
        </div>
      </Collapsible>

      {/* Fruit/Snacks Program Section */}
      <Collapsible
        open={sections[sectionKey('fruitSnacks')]}
        onOpenChange={(open) => onSectionChange(sectionKey('fruitSnacks'), open)}
      >
        <div className="border-t pt-4 mt-4">
          <CollapsibleTrigger asChild>
            <Button variant="ghost" className="w-full justify-between p-0 h-auto">
              <h4 className="font-medium text-sm text-slate-700">Fruit/Snacks Program</h4>
              {sections[sectionKey('fruitSnacks')] ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-3">
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id={inputId('receivingFruit')}
                    checked={formData.receivingFruit}
                    onCheckedChange={(checked) => onFieldChange('receivingFruit', !!checked)}
                    data-testid="checkbox-receiving-fruit"
                  />
                  <Label htmlFor={inputId('receivingFruit')} className="text-sm">
                    Currently receiving fruit
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id={inputId('receivingSnacks')}
                    checked={formData.receivingSnacks}
                    onCheckedChange={(checked) => onFieldChange('receivingSnacks', !!checked)}
                    data-testid="checkbox-receiving-snacks"
                  />
                  <Label htmlFor={inputId('receivingSnacks')} className="text-sm">
                    Currently receiving snacks
                  </Label>
                </div>
              </div>
              {!formData.receivingFruit && (
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id={inputId('wantsFruit')}
                    checked={formData.wantsFruit}
                    onCheckedChange={(checked) => onFieldChange('wantsFruit', !!checked)}
                    data-testid="checkbox-wants-fruit"
                  />
                  <Label htmlFor={inputId('wantsFruit')} className="text-sm">
                    Interested in receiving fruit
                  </Label>
                </div>
              )}
              {!formData.receivingSnacks && (
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id={inputId('wantsSnacks')}
                    checked={formData.wantsSnacks}
                    onCheckedChange={(checked) => onFieldChange('wantsSnacks', !!checked)}
                    data-testid="checkbox-wants-snacks"
                  />
                  <Label htmlFor={inputId('wantsSnacks')} className="text-sm">
                    Interested in receiving snacks
                  </Label>
                </div>
              )}
              <div>
                <Label htmlFor={inputId('fruitSnacksNotes')}>Fruit/snacks notes</Label>
                <Textarea
                  id={inputId('fruitSnacksNotes')}
                  value={formData.fruitSnacksNotes}
                  onChange={(e) => onFieldChange('fruitSnacksNotes', e.target.value)}
                  placeholder="Additional notes about fruit/snacks preferences..."
                  rows={2}
                  data-testid="textarea-fruit-snacks-notes"
                />
              </div>
            </div>
          </CollapsibleContent>
        </div>
      </Collapsible>

      {/* Seasonal Changes Section */}
      <Collapsible
        open={sections[sectionKey('seasonalChanges')]}
        onOpenChange={(open) => onSectionChange(sectionKey('seasonalChanges'), open)}
      >
        <div className="border-t pt-4 mt-4">
          <CollapsibleTrigger asChild>
            <Button variant="ghost" className="w-full justify-between p-0 h-auto">
              <h4 className="font-medium text-sm text-slate-700">Seasonal Changes</h4>
              {sections[sectionKey('seasonalChanges')] ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-3">
            <div className="space-y-3">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id={inputId('hasSeasonalChanges')}
                  checked={formData.hasSeasonalChanges}
                  onCheckedChange={(checked) => onFieldChange('hasSeasonalChanges', !!checked)}
                  data-testid="checkbox-has-seasonal-changes"
                />
                <Label htmlFor={inputId('hasSeasonalChanges')} className="text-sm">
                  Has seasonal changes
                </Label>
              </div>
              {formData.hasSeasonalChanges && (
                <>
                  <div>
                    <Label htmlFor={inputId('seasonalChangesDescription')}>Describe seasonal changes</Label>
                    <Textarea
                      id={inputId('seasonalChangesDescription')}
                      value={formData.seasonalChangesDescription}
                      onChange={(e) => onFieldChange('seasonalChangesDescription', e.target.value)}
                      placeholder="Describe how needs change seasonally..."
                      rows={2}
                      data-testid="textarea-seasonal-changes-description"
                    />
                  </div>
                  <div>
                    <Label htmlFor={inputId('summerNeeds')}>Summer needs</Label>
                    <Textarea
                      id={inputId('summerNeeds')}
                      value={formData.summerNeeds}
                      onChange={(e) => onFieldChange('summerNeeds', e.target.value)}
                      placeholder="Specific needs during summer months..."
                      rows={2}
                      data-testid="textarea-summer-needs"
                    />
                  </div>
                  <div>
                    <Label htmlFor={inputId('winterNeeds')}>Winter needs</Label>
                    <Textarea
                      id={inputId('winterNeeds')}
                      value={formData.winterNeeds}
                      onChange={(e) => onFieldChange('winterNeeds', e.target.value)}
                      placeholder="Specific needs during winter months..."
                      rows={2}
                      data-testid="textarea-winter-needs"
                    />
                  </div>
                </>
              )}
            </div>
          </CollapsibleContent>
        </div>
      </Collapsible>

      {/* Communication Preferences Section */}
      <Collapsible
        open={sections[sectionKey('communicationPreferences')]}
        onOpenChange={(open) => onSectionChange(sectionKey('communicationPreferences'), open)}
      >
        <div className="border-t pt-4 mt-4">
          <CollapsibleTrigger asChild>
            <Button variant="ghost" className="w-full justify-between p-0 h-auto">
              <h4 className="font-medium text-sm text-slate-700">Communication Preferences</h4>
              {sections[sectionKey('communicationPreferences')] ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-3">
            <div className="space-y-3">
              <div>
                <Label className="text-sm font-medium mb-2 block">Preferred contact methods</Label>
                <div className="flex flex-wrap gap-4">
                  {CONTACT_METHODS.map(({ id, label }) => (
                    <div key={id} className="flex items-center space-x-2">
                      <Checkbox
                        id={inputId(`prefer-${id}`)}
                        checked={formData.preferredContactMethods.includes(id)}
                        onCheckedChange={(checked) =>
                          toggleContactMethod('preferredContactMethods', id, !!checked)
                        }
                        data-testid={`checkbox-prefer-${id}`}
                      />
                      <Label htmlFor={inputId(`prefer-${id}`)} className="text-sm">{label}</Label>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <Label className="text-sm font-medium mb-2 block">Allowed contact methods</Label>
                <div className="flex flex-wrap gap-4">
                  {CONTACT_METHODS.map(({ id, label }) => (
                    <div key={id} className="flex items-center space-x-2">
                      <Checkbox
                        id={inputId(`allow-${id}`)}
                        checked={formData.allowedContactMethods.includes(id)}
                        onCheckedChange={(checked) =>
                          toggleContactMethod('allowedContactMethods', id, !!checked)
                        }
                        data-testid={`checkbox-allow-${id}`}
                      />
                      <Label htmlFor={inputId(`allow-${id}`)} className="text-sm">{label}</Label>
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id={inputId('doNotContact')}
                  checked={formData.doNotContact}
                  onCheckedChange={(checked) => onFieldChange('doNotContact', !!checked)}
                  data-testid="checkbox-do-not-contact"
                />
                <Label htmlFor={inputId('doNotContact')} className="text-sm text-red-600">
                  Do not contact
                </Label>
              </div>
              <div>
                <Label htmlFor={inputId('contactMethodNotes')}>Contact notes</Label>
                <Textarea
                  id={inputId('contactMethodNotes')}
                  value={formData.contactMethodNotes}
                  onChange={(e) => onFieldChange('contactMethodNotes', e.target.value)}
                  placeholder="E.g., Only call before 2pm, Best reached on Tuesdays..."
                  rows={2}
                  data-testid="textarea-contact-method-notes"
                />
              </div>
            </div>
          </CollapsibleContent>
        </div>
      </Collapsible>

      {/* Impact Stories Section */}
      <Collapsible
        open={sections[sectionKey('impactStories')]}
        onOpenChange={(open) => onSectionChange(sectionKey('impactStories'), open)}
      >
        <div className="border-t pt-4 mt-4">
          <CollapsibleTrigger asChild>
            <Button variant="ghost" className="w-full justify-between p-0 h-auto">
              <h4 className="font-medium text-sm text-slate-700">Impact Stories</h4>
              {sections[sectionKey('impactStories')] ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-3">
            <div className="space-y-4">
              {formData.impactStories.map((story, index) => (
                <div key={index} className="border rounded-lg p-3 space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-slate-600">Story {index + 1}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeImpactStory(index)}
                      className="text-red-500 hover:text-red-700 h-6 w-6 p-0"
                      data-testid={`button-remove-story-${index}`}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                  <div>
                    <Label htmlFor={inputId(`story-${index}`)}>Story</Label>
                    <Textarea
                      id={inputId(`story-${index}`)}
                      value={story.story}
                      onChange={(e) => updateImpactStory(index, { story: e.target.value })}
                      placeholder="Share an impact story..."
                      rows={3}
                      data-testid={`textarea-story-${index}`}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label htmlFor={inputId(`story-date-${index}`)}>Date collected</Label>
                      <Input
                        id={inputId(`story-date-${index}`)}
                        type="date"
                        value={story.date}
                        onChange={(e) => updateImpactStory(index, { date: e.target.value })}
                        data-testid={`input-story-date-${index}`}
                      />
                    </div>
                    <div>
                      <Label htmlFor={inputId(`story-source-${index}`)}>Source</Label>
                      <Input
                        id={inputId(`story-source-${index}`)}
                        value={story.source}
                        onChange={(e) => updateImpactStory(index, { source: e.target.value })}
                        placeholder="Who provided this story"
                        data-testid={`input-story-source-${index}`}
                      />
                    </div>
                  </div>
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addImpactStory}
                className="w-full"
                data-testid="button-add-impact-story"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Impact Story
              </Button>
            </div>
          </CollapsibleContent>
        </div>
      </Collapsible>
    </div>
  );
}
