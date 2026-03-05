import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Clock, FileText, MessageSquare, ChevronDown, ChevronUp } from 'lucide-react';
import { useState } from 'react';
import type { MeetingNote } from '@shared/schema';

interface ProjectNotesHistoryProps {
  projectId: number;
  projectTitle?: string;
}

export function ProjectNotesHistory({ projectId, projectTitle }: ProjectNotesHistoryProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  // Fetch notes for this specific project
  const { data: notes = [], isLoading } = useQuery<MeetingNote[]>({
    queryKey: ['/api/meeting-notes', { projectId }],
    queryFn: async () => {
      const response = await fetch(`/api/meeting-notes?projectId=${projectId}`, {
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to fetch notes');
      return response.json();
    },
  });

  // Filter to only show past notes (not active ones)
  const pastNotes = notes
    .filter(note => note.status !== 'active')
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  if (isLoading) {
    return (
      <div className="text-xs text-gray-500 italic">
        Loading notes history...
      </div>
    );
  }

  if (pastNotes.length === 0) {
    return null; // Don't show anything if there are no past notes
  }

  return (
    <div className="mt-3 border-t pt-3">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center justify-between w-full text-left group"
        data-testid={`button-toggle-notes-history-${projectId}`}
      >
        <div className="flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-blue-600" />
          <span className="text-sm font-medium text-gray-700 group-hover:text-blue-600 transition-colors">
            Notes from Previous Meetings
          </span>
          <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">
            {pastNotes.length}
          </Badge>
        </div>
        {isExpanded ? (
          <ChevronUp className="w-4 h-4 text-gray-400" />
        ) : (
          <ChevronDown className="w-4 h-4 text-gray-400" />
        )}
      </button>

      {isExpanded && (
        <div className="mt-3 space-y-2 pl-6 border-l-2 border-blue-200">
          {pastNotes.map((note) => (
            <div
              key={note.id}
              className="p-3 bg-blue-50 rounded-md border border-blue-100"
              data-testid={`past-note-${note.id}`}
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                  {note.meetingId && (
                    <Badge variant="outline" className="text-xs bg-white">
                      Meeting #{note.meetingId}
                    </Badge>
                  )}
                  <Badge variant="outline" className="text-xs bg-white">
                    {note.type}
                  </Badge>
                </div>
                <div className="flex items-center gap-1 text-xs text-gray-500">
                  <Clock className="w-3 h-3" />
                  <span>
                    {new Date(note.createdAt).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </span>
                </div>
              </div>

              <div className="text-sm text-gray-700 whitespace-pre-wrap">
                {typeof note.content === 'string'
                  ? note.content
                  : JSON.stringify(note.content, null, 2)}
              </div>

              {note.createdByName && (
                <div className="mt-2 pt-2 border-t border-blue-200">
                  <span className="text-xs text-gray-600">
                    By {note.createdByName}
                  </span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
