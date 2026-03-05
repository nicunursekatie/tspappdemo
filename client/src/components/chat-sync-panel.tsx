import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import {
  CheckCircle,
  AlertCircle,
  Users,
  RefreshCw,
  MessageSquare,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface ChannelResult {
  channelId: string;
  memberCount: number;
  newlyAdded: number;
  errors: number;
}

interface SyncResult {
  success: boolean;
  message: string;
  summary?: {
    totalChannels: number;
    totalUsersProcessed: number;
    channelResults: ChannelResult[];
  };
}

export function ChatSyncPanel() {
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null);
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);
  const { toast } = useToast();

  const syncMembers = async () => {
    setSyncing(true);
    setSyncResult(null);

    try {
      const response = await apiRequest('POST', '/api/stream/sync-members');
      setSyncResult(response);
      setLastSyncTime(new Date().toLocaleString());

      if (response.success) {
        const totalAdded = response.summary?.channelResults.reduce(
          (acc: number, ch: ChannelResult) => acc + ch.newlyAdded,
          0
        ) || 0;

        toast({
          title: 'Sync Complete',
          description: `Successfully synced members. ${totalAdded} new members added across all channels.`,
        });
      } else {
        toast({
          title: 'Sync Failed',
          description: response.message || 'Failed to sync members',
          variant: 'destructive',
        });
      }
    } catch (error: any) {
      const errorMessage = error.message || 'Failed to sync chat members';
      setSyncResult({
        success: false,
        message: errorMessage,
      });
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setSyncing(false);
    }
  };

  const getChannelDisplayName = (channelId: string): string => {
    const nameMap: Record<string, string> = {
      'general': 'General Chat',
      'core-team': 'Core Team',
      'grants-committee': 'Grants Committee',
      'events-committee': 'Events Committee',
      'board-chat': 'Board Chat',
      'web-committee': 'Web Committee',
      'volunteer-management': 'Volunteer Chat',
      'host': 'Host Chat',
      'driver': 'Driver Chat',
      'recipient': 'Recipient Chat',
    };
    return nameMap[channelId] || channelId;
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Team Chat Member Sync
          </CardTitle>
          {syncResult?.success && (
            <Badge className="bg-green-100 text-green-800 border-green-200">
              <CheckCircle className="w-3 h-3 mr-1" />
              Synced
            </Badge>
          )}
        </div>
        <p className="text-sm text-muted-foreground">
          Sync all users to their team chat channels based on permissions. This ensures
          accurate member counts even for users who haven't opened chat yet.
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Sync Button */}
        <div className="space-y-3">
          <Button
            onClick={syncMembers}
            disabled={syncing}
            className="w-full"
            data-testid="button-sync-members"
          >
            {syncing ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                Syncing Members...
              </>
            ) : (
              <>
                <Users className="h-4 w-4 mr-2" />
                Sync All Chat Members
              </>
            )}
          </Button>
          <p className="text-xs text-muted-foreground text-center">
            This will add all eligible users to their respective team channels based on their permissions.
          </p>
        </div>

        {/* Sync Result */}
        {syncResult && (
          <div className="space-y-3 border-t pt-6">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium">Sync Result</h3>
              {lastSyncTime && (
                <span className="text-xs text-muted-foreground">
                  Last sync: {lastSyncTime}
                </span>
              )}
            </div>

            {syncResult.success && syncResult.summary ? (
              <div className="space-y-4">
                {/* Refresh notice */}
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                  <p className="text-sm text-amber-800 font-medium">
                    Refresh the Team Chat page to see the updated member counts.
                  </p>
                </div>
                {/* Summary Stats */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 bg-brand-primary-lighter rounded-lg border border-brand-primary-border">
                    <div className="text-2xl font-bold text-brand-primary">
                      {syncResult.summary.totalChannels}
                    </div>
                    <div className="text-sm text-brand-primary-dark">Channels Processed</div>
                  </div>
                  <div className="p-4 bg-brand-primary-lighter rounded-lg border border-brand-primary-border">
                    <div className="text-2xl font-bold text-brand-primary">
                      {syncResult.summary.totalUsersProcessed}
                    </div>
                    <div className="text-sm text-brand-primary-dark">Users Processed</div>
                  </div>
                </div>

                {/* Channel Details */}
                <div className="space-y-2">
                  <h4 className="text-sm font-medium text-muted-foreground">Channel Details</h4>
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {syncResult.summary.channelResults.map((channel) => (
                      <div
                        key={channel.channelId}
                        className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border"
                      >
                        <div className="flex items-center gap-2">
                          <MessageSquare className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">
                            {getChannelDisplayName(channel.channelId)}
                          </span>
                        </div>
                        <div className="flex items-center gap-3">
                          <Badge variant="secondary" className="gap-1">
                            <Users className="h-3 w-3" />
                            {channel.memberCount} members
                          </Badge>
                          {channel.newlyAdded > 0 && (
                            <Badge className="bg-green-100 text-green-800 border-green-200">
                              +{channel.newlyAdded} new
                            </Badge>
                          )}
                          {channel.errors > 0 && (
                            <Badge variant="destructive">
                              {channel.errors} errors
                            </Badge>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                <div className="flex items-start gap-3">
                  <AlertCircle className="h-5 w-5 text-red-500 mt-0.5" />
                  <div className="text-red-700">{syncResult.message}</div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tips */}
        <div className="bg-brand-primary-lighter border border-brand-primary-border rounded-lg p-4">
          <h4 className="font-medium text-brand-primary-darker mb-2">About Chat Sync</h4>
          <ul className="text-sm text-brand-primary-dark space-y-1">
            <li>• Users are automatically added when they first open chat</li>
            <li>• Use this sync to pre-populate channels before users log in</li>
            <li>• Members are added based on their current permissions</li>
            <li>• Run this after adding new team members or changing permissions</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
