import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import CompactCollectionForm from './compact-collection-form';
import { useAuth } from '@/hooks/useAuth';
import { PERMISSIONS } from '@shared/auth-utils';
import { hasPermission } from '@shared/unified-auth-utils';

interface CollectionFormSelectorProps {
  onSuccess?: () => void;
  onCancel?: () => void;
}

export default function CollectionFormSelector({
  onSuccess,
  onCancel,
}: CollectionFormSelectorProps) {
  const { user } = useAuth();

  const canCreateCollections =
    user && hasPermission(user, PERMISSIONS.COLLECTIONS_ADD);

  // If user can't create collections at all, show error
  if (!canCreateCollections) {
    return (
      <Card className="max-w-2xl mx-auto">
        <CardContent className="p-8 text-center">
          <p className="text-gray-600">
            You don't have permission to submit collection data.
          </p>
          <p className="text-sm text-gray-500 mt-2">
            Contact an administrator if you need access.
          </p>
        </CardContent>
      </Card>
    );
  }

  // Show the standard collection form directly
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">
          Collection Form
        </h2>
        {onCancel && (
          <Button variant="outline" size="sm" onClick={onCancel}>
            Cancel
          </Button>
        )}
      </div>
      <CompactCollectionForm onSuccess={onSuccess} />
    </div>
  );
}
