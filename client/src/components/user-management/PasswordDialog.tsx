import { useState } from 'react';
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
import type { User } from '@/types/user';

interface PasswordDialogProps {
  user: User | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSetPassword: (userId: string, password: string) => void;
  isPending?: boolean;
}

export function PasswordDialog({
  user,
  open,
  onOpenChange,
  onSetPassword,
  isPending = false,
}: PasswordDialogProps) {
  const [password, setPassword] = useState('');

  const handleSubmit = () => {
    if (user && password.length >= 6) {
      onSetPassword(user.id, password);
      setPassword('');
    }
  };

  const handleClose = () => {
    setPassword('');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            Set Password for {user?.firstName} {user?.lastName}
          </DialogTitle>
          <DialogDescription>
            Set a new password for this user. They can use this password to log
            in directly.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div>
            <Label htmlFor="new-password">New Password</Label>
            <Input
              id="new-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter new password (minimum 6 characters)"
            />
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isPending || password.length < 6}
            className="bg-brand-primary hover:bg-brand-primary-dark"
          >
            {isPending ? 'Setting...' : 'Set Password'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
