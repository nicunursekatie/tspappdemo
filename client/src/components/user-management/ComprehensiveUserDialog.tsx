import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  User as UserIcon,
  Shield,
  Phone,
  KeyRound,
  BarChart3,
  MapPin,
} from 'lucide-react';
import type { User, UserFormData } from '@/types/user';
import CleanPermissionsEditor from '@/components/clean-permissions-editor';
import { PasswordDialog } from './PasswordDialog';
import { SMSDialog } from './SMSDialog';
import { UserActivityTab } from './UserActivityTab';

interface ComprehensiveUserDialogProps {
  mode: 'add' | 'edit';
  user?: Partial<User>;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: UserFormData & { id?: string }) => void;
  onUpdatePermissions?: (userId: string, role: string, permissions: string[]) => void;
  onSetPassword?: (userId: string, password: string) => void;
  onManageSMS?: (user: User) => void;
  isPending?: boolean;
}

const defaultFormData: UserFormData = {
  email: '',
  firstName: '',
  lastName: '',
  phoneNumber: '',
  preferredEmail: '',
  address: '',
  role: 'volunteer',
  isActive: true,
  password: '',
};

export function ComprehensiveUserDialog({
  mode,
  user,
  open,
  onOpenChange,
  onSubmit,
  onUpdatePermissions,
  onSetPassword,
  onManageSMS,
  isPending = false,
}: ComprehensiveUserDialogProps) {
  const [formData, setFormData] = useState<UserFormData>(defaultFormData);
  const [activeTab, setActiveTab] = useState('profile');
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [showSMSDialog, setShowSMSDialog] = useState(false);

  useEffect(() => {
    if (mode === 'edit' && user) {
      setFormData({
        email: user.email || '',
        firstName: user.firstName || '',
        lastName: user.lastName || '',
        phoneNumber: user.phoneNumber || '',
        preferredEmail: user.preferredEmail || '',
        address: user.address || '',
        role: user.role || 'volunteer',
        isActive: user.isActive ?? true,
        password: '',
      });
    } else {
      setFormData(defaultFormData);
    }
  }, [mode, user, open]);

  useEffect(() => {
    // Reset to profile tab when dialog opens
    if (open) {
      setActiveTab('profile');
    }
  }, [open]);

  const handleSubmit = () => {
    if (!formData.email || !formData.firstName || !formData.lastName) {
      return;
    }

    if (mode === 'edit' && user?.id) {
      onSubmit({ ...formData, id: user.id });
    } else {
      onSubmit(formData);
    }
  };

  const handleClose = () => {
    setFormData(defaultFormData);
    setActiveTab('profile');
    onOpenChange(false);
  };

  // For Add mode, only show the profile tab
  if (mode === 'add') {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserIcon className="h-5 w-5" />
              Add New User
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="email">Email Address *</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) =>
                  setFormData({ ...formData, email: e.target.value })
                }
                placeholder="user@example.com"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="firstName">First Name *</Label>
                <Input
                  id="firstName"
                  value={formData.firstName}
                  onChange={(e) =>
                    setFormData({ ...formData, firstName: e.target.value })
                  }
                  placeholder="John"
                />
              </div>
              <div>
                <Label htmlFor="lastName">Last Name *</Label>
                <Input
                  id="lastName"
                  value={formData.lastName}
                  onChange={(e) =>
                    setFormData({ ...formData, lastName: e.target.value })
                  }
                  placeholder="Doe"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="role">Role</Label>
              <Select
                value={formData.role}
                onValueChange={(value) =>
                  setFormData({ ...formData, role: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="volunteer">Volunteer</SelectItem>
                  <SelectItem value="host">Host</SelectItem>
                  <SelectItem value="driver">Driver</SelectItem>
                  <SelectItem value="core_team">Core Team</SelectItem>
                  <SelectItem value="committee_member">
                    Committee Member
                  </SelectItem>
                  <SelectItem value="admin">Administrator</SelectItem>
                  <SelectItem value="reviewer">Reviewer (Read-Only)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="password">Password (Optional)</Label>
              <Input
                id="password"
                type="password"
                value={formData.password || ''}
                onChange={(e) =>
                  setFormData({ ...formData, password: e.target.value })
                }
                placeholder="Leave blank to let user set their own"
              />
              <p className="text-xs text-gray-500 mt-1">
                If left blank, the user will be prompted to create a password on their first login.
              </p>
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={
                  isPending ||
                  !formData.email ||
                  !formData.firstName ||
                  !formData.lastName
                }
                className=""
              >
                {isPending ? 'Adding...' : 'Add User'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // Edit mode - full tabbed interface
  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="w-[98vw] max-w-[2000px] max-h-[95vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserIcon className="h-5 w-5" />
              {user?.firstName} {user?.lastName}
            </DialogTitle>
          </DialogHeader>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="profile" className="flex items-center gap-1 text-xs">
                <UserIcon className="h-3 w-3" />
                Profile
              </TabsTrigger>
              <TabsTrigger value="permissions" className="flex items-center gap-1 text-xs">
                <Shield className="h-3 w-3" />
                Permissions
              </TabsTrigger>
              <TabsTrigger value="activity" className="flex items-center gap-1 text-xs">
                <BarChart3 className="h-3 w-3" />
                Activity
              </TabsTrigger>
            </TabsList>

            {/* Profile Tab */}
            <TabsContent value="profile" className="flex-1 overflow-y-auto space-y-4 p-4">
              <div className="space-y-4">
                <div>
                  <Label htmlFor="email">Email Address *</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) =>
                      setFormData({ ...formData, email: e.target.value })
                    }
                    placeholder="user@example.com"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="firstName">First Name *</Label>
                    <Input
                      id="firstName"
                      value={formData.firstName}
                      onChange={(e) =>
                        setFormData({ ...formData, firstName: e.target.value })
                      }
                      placeholder="John"
                    />
                  </div>
                  <div>
                    <Label htmlFor="lastName">Last Name *</Label>
                    <Input
                      id="lastName"
                      value={formData.lastName}
                      onChange={(e) =>
                        setFormData({ ...formData, lastName: e.target.value })
                      }
                      placeholder="Doe"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="phoneNumber">Phone Number</Label>
                    <Input
                      id="phoneNumber"
                      type="tel"
                      value={formData.phoneNumber || ''}
                      onChange={(e) =>
                        setFormData({ ...formData, phoneNumber: e.target.value })
                      }
                      placeholder="(555) 123-4567"
                    />
                  </div>
                  <div>
                    <Label htmlFor="preferredEmail">Preferred Email</Label>
                    <Input
                      id="preferredEmail"
                      type="email"
                      value={formData.preferredEmail || ''}
                      onChange={(e) =>
                        setFormData({ ...formData, preferredEmail: e.target.value })
                      }
                      placeholder="preferred@example.com"
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="address" className="flex items-center gap-1">
                    <MapPin className="h-3 w-3" />
                    Home Address
                  </Label>
                  <Input
                    id="address"
                    value={formData.address || ''}
                    onChange={(e) =>
                      setFormData({ ...formData, address: e.target.value })
                    }
                    placeholder="123 Main St, City, State ZIP"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Used to show location on the driver planning map
                  </p>
                </div>

                <div>
                  <Label htmlFor="role">Role</Label>
                  <Select
                    value={formData.role}
                    onValueChange={(value) =>
                      setFormData({ ...formData, role: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="volunteer">Volunteer</SelectItem>
                      <SelectItem value="host">Host</SelectItem>
                      <SelectItem value="driver">Driver</SelectItem>
                      <SelectItem value="core_team">Core Team</SelectItem>
                      <SelectItem value="committee_member">
                        Committee Member
                      </SelectItem>
                      <SelectItem value="admin">Administrator</SelectItem>
                      <SelectItem value="super_admin">
                        Super Administrator
                      </SelectItem>
                      <SelectItem value="recipient">Recipient</SelectItem>
                      <SelectItem value="viewer">Viewer</SelectItem>
                      <SelectItem value="work_logger">Work Logger</SelectItem>
                      <SelectItem value="reviewer">Reviewer (Read-Only)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="isActive"
                    checked={formData.isActive}
                    onChange={(e) =>
                      setFormData({ ...formData, isActive: e.target.checked })
                    }
                    className="w-4 h-4 text-brand-primary border-slate-300 rounded focus:ring-brand-primary"
                  />
                  <Label htmlFor="isActive">User is active</Label>
                </div>

                {/* Quick Actions */}
                <div className="border-t pt-4 space-y-2">
                  <h3 className="text-sm font-medium mb-2">Quick Actions</h3>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowPasswordDialog(true)}
                      className="flex items-center gap-2"
                    >
                      <KeyRound className="h-4 w-4" />
                      Set Password
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowSMSDialog(true)}
                      className="flex items-center gap-2"
                    >
                      <Phone className="h-4 w-4" />
                      Manage SMS
                    </Button>
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-4 border-t">
                  <Button variant="outline" onClick={handleClose}>
                    Cancel
                  </Button>
                  <Button
                    onClick={handleSubmit}
                    disabled={
                      isPending ||
                      !formData.email ||
                      !formData.firstName ||
                      !formData.lastName
                    }
                    className=""
                  >
                    {isPending ? 'Saving...' : 'Save Changes'}
                  </Button>
                </div>
              </div>
            </TabsContent>

            {/* Permissions Tab */}
            <TabsContent value="permissions" className="flex-1 overflow-y-auto p-4">
              {user && (
                <div className="space-y-4">
                  <p className="text-sm text-gray-600">
                    Manage detailed permissions for {user.firstName} {user.lastName}
                  </p>
                  <CleanPermissionsEditor
                    user={user as User}
                    open={true}
                    onOpenChange={() => {}}
                    onSave={(userId, role, permissions) => {
                      if (onUpdatePermissions) {
                        onUpdatePermissions(userId, role, permissions);
                        // Close the parent dialog after saving permissions
                        handleClose();
                      }
                    }}
                    embedded={true}
                  />
                </div>
              )}
            </TabsContent>

            {/* Activity Tab */}
            <TabsContent value="activity" className="flex-1 overflow-y-auto p-4">
              {user?.id && <UserActivityTab userId={user.id} userName={`${user.firstName} ${user.lastName}`} lastLoginAt={user.lastLoginAt} />}
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      {/* Password Dialog */}
      {user && (
        <PasswordDialog
          user={user as User}
          open={showPasswordDialog}
          onOpenChange={setShowPasswordDialog}
          onSetPassword={(userId, password) => {
            if (onSetPassword) {
              onSetPassword(userId, password);
            }
            setShowPasswordDialog(false);
          }}
          isPending={false}
        />
      )}

      {/* SMS Dialog */}
      {user && (
        <SMSDialog
          user={user as User}
          open={showSMSDialog}
          onOpenChange={setShowSMSDialog}
          onUpdateSMS={(userId, phoneNumber, enabled, campaignTypes) => {
            if (onManageSMS) {
              onManageSMS(user as User);
            }
            setShowSMSDialog(false);
          }}
          isPending={false}
        />
      )}
    </>
  );
}
