import { useState, useEffect, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Search, ChevronDown, ChevronRight, Check, Shield, AlertCircle } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { USER_ROLES, getDefaultPermissionsForRole, getRoleDisplayName, applyPermissionDependencies, PERMISSION_DEPENDENCIES } from '@shared/auth-utils';
import { PERMISSION_GROUPS, getPermissionLabel, getPermissionDescription } from '@shared/permission-config';
import { getPermissionRiskInfo, countPermissionsByRisk, type PermissionRiskLevel } from '@shared/permission-security-levels';
import type { User } from '@/types/user';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface CleanPermissionsEditorProps {
  user: User | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (userId: string, role: string, permissions: string[]) => void;
  embedded?: boolean; // If true, renders without Dialog wrapper
}

// Commonly adjusted permissions (show these prominently)
const COMMON_PERMISSIONS = new Set([
  'USERS_EDIT',
  'HOSTS_EDIT',
  'RECIPIENTS_EDIT',
  'DRIVERS_EDIT',
  'EVENT_REQUESTS_EDIT',
  'EVENT_REQUESTS_ASSIGN_OTHERS',
  'COLLECTIONS_EDIT_ALL',
  'PROJECTS_EDIT_ALL',
]);

export default function CleanPermissionsEditor({
  user,
  open,
  onOpenChange,
  onSave,
  embedded = false,
}: CleanPermissionsEditorProps) {
  const [selectedRole, setSelectedRole] = useState<string>('');
  const [selectedPermissions, setSelectedPermissions] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [showAdvanced, setShowAdvanced] = useState(false);

  useEffect(() => {
    if (user) {
      setSelectedRole(user.role);
      setSelectedPermissions(new Set(user.permissions || []));
      // Start with common groups expanded
      setExpandedGroups(new Set(['USERS', 'EVENT_REQUESTS']));
    } else {
      setSelectedRole('');
      setSelectedPermissions(new Set());
      setExpandedGroups(new Set());
    }
    setSearchQuery('');
    setShowAdvanced(false);
  }, [user, open]);

  const defaultPermissions = useMemo(() => {
    return new Set(getDefaultPermissionsForRole(selectedRole));
  }, [selectedRole]);

  const handleRoleChange = (newRole: string) => {
    setSelectedRole(newRole);
    // Reset to default permissions for the new role
    setSelectedPermissions(new Set(getDefaultPermissionsForRole(newRole)));
  };

  const togglePermission = (permission: string) => {
    const newPermissions = new Set(selectedPermissions);
    if (newPermissions.has(permission)) {
      newPermissions.delete(permission);
    } else {
      newPermissions.add(permission);
      // Auto-add dependencies when enabling a permission
      const dependencies = PERMISSION_DEPENDENCIES[permission];
      if (dependencies) {
        dependencies.forEach(dep => newPermissions.add(dep));
      }
    }
    setSelectedPermissions(newPermissions);
  };

  const toggleGroupPermissions = (groupPermissions: string[], enable: boolean) => {
    const newPermissions = new Set(selectedPermissions);
    groupPermissions.forEach(perm => {
      if (enable) {
        newPermissions.add(perm);
        // Auto-add dependencies when enabling permissions
        const dependencies = PERMISSION_DEPENDENCIES[perm];
        if (dependencies) {
          dependencies.forEach(dep => newPermissions.add(dep));
        }
      } else {
        newPermissions.delete(perm);
      }
    });
    setSelectedPermissions(newPermissions);
  };

  const toggleGroup = (groupKey: string) => {
    const newExpanded = new Set(expandedGroups);
    if (newExpanded.has(groupKey)) {
      newExpanded.delete(groupKey);
    } else {
      newExpanded.add(groupKey);
    }
    setExpandedGroups(newExpanded);
  };

  const handleSave = () => {
    if (user) {
      // Apply permission dependencies before saving to ensure completeness
      const permissionsWithDeps = applyPermissionDependencies(Array.from(selectedPermissions));
      onSave(user.id, selectedRole, permissionsWithDeps);
      // Close the dialog after saving
      onOpenChange(false);
    }
  };

  const filteredGroups = useMemo(() => {
    if (!searchQuery) return Object.entries(PERMISSION_GROUPS);

    const query = searchQuery.toLowerCase();
    return Object.entries(PERMISSION_GROUPS).filter(([groupKey, group]) => {
      if (group.label.toLowerCase().includes(query)) return true;
      return group.permissions.some(perm =>
        getPermissionLabel(perm).toLowerCase().includes(query)
      );
    });
  }, [searchQuery]);

  const hasChanges = useMemo(() => {
    if (!user) return false;
    if (selectedRole !== user.role) return true;

    const current = new Set(user.permissions || []);
    if (current.size !== selectedPermissions.size) return true;

    const selectedArray = Array.from(selectedPermissions);
    for (const perm of selectedArray) {
      if (!current.has(perm)) return true;
    }
    return false;
  }, [user, selectedRole, selectedPermissions]);

  const riskCounts = useMemo(() => {
    return countPermissionsByRisk(Array.from(selectedPermissions));
  }, [selectedPermissions]);

  if (!user) return null;

  // Auto-expand groups when searching
  const groupsToShow = searchQuery ? new Set(filteredGroups.map(([key]) => key)) : expandedGroups;

  // Shared content component
  const permissionsContent = (
    <div className="space-y-4">
          {/* Role Template Selector - PROMINENT */}
          <Card className="border-2 border-brand-primary/30 bg-gradient-to-br from-brand-primary/5 to-brand-primary/10 shadow-md hover:shadow-lg transition-all duration-200">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2 text-brand-primary font-semibold">
                <Shield className="h-5 w-5" />
                Role Template
              </CardTitle>
              <CardDescription className="text-sm">
                Start with a pre-configured role. Most users only need this step.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Select value={selectedRole} onValueChange={handleRoleChange}>
                <SelectTrigger className="h-12 text-base">
                  <SelectValue placeholder="Select a role" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(USER_ROLES).map(([key, value]) => (
                    <SelectItem key={value} value={value} className="py-3">
                      <div>
                        <div className="font-medium">{getRoleDisplayName(value)}</div>
                        <div className="text-xs text-gray-500">
                          {defaultPermissions.size} permissions included
                        </div>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {selectedPermissions.size !== defaultPermissions.size && (
                <div className="mt-3 flex items-center gap-2 text-sm text-amber-700 bg-gradient-to-r from-amber-50 to-orange-50 border-l-4 border-l-brand-secondary rounded-lg p-3 shadow-sm">
                  <AlertCircle className="h-4 w-4" />
                  <span className="font-medium">Custom permissions active ({selectedPermissions.size} total)</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedPermissions(new Set(getDefaultPermissionsForRole(selectedRole)))}
                    className="ml-auto text-xs hover:bg-white/50 transition-all duration-200"
                  >
                    Reset to Role Default
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Risk Level Summary */}
          <Card className="border-2 border-amber-300 bg-gradient-to-br from-amber-50 to-orange-50 shadow-md transition-all duration-200">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2 text-amber-700 font-semibold">
                <Shield className="h-5 w-5" />
                Permission Risk Summary
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-gradient-to-r from-green-50 to-emerald-50 border-l-4 border-l-green-500 shadow-sm hover:shadow transition-all duration-200">
                  <span className="text-green-700 font-semibold">👁️ Safe</span>
                  <Badge variant="outline" className="bg-white text-green-700 border-green-400 font-medium">{riskCounts.safe}</Badge>
                </div>
                <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-gradient-to-r from-blue-50 to-cyan-50 border-l-4 border-l-blue-500 shadow-sm hover:shadow transition-all duration-200">
                  <span className="text-blue-700 font-semibold">✏️ Moderate</span>
                  <Badge variant="outline" className="bg-white text-blue-700 border-blue-400 font-medium">{riskCounts.moderate}</Badge>
                </div>
                <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-gradient-to-r from-orange-50 to-amber-50 border-l-4 border-l-orange-500 shadow-sm hover:shadow transition-all duration-200">
                  <span className="text-orange-700 font-semibold">⚠️ Elevated</span>
                  <Badge variant="outline" className="bg-white text-orange-700 border-orange-400 font-medium">{riskCounts.elevated}</Badge>
                </div>
                <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-gradient-to-r from-red-50 to-rose-50 border-l-4 border-l-red-500 shadow-sm hover:shadow transition-all duration-200">
                  <span className="text-red-700 font-semibold">🔥 Critical</span>
                  <Badge variant="outline" className="bg-white text-red-700 border-red-400 font-medium">{riskCounts.critical}</Badge>
                </div>
              </div>
              {riskCounts.critical > 0 && (
                <div className="mt-3 text-xs text-red-700 bg-gradient-to-r from-red-50 to-rose-50 border-l-4 border-l-red-500 rounded-lg p-3 shadow-sm">
                  ⚠️ <strong>Warning:</strong> This user has {riskCounts.critical} critical permission{riskCounts.critical !== 1 ? 's' : ''} (can delete data or manage users)
                </div>
              )}
            </CardContent>
          </Card>

          {/* Search - PROMINENT */}
          <div className="relative shadow-sm">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-brand-primary" />
            <Input
              placeholder="Search permissions (e.g., 'volunteer', 'edit', 'messages')..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-11 h-12 text-base border-2 border-slate-200 focus:border-brand-primary rounded-lg transition-all duration-200"
            />
          </div>

          {/* Permissions Groups - COLLAPSIBLE */}
          <Card className="border-2 border-slate-200 shadow-md transition-all duration-200">
            <CardHeader className="pb-3 bg-gradient-to-r from-slate-50 to-slate-100">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base text-slate-800 font-semibold">Custom Permissions</CardTitle>
                  <CardDescription className="text-xs text-slate-600">
                    {showAdvanced ? 'Showing all permissions' : 'Showing commonly adjusted permissions'}
                  </CardDescription>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowAdvanced(!showAdvanced)}
                  className="text-xs bg-white hover:bg-brand-primary hover:text-white transition-all duration-200 shadow-sm"
                >
                  {showAdvanced ? 'Show Common Only' : 'Show All Permissions'}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px]">
                <TooltipProvider>
                  <div className="space-y-2">
                    {filteredGroups.map(([groupKey, group]) => {
                      // Filter permissions based on showAdvanced
                      const allPermissions = (group.permissions || []).filter(p => p); // Filter out null/undefined
                      const groupPermissions = showAdvanced
                        ? allPermissions
                        : allPermissions.filter(p => COMMON_PERMISSIONS.has(p.split('.').pop() || p));

                      if (groupPermissions.length === 0) return null;

                      // Filter by search
                      const visiblePermissions = groupPermissions.filter(perm => {
                        if (!searchQuery) return true;
                        return getPermissionLabel(perm).toLowerCase().includes(searchQuery.toLowerCase());
                      });

                      if (visiblePermissions.length === 0) return null;

                      const selectedCount = visiblePermissions.filter(p => selectedPermissions.has(p)).length;
                      const allSelected = selectedCount === visiblePermissions.length;
                      const isExpanded = searchQuery ? true : groupsToShow.has(groupKey);

                      return (
                        <Collapsible key={groupKey} open={isExpanded} onOpenChange={() => !searchQuery && toggleGroup(groupKey)}>
                          <div className="border-2 border-brand-primary/20 rounded-lg shadow-sm hover:shadow-md transition-all duration-200">
                            <CollapsibleTrigger className="w-full">
                              <div className="flex items-center justify-between p-3 bg-gradient-to-r from-[#47b3cbbf] to-[#47b3cbd0] hover:from-[#47b3cbd0] hover:to-[#47b3cbdf] rounded-t-lg transition-all duration-200 group">
                                <div className="flex items-center gap-2">
                                  {isExpanded ? (
                                    <ChevronDown className="h-4 w-4 text-brand-primary group-hover:scale-110 transition-transform" />
                                  ) : (
                                    <ChevronRight className="h-4 w-4 text-brand-primary group-hover:scale-110 transition-transform" />
                                  )}
                                  <span className="font-bold text-sm text-brand-primary tracking-wide">{group.label}</span>
                                  <Badge variant="outline" className="text-xs bg-white/80 text-brand-primary border-brand-primary/40 font-medium">
                                    {selectedCount}/{visiblePermissions.length}
                                  </Badge>
                                </div>
                                <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => toggleGroupPermissions(visiblePermissions, !allSelected)}
                                    className="text-xs h-7 bg-white/50 hover:bg-white text-brand-primary hover:text-brand-primary-dark transition-all duration-200 shadow-sm"
                                  >
                                    {allSelected ? 'Deselect All' : 'Select All'}
                                  </Button>
                                </div>
                              </div>
                            </CollapsibleTrigger>

                            <CollapsibleContent>
                              <div className="px-3 pb-3 space-y-2 border-t">
                                {visiblePermissions.map((permission) => {
                                  const isSelected = selectedPermissions.has(permission);
                                  const isDefault = defaultPermissions.has(permission);
                                  const label = getPermissionLabel(permission);
                                  const riskInfo = getPermissionRiskInfo(permission);

                                  return (
                                    <div
                                      key={permission}
                                      className="flex items-center justify-between py-2.5 hover:bg-gradient-to-r hover:from-slate-50 hover:to-slate-100 rounded-lg px-3 transition-all duration-200 group"
                                    >
                                      <div className="flex items-center gap-3 flex-1">
                                        <Switch
                                          checked={isSelected}
                                          onCheckedChange={() => togglePermission(permission)}
                                          id={permission}
                                          className="data-[state=checked]:bg-brand-primary"
                                        />
                                        <Label
                                          htmlFor={permission}
                                          className="cursor-pointer text-sm flex items-center gap-2 flex-1 font-medium text-slate-700"
                                        >
                                          <span className="flex-1">{label}</span>
                                          <div className="flex items-center gap-1.5">
                                            <Badge
                                              variant="outline"
                                              className={`text-[10px] px-1.5 py-0 border ${riskInfo.badgeColor} font-semibold`}
                                            >
                                              {riskInfo.icon} {riskInfo.level}
                                            </Badge>
                                            {isDefault && (
                                              <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-brand-primary/10 border-brand-primary/30 text-brand-primary font-medium">
                                                From Role
                                              </Badge>
                                            )}
                                          </div>
                                        </Label>
                                      </div>
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <AlertCircle className="h-4 w-4 text-brand-primary" />
                                          </Button>
                                        </TooltipTrigger>
                                        <TooltipContent side="left" className="max-w-xs bg-slate-900 text-white">
                                          <div className="space-y-1">
                                            <p className="text-xs font-semibold">{getPermissionDescription(permission)}</p>
                                            <p className="text-xs text-slate-300">{riskInfo.description}</p>
                                          </div>
                                        </TooltipContent>
                                      </Tooltip>
                                    </div>
                                  );
                                })}
                              </div>
                            </CollapsibleContent>
                          </div>
                        </Collapsible>
                      );
                    })}
                  </div>
                </TooltipProvider>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>
  );

  const saveButton = (
    <div className="flex items-center justify-between w-full pt-4 border-t-2 border-brand-primary/20">
      <span className="text-sm font-semibold text-slate-700 bg-gradient-to-r from-slate-50 to-slate-100 px-4 py-2 rounded-lg border border-slate-200 shadow-sm">
        {selectedPermissions.size} permissions selected
      </span>
      <div className="flex gap-2">
        {!embedded && (
          <Button 
            variant="outline" 
            onClick={() => onOpenChange(false)}
            className="hover:bg-slate-100 transition-all duration-200 shadow-sm"
          >
            Cancel
          </Button>
        )}
        <Button
          onClick={handleSave}
          disabled={!hasChanges}
          className="bg-gradient-to-r from-brand-primary to-brand-primary-dark hover:shadow-lg text-white shadow-md border-l-4 border-l-brand-secondary transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Check className="h-4 w-4 mr-2" />
          Save Changes
        </Button>
      </div>
    </div>
  );

  // If embedded, render without Dialog wrapper
  if (embedded) {
    return (
      <div className="space-y-4">
        {permissionsContent}
        {saveButton}
      </div>
    );
  }

  // Default: render with Dialog wrapper
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] max-w-6xl max-h-[85vh] p-4 sm:p-6 border-2 border-brand-primary/30 shadow-2xl">
        <DialogHeader className="pb-4 border-b-2 border-brand-primary/20 bg-gradient-to-r from-brand-primary/5 to-brand-primary/10 -mx-4 sm:-mx-6 -mt-4 sm:-mt-6 px-4 sm:px-6 pt-4 sm:pt-6 rounded-t-lg">
          <DialogTitle className="flex items-center gap-3 text-xl">
            <div className="p-2 rounded-lg bg-gradient-to-br from-brand-primary to-brand-primary-dark shadow-md">
              <Shield className="h-6 w-6 text-white" />
            </div>
            <span className="text-brand-primary font-bold">
              Permissions for {user.firstName} {user.lastName}
            </span>
          </DialogTitle>
          <DialogDescription className="text-sm text-slate-600 font-medium pl-14">
            Choose a role template or customize specific permissions
          </DialogDescription>
        </DialogHeader>

        {permissionsContent}

        <DialogFooter>
          {saveButton}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
