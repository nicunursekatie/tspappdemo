import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, Users, Target, Lightbulb } from 'lucide-react';

interface GrowthOpportunity {
  org: string;
  eventCount: number;
  avgSize: number;
}

interface GrowthOpportunitiesModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  opportunities: GrowthOpportunity[];
}

export default function GrowthOpportunitiesModal({
  open,
  onOpenChange,
  opportunities,
}: GrowthOpportunitiesModalProps) {
  const sortedOpportunities = [...opportunities].sort((a, b) => b.eventCount - a.eventCount);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] max-w-4xl max-h-[85vh] overflow-y-auto p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-brand-primary flex items-center gap-2">
            <TrendingUp className="h-6 w-6" />
            Growth Opportunities
          </DialogTitle>
          <DialogDescription className="text-base">
            These partner organizations have hosted multiple events but at smaller scales.
            They're proven partners who might be ready to expand their impact.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          {opportunities.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Target className="h-12 w-12 mx-auto mb-3 text-gray-400" />
              <p>No growth opportunities identified at this time.</p>
            </div>
          ) : (
            <>
              <div className="space-y-3">
                {sortedOpportunities.map((opportunity, index) => {
                  // Estimate potential growth (conservative 50% increase)
                  const potentialSize = Math.round(opportunity.avgSize * 1.5);
                  const potentialIncrease = potentialSize - opportunity.avgSize;

                  return (
                    <Card key={opportunity.org} className="border-l-4 border-l-blue-500">
                      <CardContent className="pt-4">
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <h3 className="text-lg font-semibold text-gray-900">
                                {opportunity.org}
                              </h3>
                              <Badge className="bg-blue-100 text-blue-800">
                                {opportunity.eventCount} events
                              </Badge>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-3">
                              <div className="bg-gray-50 p-3 rounded-lg">
                                <p className="text-xs text-gray-600 mb-1">Current Average</p>
                                <p className="text-2xl font-bold text-gray-700">
                                  {opportunity.avgSize}
                                </p>
                                <p className="text-xs text-gray-500">sandwiches per event</p>
                              </div>

                              <div className="bg-green-50 p-3 rounded-lg">
                                <p className="text-xs text-gray-600 mb-1">Growth Potential</p>
                                <p className="text-2xl font-bold text-green-700">
                                  {potentialSize}
                                </p>
                                <p className="text-xs text-gray-500">with 50% increase</p>
                              </div>

                              <div className="bg-blue-50 p-3 rounded-lg">
                                <p className="text-xs text-gray-600 mb-1">Additional Impact</p>
                                <p className="text-2xl font-bold text-blue-700">
                                  +{potentialIncrease * opportunity.eventCount}
                                </p>
                                <p className="text-xs text-gray-500">sandwiches annually</p>
                              </div>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>

              <div className="mt-6 pt-4 border-t">
                <div className="bg-blue-50 p-4 rounded-lg space-y-3">
                  <div className="flex items-center gap-2 mb-3">
                    <Lightbulb className="h-5 w-5 text-brand-primary" />
                    <h4 className="font-semibold text-brand-primary">
                      Growth Conversation Starters
                    </h4>
                  </div>

                  <div className="space-y-2 text-sm text-gray-700">
                    <div className="flex items-start gap-2">
                      <div className="h-5 w-5 bg-brand-teal rounded-full flex items-center justify-center flex-shrink-0 text-white text-xs font-bold">
                        1
                      </div>
                      <div>
                        <p className="font-medium">Acknowledge Their Commitment</p>
                        <p className="text-gray-600">
                          "You've been such a reliable partner, hosting {'{eventCount}'} events with us!"
                        </p>
                      </div>
                    </div>

                    <div className="flex items-start gap-2">
                      <div className="h-5 w-5 bg-brand-teal rounded-full flex items-center justify-center flex-shrink-0 text-white text-xs font-bold">
                        2
                      </div>
                      <div>
                        <p className="font-medium">Explore Capacity</p>
                        <p className="text-gray-600">
                          "Would your organization be interested in reaching more people at your next event?"
                        </p>
                      </div>
                    </div>

                    <div className="flex items-start gap-2">
                      <div className="h-5 w-5 bg-brand-teal rounded-full flex items-center justify-center flex-shrink-0 text-white text-xs font-bold">
                        3
                      </div>
                      <div>
                        <p className="font-medium">Offer Support</p>
                        <p className="text-gray-600">
                          "We can provide extra volunteers, logistics support, and materials for larger events"
                        </p>
                      </div>
                    </div>

                    <div className="flex items-start gap-2">
                      <div className="h-5 w-5 bg-brand-teal rounded-full flex items-center justify-center flex-shrink-0 text-white text-xs font-bold">
                        4
                      </div>
                      <div>
                        <p className="font-medium">Suggest Partnership Models</p>
                        <p className="text-gray-600">
                          Consider quarterly large events, recurring monthly collections, or multi-location expansion
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-blue-200">
                    <p className="text-xs text-gray-600 italic">
                      <strong>Remember:</strong> Growing with existing partners is often easier than recruiting new ones.
                      They already understand your mission and have proven their commitment.
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-green-50 border border-green-200 p-4 rounded-lg">
                <div className="flex items-start gap-3">
                  <Users className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-green-900 mb-1">Total Potential Impact</p>
                    <p className="text-sm text-green-700">
                      If all {opportunities.length} organizations increased by 50%,
                      that's an estimated{' '}
                      <strong>
                        +{opportunities.reduce((sum, opp) =>
                          sum + (Math.round(opp.avgSize * 0.5) * opp.eventCount), 0
                        ).toLocaleString()} sandwiches
                      </strong>{' '}
                      per year from existing partners.
                    </p>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        <div className="mt-4 flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button
            onClick={() => {
              window.location.href = '/event-requests';
            }}
          >
            View Event Requests
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
