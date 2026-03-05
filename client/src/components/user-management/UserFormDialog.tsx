import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
import type { User, UserFormData } from '@/types/user';

interface UserFormDialogProps {
  mode: 'add' | 'edit';
  user?: Partial<User>;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: UserFormData & { id?: string }) => void;
  isPending?: boolean;
}

const defaultFormData: UserFormData = {
  email: '',
  firstName: '',
  lastName: '',
  phoneNumber: '',
  preferredEmail: '',
  role: 'volunteer',
  isActive: true,
  password: '',
};

export function UserFormDialog({
  mode,
  user,
  open,
  onOpenChange,
  onSubmit,
  isPending = false,
}: UserFormDialogProps) {
  const [formData, setFormData] = useState<UserFormData>(defaultFormData);

  useEffect(() => {
    if (mode === 'edit' && user) {
      setFormData(user);
    } else {
      setFormData(defaultFormData);
    }
  }, [mode, user, open]);

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
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {mode === 'add' ? 'Add New User' : 'Edit User Details'}
          </DialogTitle>
          <DialogDescription>
            {mode === 'add'
              ? 'Create a new user account. They will receive login instructions via email.'
              : 'Update user information, role, and status'}
          </DialogDescription>
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

          {mode === 'edit' && (
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
          )}

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
                {mode === 'edit' && (
                  <>
                    <SelectItem value="super_admin">
                      Super Administrator
                    </SelectItem>
                    <SelectItem value="recipient">Recipient</SelectItem>
                    <SelectItem value="viewer">Viewer</SelectItem>
                    <SelectItem value="work_logger">Work Logger</SelectItem>
                  </>
                )}
              </SelectContent>
            </Select>
          </div>

          {mode === 'add' && (
            <div>
              <Label htmlFor="password">Password *</Label>
              <Input
                id="password"
                type="password"
                value={formData.password || ''}
                onChange={(e) =>
                  setFormData({ ...formData, password: e.target.value })
                }
                placeholder="Enter initial password (min 6 characters)"
                data-testid="input-password"
              />
              <p className="text-xs text-gray-500 mt-1">
                User will be able to change this password after logging in
              </p>
            </div>
          )}

          {mode === 'edit' && (
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
          )}

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
                !formData.lastName ||
                (mode === 'add' && (!formData.password || formData.password.length < 6))
              }
              className="bg-brand-primary hover:bg-brand-primary-dark"
              data-testid="button-submit-user"
            >
              {isPending
                ? mode === 'add'
                  ? 'Adding...'
                  : 'Saving...'
                : mode === 'add'
                ? 'Add User'
                : 'Save Changes'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
