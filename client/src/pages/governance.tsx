import { GovernanceDocuments } from '@/components/governance-documents';
import { useActivityTracker } from '@/hooks/useActivityTracker';
import { useEffect } from 'react';

export default function Governance() {
  const { trackView } = useActivityTracker();

  useEffect(() => {
    trackView(
      'Governance',
      'Governance',
      'Governance Documents',
      'User accessed governance documents page'
    );
  }, [trackView]);

  return <GovernanceDocuments />;
}
