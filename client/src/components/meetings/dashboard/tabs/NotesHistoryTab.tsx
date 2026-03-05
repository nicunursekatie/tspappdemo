import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
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
import { Clock, FileText, Folder, User, Filter, X, AlertCircle } from 'lucide-react';
import type { MeetingNote } from '@shared/schema';
import type { Meeting } from '../hooks/useMeetings';
import type { Project } from '../hooks/useProjects';

interface NotesHistoryTabProps {
  selectedMeeting: Meeting | null;
}

export function NotesHistoryTab({ selectedMeeting }: NotesHistoryTabProps) {
  // Filter state
  const [filterProject, setFilterProject] = useState<string>('all');
  const [filterMeeting, setFilterMeeting] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterType, setFilterType] = useState<string>('all');
  const [searchText, setSearchText] = useState('');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  // Fetch all meeting notes
  const { data: notes = [], isLoading, isError, error } = useQuery<MeetingNote[]>({
    queryKey: ['/api/meeting-notes'],
  });

  // Fetch all meetings for the filter dropdown
  const { data: meetings = [] } = useQuery<Meeting[]>({
    queryKey: ['/api/meetings'],
  });

  // Fetch all projects for the filter dropdown
  const { data: projects = [] } = useQuery<Project[]>({
    queryKey: ['/api/projects'],
  });

  // Apply filters and search
  const filteredNotes = useMemo(() => {
    let filtered = [...notes];

    // Filter by project
    if (filterProject !== 'all') {
      const projectId = parseInt(filterProject);
      filtered = filtered.filter(note => note.projectId === projectId);
    }

    // Filter by meeting
    if (filterMeeting !== 'all') {
      const meetingId = parseInt(filterMeeting);
      filtered = filtered.filter(note => note.meetingId === meetingId);
    }

    // Filter by status
    if (filterStatus !== 'all') {
      filtered = filtered.filter(note => note.status === filterStatus);
    }

    // Filter by type
    if (filterType !== 'all') {
      filtered = filtered.filter(note => note.type === filterType);
    }

    // Search in content
    if (searchText.trim()) {
      const searchLower = searchText.toLowerCase();
      filtered = filtered.filter(note => {
        const contentStr = typeof note.content === 'string'
          ? note.content
          : JSON.stringify(note.content);
        return contentStr.toLowerCase().includes(searchLower);
      });
    }

    // Filter by date range
    if (startDate) {
      const startDateTime = new Date(startDate).getTime();
      filtered = filtered.filter(note => 
        new Date(note.createdAt).getTime() >= startDateTime
      );
    }
    if (endDate) {
      const endDateTime = new Date(endDate).setHours(23, 59, 59, 999);
      filtered = filtered.filter(note => 
        new Date(note.createdAt).getTime() <= endDateTime
      );
    }

    // Sort by created date (newest first)
    // Create a copy to avoid mutating the filtered array
    return [...filtered].sort((a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }, [notes, filterProject, filterMeeting, filterStatus, filterType, searchText, startDate, endDate]);

  // Get unique projects and meetings that have notes
  const projectsWithNotes = useMemo(() => {
    const projectIds = new Set(notes.map(n => n.projectId));
    return projects.filter(p => projectIds.has(p.id));
  }, [notes, projects]);

  const meetingsWithNotes = useMemo(() => {
    const meetingIds = new Set(notes.map(n => n.meetingId).filter(Boolean) as number[]);
    return meetings.filter(m => meetingIds.has(m.id));
  }, [notes, meetings]);

  // Check if any filters are active
  const hasActiveFilters = filterProject !== 'all' || 
                          filterMeeting !== 'all' || 
                          filterStatus !== 'all' || 
                          filterType !== 'all' || 
                          searchText.trim() !== '' ||
                          startDate !== '' ||
                          endDate !== '';

  // Clear all filters
  const clearFilters = () => {
    setFilterProject('all');
    setFilterMeeting('all');
    setFilterStatus('all');
    setFilterType('all');
    setSearchText('');
    setStartDate('');
    setEndDate('');
  };

  // Get project name by ID
  const getProjectName = (projectId: number) => {
    const project = projects.find(p => p.id === projectId);
    return project?.title || `Project #${projectId}`;
  };

  // Get meeting title by ID
  const getMeetingTitle = (meetingId: number | null) => {
    if (!meetingId) return null;
    const meeting = meetings.find(m => m.id === meetingId);
    if (!meeting) return `Meeting #${meetingId}`;
    return `${meeting.title || 'Meeting'} - ${new Date(meeting.date).toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric' 
    })}`;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-teal-600 border-r-transparent mb-4"></div>
          <div className="text-gray-500">Loading notes history...</div>
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <Card className="border-red-200 bg-red-50">
        <CardContent className="py-12">
          <div className="text-center text-red-700">
            <AlertCircle className="w-12 h-12 mx-auto mb-4 text-red-400" />
            <p className="text-lg font-medium">Error Loading Notes</p>
            <p className="text-sm mt-2">
              {error instanceof Error ? error.message : 'An unexpected error occurred'}
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (notes.length === 0) {
    return (
      <Card>
        <CardContent className="py-12">
          <div className="text-center text-gray-500">
            <FileText className="w-12 h-12 mx-auto mb-4 text-gray-300" />
            <p className="text-lg font-medium">No notes yet</p>
            <p className="text-sm mt-2">Meeting notes will appear here once created</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-gray-900">
          Notes History
        </h2>
        <Badge variant="outline" className="text-gray-600">
          {filteredNotes.length} of {notes.length} {notes.length === 1 ? 'note' : 'notes'}
        </Badge>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-teal-600" />
              <CardTitle className="text-base">Filter Notes</CardTitle>
            </div>
            {hasActiveFilters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearFilters}
                className="text-teal-600 hover:text-teal-700"
              >
                <X className="w-4 h-4 mr-1" />
                Clear Filters
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Search */}
          <div className="space-y-2">
            <Label htmlFor="search-notes" className="text-sm font-medium">
              Search Content
            </Label>
            <Input
              id="search-notes"
              data-testid="input-search-notes"
              placeholder="Search in note content..."
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              className="w-full"
            />
          </div>

          {/* Filter Row */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Project Filter */}
            <div className="space-y-2">
              <Label htmlFor="filter-project" className="text-sm font-medium">
                Project
              </Label>
              <Select value={filterProject} onValueChange={setFilterProject}>
                <SelectTrigger id="filter-project" data-testid="select-filter-project">
                  <SelectValue placeholder="All projects" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Projects</SelectItem>
                  {projectsWithNotes.map((project) => (
                    <SelectItem key={project.id} value={project.id.toString()}>
                      {project.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Meeting Filter */}
            <div className="space-y-2">
              <Label htmlFor="filter-meeting" className="text-sm font-medium">
                Meeting
              </Label>
              <Select value={filterMeeting} onValueChange={setFilterMeeting}>
                <SelectTrigger id="filter-meeting" data-testid="select-filter-meeting">
                  <SelectValue placeholder="All meetings" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Meetings</SelectItem>
                  {meetingsWithNotes.map((meeting) => (
                    <SelectItem key={meeting.id} value={meeting.id.toString()}>
                      {meeting.title || 'Untitled'} - {new Date(meeting.date).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric'
                      })}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Status Filter */}
            <div className="space-y-2">
              <Label htmlFor="filter-status" className="text-sm font-medium">
                Status
              </Label>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger id="filter-status" data-testid="select-filter-status">
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="used">Used</SelectItem>
                  <SelectItem value="archived">Archived</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Type Filter */}
            <div className="space-y-2">
              <Label htmlFor="filter-type" className="text-sm font-medium">
                Type
              </Label>
              <Select value={filterType} onValueChange={setFilterType}>
                <SelectTrigger id="filter-type" data-testid="select-filter-type">
                  <SelectValue placeholder="All types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="discussion">Discussion</SelectItem>
                  <SelectItem value="meeting">Meeting</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Date Range Filters */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="filter-start-date" className="text-sm font-medium">
                From Date
              </Label>
              <Input
                id="filter-start-date"
                data-testid="input-filter-start-date"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="filter-end-date" className="text-sm font-medium">
                To Date
              </Label>
              <Input
                id="filter-end-date"
                data-testid="input-filter-end-date"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Notes List */}
      {filteredNotes.length === 0 ? (
        <Card>
          <CardContent className="py-12">
            <div className="text-center text-gray-500">
              <FileText className="w-12 h-12 mx-auto mb-4 text-gray-300" />
              <p className="text-lg font-medium">No matching notes</p>
              <p className="text-sm mt-2">
                Try adjusting your filters or search criteria
              </p>
              {hasActiveFilters && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={clearFilters}
                  className="mt-4"
                >
                  Clear All Filters
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredNotes.map((note) => (
            <Card key={note.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Folder className="w-4 h-4 text-teal-600 flex-shrink-0" />
                    <span className="text-sm font-medium text-gray-900">
                      {getProjectName(note.projectId)}
                    </span>
                    {note.meetingId && (
                      <>
                        <span className="text-gray-400">•</span>
                        <span className="text-sm text-gray-600">
                          {getMeetingTitle(note.meetingId)}
                        </span>
                      </>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Badge 
                      variant={note.status === 'active' ? 'default' : 'outline'}
                      className={
                        note.status === 'active' 
                          ? 'bg-green-100 text-green-700 hover:bg-green-100' 
                          : note.status === 'used'
                            ? 'bg-blue-100 text-blue-700 hover:bg-blue-100'
                            : 'bg-gray-100 text-gray-600'
                      }
                    >
                      {note.status}
                    </Badge>
                    <Badge variant="outline" className="text-xs">
                      {note.type}
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="prose prose-sm max-w-none">
                  <div className="text-gray-700 whitespace-pre-wrap bg-gray-50 p-3 rounded-md border border-gray-200">
                    {typeof note.content === 'string' 
                      ? note.content 
                      : JSON.stringify(note.content, null, 2)}
                  </div>
                </div>
                
                <Separator />
                
                <div className="flex items-center justify-between text-xs text-gray-500">
                  <div className="flex items-center gap-4">
                    {note.createdByName && (
                      <div className="flex items-center gap-1">
                        <User className="w-3 h-3" />
                        <span>{note.createdByName}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      <span>
                        {new Date(note.createdAt).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                          hour: 'numeric',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
