import React from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader } from '@/components/ui/card';

interface EventCardSkeletonProps {
  variant?: 'compact' | 'full';
}

/**
 * Skeleton loading state for event request cards
 * Matches the visual structure of actual event cards for smooth loading experience
 */
export const EventCardSkeleton: React.FC<EventCardSkeletonProps> = ({ variant = 'full' }) => {
  if (variant === 'compact') {
    return (
      <Card className="w-full">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 flex-1">
              {/* Status badge */}
              <Skeleton className="h-6 w-20 rounded-full" />
              {/* Organization name */}
              <Skeleton className="h-5 w-48" />
              {/* Date */}
              <Skeleton className="h-4 w-24" />
            </div>
            <div className="flex items-center gap-2">
              {/* Action buttons */}
              <Skeleton className="h-8 w-8 rounded" />
              <Skeleton className="h-8 w-8 rounded" />
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div className="space-y-2 flex-1">
            {/* Status badge and organization name */}
            <div className="flex items-center gap-2">
              <Skeleton className="h-6 w-24 rounded-full" />
              <Skeleton className="h-6 w-64" />
            </div>
            {/* Category/department */}
            <Skeleton className="h-4 w-40" />
          </div>
          {/* Menu button */}
          <Skeleton className="h-8 w-8 rounded" />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Date and time row */}
        <div className="flex items-center gap-4">
          <Skeleton className="h-4 w-4" />
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-4 w-4" />
          <Skeleton className="h-4 w-24" />
        </div>

        {/* Location */}
        <div className="flex items-start gap-4">
          <Skeleton className="h-4 w-4 mt-0.5" />
          <Skeleton className="h-4 w-56" />
        </div>

        {/* Staffing/assignments section */}
        <div className="grid grid-cols-3 gap-3 pt-2">
          <div className="space-y-1">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-5 w-24" />
          </div>
          <div className="space-y-1">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-5 w-20" />
          </div>
          <div className="space-y-1">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-5 w-28" />
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2 pt-2 border-t">
          <Skeleton className="h-8 w-24 rounded" />
          <Skeleton className="h-8 w-28 rounded" />
          <Skeleton className="h-8 w-20 rounded" />
        </div>
      </CardContent>
    </Card>
  );
};

interface EventListSkeletonProps {
  count?: number;
  variant?: 'compact' | 'full';
}

/**
 * Shows multiple skeleton cards for loading states
 */
export const EventListSkeleton: React.FC<EventListSkeletonProps> = ({
  count = 3,
  variant = 'full'
}) => {
  return (
    <div className="space-y-4 max-w-7xl mx-auto px-4">
      {Array.from({ length: count }).map((_, index) => (
        <EventCardSkeleton key={index} variant={variant} />
      ))}
    </div>
  );
};

export default EventCardSkeleton;
