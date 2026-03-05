import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Activity, TrendingUp } from 'lucide-react';
import { DetailedActivityAnalytics } from '@/components/detailed-activity-analytics';
import MeaningfulUserAnalytics from '@/components/meaningful-user-analytics';

/**
 * Unified Analytics Component
 * Combines Activity (real-time actions) and Impact (contribution metrics)
 */
export function UnifiedAnalytics() {
  const [view, setView] = useState<'activity' | 'impact'>('activity');

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>User Analytics</CardTitle>
          <CardDescription>
            Track user activity and measure team contributions
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={view} onValueChange={(v) => setView(v as 'activity' | 'impact')}>
            <TabsList className="grid w-full grid-cols-2 max-w-md">
              <TabsTrigger value="activity" className="flex items-center gap-2">
                <Activity className="h-4 w-4" />
                Activity
              </TabsTrigger>
              <TabsTrigger value="impact" className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                Impact
              </TabsTrigger>
            </TabsList>

            <TabsContent value="activity" className="mt-6">
              <DetailedActivityAnalytics />
            </TabsContent>

            <TabsContent value="impact" className="mt-6">
              <MeaningfulUserAnalytics />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
