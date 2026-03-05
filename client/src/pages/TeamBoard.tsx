import { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useToast } from '@/hooks/use-toast';
import { useOnboardingTracker } from '@/hooks/useOnboardingTracker';
import { useActivityTracker } from '@/hooks/useActivityTracker';
import { MentionTextarea, MessageWithMentions } from '@/components/mention-input';
import { PageBreadcrumbs } from '@/components/page-breadcrumbs';
import {
  Loader2,
  Plus,
  CheckCircle2,
  Clock,
  Lightbulb,
  ClipboardList,
  StickyNote,
  Trash2,
  Search,
  X,
  User,
  MessageSquare,
  Send,
  ChevronDown,
  ChevronUp,
  UserPlus,
  Copy,
  Heart
} from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useAuth } from '@/hooks/useAuth';

// Helper to safely flatten assignment arrays (fixes corrupted nested array data)
function safelyFlattenArray(arr: unknown): string[] {
  if (!Array.isArray(arr)) return [];
  return arr.flat().filter((item): item is string => typeof item === 'string');
}

type BoardItemType = 'task' | 'note' | 'idea' | 'reminder';
type BoardItemStatus = 'open' | 'claimed' | 'done';

interface TeamBoardItem {
  id: number;
  content: string;
  type: BoardItemType;
  status: BoardItemStatus;
  createdBy: string;
  createdByName: string;
  assignedTo: string[] | null;
  assignedToNames: string[] | null;
  completedAt: Date | null;
  createdAt: Date;
  commentCount: number;
}

interface TeamBoardComment {
  id: number;
  itemId: number;
  userId: string;
  userName: string;
  content: string;
  createdAt: Date;
}

interface TeamMember {
  id: string;
  email: string;
  name: string;
}

// Helper to get initials from name
const getInitials = (name: string | null | undefined) => {
  if (!name || typeof name !== 'string') return '??';
  const parts = name.trim().split(' ');
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
};

// Helper to get consistent avatar color based on name
const getAvatarColor = (name: string | null | undefined) => {
  const colors = [
    'bg-[#236383]', // Primary blue
    'bg-[#007E8C]', // Teal
    'bg-[#47B3CB]', // Light blue
    'bg-[#FBAD3F]', // Orange/gold
    'bg-[#A31C41]', // Red
    'bg-[#236383]', // Primary blue (repeat for variety)
    'bg-[#007E8C]', // Teal (repeat)
    'bg-[#47B3CB]', // Light blue (repeat)
  ];
  if (!name || typeof name !== 'string') return colors[0];
  const index = name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) % colors.length;
  return colors[index];
};

// Comments component for team board items
function ItemComments({ itemId, initialCommentCount }: { itemId: number; initialCommentCount: number }) {
  const { toast } = useToast();
  const { user } = useAuth();
  const { track } = useOnboardingTracker();
  const [isExpanded, setIsExpanded] = useState(false);
  const [newComment, setNewComment] = useState('');

  // Fetch comments for this item
  const { data: comments = [], isLoading } = useQuery<TeamBoardComment[]>({
    queryKey: ['/api/team-board', itemId, 'comments'],
    queryFn: async () => {
      const res = await fetch(`/api/team-board/${itemId}/comments`, {
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to fetch comments');
      return res.json();
    },
    enabled: isExpanded, // Only fetch when expanded
  });

  // Create comment mutation
  const createCommentMutation = useMutation({
    mutationFn: async (content: string) => {
      return await apiRequest('POST', `/api/team-board/${itemId}/comments`, { content });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/team-board', itemId, 'comments'] });
      queryClient.invalidateQueries({ queryKey: ['/api/team-board'] }); // Refresh item list for updated counts
      setNewComment('');
      toast({
        title: 'Comment posted',
        description: 'Your comment has been added',
      });

      // Track engagement challenge (commenting shows engagement like "liking" would)
      track('like_team_board_post');
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to post comment',
        variant: 'destructive',
      });
    },
  });

  // Delete comment mutation
  const deleteCommentMutation = useMutation({
    mutationFn: async (commentId: number) => {
      return await apiRequest('DELETE', `/api/team-board/comments/${commentId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/team-board', itemId, 'comments'] });
      queryClient.invalidateQueries({ queryKey: ['/api/team-board'] }); // Refresh item list for updated counts
      toast({
        title: 'Comment deleted',
        description: 'The comment has been removed',
      });
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to delete comment',
        variant: 'destructive',
      });
    },
  });

  const handleSubmitComment = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!newComment.trim()) return;
    createCommentMutation.mutate(newComment.trim());
  };

  const handleDeleteComment = (commentId: number) => {
    if (confirm('Delete this comment?')) {
      deleteCommentMutation.mutate(commentId);
    }
  };

  return (
    <div className="border-t border-[#47B3CB]/30 dark:border-[#236383] mt-4 pt-3">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center justify-between w-full text-sm text-[#007E8C] dark:text-[#47B3CB] hover:text-[#236383] dark:hover:text-[#FBAD3F] transition-colors"
        data-testid={`button-comments-toggle-${itemId}`}
      >
        <div className="flex items-center gap-2">
          <MessageSquare className="h-4 w-4" />
          <span className="font-medium">
            {initialCommentCount} {initialCommentCount === 1 ? 'Comment' : 'Comments'}
          </span>
        </div>
        {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
      </button>

      {isExpanded && (
        <div className="mt-3 space-y-3">
          {/* Comments list */}
          {isLoading ? (
            <div className="flex justify-center py-4">
              <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
            </div>
          ) : comments.length > 0 ? (
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {comments.map((comment) => (
                <div
                  key={comment.id}
                  className="bg-[#47B3CB]/10 dark:bg-[#236383]/30 rounded-lg p-3 border border-[#47B3CB]/20 dark:border-[#236383]"
                  data-testid={`comment-${comment.id}`}
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2">
                      <Avatar className={`h-5 w-5 ${getAvatarColor(comment.userName)}`}>
                        <AvatarFallback className="text-white text-xs">
                          {getInitials(comment.userName)}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                        {comment.userName}
                      </span>
                      <span className="text-xs text-gray-400">
                        {new Date(comment.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                    {user?.id === comment.userId && (
                      <button
                        onClick={() => handleDeleteComment(comment.id)}
                        className="text-gray-400 hover:text-red-600 dark:hover:text-red-400"
                        data-testid={`button-delete-comment-${comment.id}`}
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                  <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                    <MessageWithMentions content={comment.content} />
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-gray-400 dark:text-gray-500 text-center py-2">
              No comments yet. Be the first to comment!
            </p>
          )}

          {/* Add comment form */}
          <form onSubmit={handleSubmitComment} className="flex gap-2 items-end">
            <MentionTextarea
              value={newComment}
              onChange={setNewComment}
              onSubmit={() => {
                if (newComment.trim()) {
                  handleSubmitComment();
                }
              }}
              placeholder="Add a comment... (Type @ to mention someone)"
              className="text-sm min-h-[60px] max-h-[200px] resize-y"
              dataTestId={`input-new-comment-${itemId}`}
              disabled={createCommentMutation.isPending}
            />
            <Button
              type="submit"
              size="sm"
              disabled={!newComment.trim() || createCommentMutation.isPending}
              className="bg-teal-600 hover:bg-teal-700 dark:bg-teal-700 dark:hover:bg-teal-600"
              data-testid={`button-submit-comment-${itemId}`}
            >
              {createCommentMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </form>
        </div>
      )}
    </div>
  );
}

// Component for creating multiple tasks from a template
function CreateMultipleTasksDialog({ sourceItem }: { sourceItem: TeamBoardItem }) {
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [taskInput, setTaskInput] = useState('');
  const [inheritAssignments, setInheritAssignments] = useState(true);

  // Mutation for creating multiple tasks
  const createMultipleMutation = useMutation({
    mutationFn: async (tasks: Array<{ content: string; type: BoardItemType; assignedTo?: string[] | null; assignedToNames?: string[] | null }>) => {
      // Create all tasks in parallel
      const promises = tasks.map(task => 
        apiRequest('POST', '/api/team-board', task)
      );
      return await Promise.all(promises);
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/team-board'] });
      setIsOpen(false);
      setTaskInput('');
      toast({
        title: 'Tasks created!',
        description: `Successfully created ${data.length} task${data.length > 1 ? 's' : ''}`,
      });
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to create tasks',
        variant: 'destructive',
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Split by newlines and filter out empty lines
    const taskLines = taskInput
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0);

    if (taskLines.length === 0) {
      toast({
        title: 'No tasks entered',
        description: 'Please enter at least one task (one per line)',
        variant: 'destructive',
      });
      return;
    }

    // Create task objects
    const tasks = taskLines.map(content => ({
      content,
      type: sourceItem.type,
      ...(inheritAssignments && sourceItem.assignedTo && sourceItem.assignedToNames ? {
        assignedTo: sourceItem.assignedTo,
        assignedToNames: sourceItem.assignedToNames,
      } : {}),
    }));

    createMultipleMutation.mutate(tasks);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0 text-gray-400 hover:text-[#236383] dark:text-gray-500 dark:hover:text-[#47B3CB]"
          title="Create multiple tasks from this item"
          data-testid={`button-create-multiple-${sourceItem.id}`}
        >
          <Copy className="h-3.5 w-3.5" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Create Multiple Tasks</DialogTitle>
            <DialogDescription>
              Create multiple related tasks based on: <span className="font-semibold italic">"{sourceItem.content}"</span>
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label htmlFor="tasks" className="text-sm font-medium">
                Enter task names (one per line)
              </label>
              <Textarea
                id="tasks"
                value={taskInput}
                onChange={(e) => setTaskInput(e.target.value)}
                placeholder="get chet onboarded&#10;get noel onboarded&#10;get alison onboarded"
                className="min-h-[150px] font-mono text-sm"
                data-testid="input-multiple-tasks"
              />
              <p className="text-xs text-gray-500">
                Each line will become a separate {sourceItem.type}
              </p>
            </div>

            {sourceItem.assignedTo && sourceItem.assignedToNames && sourceItem.assignedTo.length > 0 && (
              <div className="flex items-start gap-2 p-3 bg-gray-50 dark:bg-gray-800 rounded-md">
                <input
                  type="checkbox"
                  id="inheritAssignments"
                  checked={inheritAssignments}
                  onChange={(e) => setInheritAssignments(e.target.checked)}
                  className="mt-1"
                  data-testid="checkbox-inherit-assignments"
                />
                <label htmlFor="inheritAssignments" className="text-sm flex-1 cursor-pointer">
                  <div className="font-medium mb-1">Copy assignments to new tasks</div>
                  <div className="text-xs text-gray-600 dark:text-gray-400">
                    Assign to: {sourceItem.assignedToNames.join(', ')}
                  </div>
                </label>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsOpen(false)}
              disabled={createMultipleMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!taskInput.trim() || createMultipleMutation.isPending}
              className="bg-teal-600 hover:bg-teal-700"
              data-testid="button-submit-multiple-tasks"
            >
              {createMultipleMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Creating...
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Tasks
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function TeamBoard() {
  const { toast } = useToast();
  const { user } = useAuth();
  const { track } = useOnboardingTracker();
  const { trackView, trackClick, trackCreate } = useActivityTracker();
  const [newItemContent, setNewItemContent] = useState('');
  const [newItemType, setNewItemType] = useState<BoardItemType>('task');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<BoardItemType | 'all'>('all');

  // Track page visit for onboarding challenge and activity tracking
  useEffect(() => {
    trackView(
      'Team Board',
      'Team Board',
      'Team Board',
      'User accessed team board'
    );
  }, [trackView]);

  // Track onboarding
  useEffect(() => {
    track('view_team_board');
  }, []);

  // Fetch board items
  const { data: items = [], isLoading } = useQuery<TeamBoardItem[]>({
    queryKey: ['/api/team-board'],
  });

  // Fetch team members for assignment
  const { data: teamMembers = [] } = useQuery<TeamMember[]>({
    queryKey: ['/api/team-board/users'],
  });

  // Filter items based on search and type
  const filteredItems = useMemo(() => {
    return items.filter(item => {
      const matchesSearch = !searchQuery || 
        item.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.createdByName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.assignedToNames?.some(name => name.toLowerCase().includes(searchQuery.toLowerCase()));
      
      const matchesType = filterType === 'all' || item.type === filterType;
      
      return matchesSearch && matchesType;
    });
  }, [items, searchQuery, filterType]);

  // Create item mutation
  const createItemMutation = useMutation({
    mutationFn: async (data: { content: string; type: BoardItemType }) => {
      return await apiRequest('POST', '/api/team-board', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/team-board'] });
      setNewItemContent('');
      toast({
        title: 'Posted!',
        description: 'Your item has been added to the board',
      });
      // Track challenge completion
      track('post_team_board');
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to create item',
        variant: 'destructive',
      });
    },
  });

  // Update item mutation
  const updateItemMutation = useMutation({
    mutationFn: async ({ 
      id, 
      updates 
    }: { 
      id: number; 
      updates: {
        status?: BoardItemStatus;
        assignedTo?: string[] | null;
        assignedToNames?: string[] | null;
        completedAt?: string | null;
      };
    }) => {
      return await apiRequest('PATCH', `/api/team-board/${id}`, updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/team-board'] });
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to update item',
        variant: 'destructive',
      });
    },
  });

  // Delete item mutation
  const deleteItemMutation = useMutation({
    mutationFn: async (id: number) => {
      return await apiRequest('DELETE', `/api/team-board/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/team-board'] });
      toast({
        title: 'Deleted',
        description: 'Item removed from board',
      });
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to delete item',
        variant: 'destructive',
      });
    },
  });

  // Like/Unlike item mutations
  const toggleLikeMutation = useMutation({
    mutationFn: async ({ itemId, isLiked }: { itemId: number; isLiked: boolean }) => {
      if (isLiked) {
        return await apiRequest('DELETE', `/api/team-board/items/${itemId}/like`);
      } else {
        return await apiRequest('POST', `/api/team-board/items/${itemId}/like`);
      }
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [`/api/team-board/items/${variables.itemId}/likes`] });
      if (!variables.isLiked) {
        // Track the like action for onboarding challenge
        track('like_team_board_post');
      }
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to update like',
        variant: 'destructive',
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItemContent.trim()) return;

    createItemMutation.mutate({
      content: newItemContent.trim(),
      type: newItemType,
    });
  };

  const handleClaim = (item: TeamBoardItem) => {
    if (!user) return;

    const displayName = user.displayName || `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email;

    // Flatten arrays in case of corrupted data (nested arrays)
    const currentAssignedTo = Array.isArray(item.assignedTo)
      ? item.assignedTo.flat().filter((id): id is string => typeof id === 'string')
      : [];
    const currentAssignedToNames = Array.isArray(item.assignedToNames)
      ? item.assignedToNames.flat().filter((name): name is string => typeof name === 'string')
      : [];

    if (currentAssignedTo.includes(user.id)) {
      toast({
        title: 'Already assigned',
        description: 'You are already working on this item',
      });
      return;
    }

    updateItemMutation.mutate({
      id: item.id,
      updates: {
        status: 'claimed',
        assignedTo: [...currentAssignedTo, user.id],
        assignedToNames: [...currentAssignedToNames, displayName],
      },
    });
  };

  const handleAssignToUser = (item: TeamBoardItem, userId: string) => {
    const member = teamMembers.find(m => m.id === userId);
    if (!member) return;
    
    const currentAssignedTo = safelyFlattenArray(item.assignedTo);
    const currentAssignedToNames = safelyFlattenArray(item.assignedToNames);
    
    if (currentAssignedTo.includes(member.id)) {
      toast({
        title: 'Already assigned',
        description: `${member.name} is already working on this item`,
      });
      return;
    }
    
    updateItemMutation.mutate({
      id: item.id,
      updates: {
        status: 'claimed',
        assignedTo: [...currentAssignedTo, member.id],
        assignedToNames: [...currentAssignedToNames, member.name],
      },
    }, {
      onSuccess: () => {
        toast({
          title: 'Assigned!',
          description: `Task assigned to ${member.name}`,
        });
      },
      onError: () => {
        toast({
          title: 'Assignment failed',
          description: 'Could not assign task. Please try again.',
          variant: 'destructive',
        });
      },
    });
  };

  const handleComplete = (item: TeamBoardItem) => {
    updateItemMutation.mutate({
      id: item.id,
      updates: {
        status: 'done',
        completedAt: new Date().toISOString(),
      },
    });
  };

  const handleReopen = (item: TeamBoardItem) => {
    updateItemMutation.mutate({
      id: item.id,
      updates: {
        status: 'open',
        assignedTo: null,
        assignedToNames: null,
        completedAt: null,
      },
    });
  };

  const handleUnassign = (item: TeamBoardItem, userId: string) => {
    // Flatten arrays in case of corrupted data (nested arrays)
    const currentAssignedTo = Array.isArray(item.assignedTo)
      ? item.assignedTo.flat().filter((id): id is string => typeof id === 'string')
      : [];
    const currentAssignedToNames = Array.isArray(item.assignedToNames)
      ? item.assignedToNames.flat().filter((name): name is string => typeof name === 'string')
      : [];

    const userIndex = currentAssignedTo.indexOf(userId);
    if (userIndex === -1) return;

    const newAssignedTo = currentAssignedTo.filter((_, i) => i !== userIndex);
    const newAssignedToNames = currentAssignedToNames.filter((_, i) => i !== userIndex);

    updateItemMutation.mutate({
      id: item.id,
      updates: {
        assignedTo: newAssignedTo.length === 0 ? null : newAssignedTo,
        assignedToNames: newAssignedToNames.length === 0 ? null : newAssignedToNames,
      },
    });
  };

  const handleDelete = (id: number) => {
    if (confirm('Are you sure you want to delete this item?')) {
      deleteItemMutation.mutate(id);
    }
  };

  const getTypeIcon = (type: BoardItemType) => {
    switch (type) {
      case 'task':
        return <ClipboardList className="h-4 w-4" />;
      case 'idea':
        return <Lightbulb className="h-4 w-4" />;
      case 'reminder':
        return <Clock className="h-4 w-4" />;
      case 'note':
      default:
        return <StickyNote className="h-4 w-4" />;
    }
  };

  const getTypeColor = (type: BoardItemType) => {
    switch (type) {
      case 'task':
        return 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300';
      case 'idea':
        return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-300';
      case 'reminder':
        return 'bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300';
      case 'note':
      default:
        return 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300';
    }
  };

  // Group items by status
  const openItems = filteredItems.filter(item => item.status === 'open');
  const claimedItems = filteredItems.filter(item => item.status === 'claimed');
  const doneItems = filteredItems.filter(item => item.status === 'done');

  // Like Button Component
  const LikeButton = ({ itemId }: { itemId: number }) => {
    const { data: likesData } = useQuery({
      queryKey: [`/api/team-board/items/${itemId}/likes`],
      queryFn: async () => {
        return await apiRequest('GET', `/api/team-board/items/${itemId}/likes`);
      },
    });

    const isLiked = likesData?.userHasLiked || false;
    const likeCount = likesData?.likes || 0;

    return (
      <Button
        variant="ghost"
        size="sm"
        onClick={() => toggleLikeMutation.mutate({ itemId, isLiked })}
        className={`h-7 px-2 gap-1 ${isLiked ? 'text-red-500 hover:text-red-600' : 'text-gray-400 hover:text-red-500'}`}
        data-testid={`button-like-${itemId}`}
      >
        <Heart className={`h-3.5 w-3.5 ${isLiked ? 'fill-current' : ''}`} />
        {likeCount > 0 && <span className="text-xs">{likeCount}</span>}
      </Button>
    );
  };

  return (
    <div className="container mx-auto p-4 sm:p-6 max-w-7xl">
      <PageBreadcrumbs segments={[
        { label: 'Communication' },
        { label: 'Team Board' }
      ]} />

      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">
          Team Board
        </h1>
        <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400">
          Share tasks, ideas, and updates with the team
        </p>
      </div>

      {/* Quick Add Form */}
      <Card className="mb-6 border-teal-200 dark:border-teal-800 shadow-sm">
        <CardContent className="pt-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-3">
              <Select
                value={newItemType}
                onValueChange={(value: BoardItemType) => setNewItemType(value)}
              >
                <SelectTrigger className="w-full sm:w-[140px]" data-testid="select-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="task">Task</SelectItem>
                  <SelectItem value="note">Note</SelectItem>
                  <SelectItem value="idea">Idea</SelectItem>
                  <SelectItem value="reminder">Reminder</SelectItem>
                </SelectContent>
              </Select>

              <Textarea
                value={newItemContent}
                onChange={(e) => setNewItemContent(e.target.value)}
                placeholder="What's on your mind? Type a task, idea, note, or reminder..."
                className="flex-1 min-h-[60px] resize-none"
                data-testid="input-content"
              />
            </div>

            <div className="flex justify-end">
              <Button
                type="submit"
                disabled={!newItemContent.trim() || createItemMutation.isPending}
                className="bg-teal-600 hover:bg-teal-700 dark:bg-teal-700 dark:hover:bg-teal-600"
                data-testid="button-post"
              >
                {createItemMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Plus className="h-4 w-4 mr-2" />
                )}
                Post to Board
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Search and Filter */}
      <div className="mb-6 flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            type="text"
            placeholder="Search items..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 pr-10"
            data-testid="input-search"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <Select
          value={filterType}
          onValueChange={(value: BoardItemType | 'all') => setFilterType(value)}
        >
          <SelectTrigger className="w-full sm:w-[160px]" data-testid="select-filter">
            <SelectValue placeholder="Filter by type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="task">Tasks</SelectItem>
            <SelectItem value="note">Notes</SelectItem>
            <SelectItem value="idea">Ideas</SelectItem>
            <SelectItem value="reminder">Reminders</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Board Items */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-teal-600" />
        </div>
      ) : filteredItems.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <StickyNote className="h-12 w-12 text-gray-300 dark:text-gray-600 mb-4" />
            <p className="text-gray-500 dark:text-gray-400 text-center">
              {searchQuery || filterType !== 'all' 
                ? 'No items match your search'
                : 'No items yet. Post the first one!'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 md:grid-cols-3">
          {/* Open Items Column */}
          <div className="space-y-3">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-gray-400"></div>
                Open
                <span className="text-sm font-normal text-gray-500">({openItems.length})</span>
              </h2>
            </div>
            <div className="space-y-3">
              {openItems.map((item) => (
                <Card 
                  key={item.id} 
                  className="hover:shadow-lg transition-all duration-200 border-l-4 border-l-gray-400" 
                  data-testid={`card-item-${item.id}`}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <Badge variant="secondary" className={`capitalize ${getTypeColor(item.type)} flex items-center gap-1`}>
                        {getTypeIcon(item.type)}
                        {item.type}
                      </Badge>
                      <div className="flex items-center gap-1">
                        <LikeButton itemId={item.id} />
                        <CreateMultipleTasksDialog sourceItem={item} />
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(item.id)}
                          className="h-7 w-7 p-0 text-gray-400 hover:text-red-600 dark:text-gray-500 dark:hover:text-red-400"
                          data-testid={`button-delete-${item.id}`}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                    
                    <p className="text-sm text-gray-700 dark:text-gray-300 mb-4 whitespace-pre-wrap leading-relaxed">
                      {item.content}
                    </p>
                    
                    <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 mb-3">
                      <Avatar className={`h-6 w-6 ${getAvatarColor(item.createdByName)}`}>
                        <AvatarFallback className="text-white text-xs">
                          {getInitials(item.createdByName)}
                        </AvatarFallback>
                      </Avatar>
                      <span className="font-medium">{item.createdByName}</span>
                      <span>•</span>
                      <span>{new Date(item.createdAt).toLocaleDateString()}</span>
                    </div>

                    {item.assignedTo && item.assignedToNames && item.assignedTo.length > 0 && (
                      <div className="mb-3 px-3 py-2 rounded-lg" style={{ backgroundColor: '#E6F4F6', borderLeft: '3px solid #007E8C' }}>
                        <div className="flex items-start gap-2 text-xs mb-2">
                          <UserPlus className="h-3.5 w-3.5 mt-0.5" style={{ color: '#007E8C' }} />
                          <span className="font-medium" style={{ color: '#236383' }}>
                            Assigned to:
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {item.assignedToNames.map((name, index) => (
                            <div
                              key={index}
                              className="flex items-center gap-1.5 bg-white dark:bg-gray-800 px-2 py-1 rounded-md border border-gray-200 dark:border-gray-700"
                              data-testid={`assigned-user-${item.id}-${index}`}
                            >
                              <Avatar className={`h-4 w-4 ${getAvatarColor(name)}`}>
                                <AvatarFallback className="text-white text-[8px]">
                                  {getInitials(name)}
                                </AvatarFallback>
                              </Avatar>
                              <span className="text-xs font-medium text-gray-700 dark:text-gray-300">{name}</span>
                              <button
                                onClick={() => handleUnassign(item, item.assignedTo![index])}
                                className="text-gray-400 hover:text-red-600 dark:hover:text-red-400 ml-1"
                                data-testid={`button-unassign-${item.id}-${index}`}
                                title="Remove assignee"
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="space-y-2">
                      <Button
                        onClick={() => handleClaim(item)}
                        disabled={updateItemMutation.isPending}
                        className="w-full bg-teal-600 hover:bg-teal-700 dark:bg-teal-700 dark:hover:bg-teal-600 text-sm"
                        size="sm"
                        data-testid={`button-claim-${item.id}`}
                      >
                        <User className="h-3.5 w-3.5 mr-1.5" />
                        I'll Handle This
                      </Button>

                      <div className="relative">
                        <div className="absolute inset-0 flex items-center">
                          <div className="w-full border-t border-gray-200 dark:border-gray-700"></div>
                        </div>
                        <div className="relative flex justify-center text-xs uppercase">
                          <span className="bg-white dark:bg-gray-900 px-2 text-gray-500 dark:text-gray-400">or assign to</span>
                        </div>
                      </div>

                      <Select onValueChange={(userId) => handleAssignToUser(item, userId)}>
                        <SelectTrigger className="w-full text-sm" data-testid={`select-assign-${item.id}`}>
                          <div className="flex items-center gap-1.5">
                            <UserPlus className="h-3.5 w-3.5" />
                            <SelectValue placeholder="Choose team member" />
                          </div>
                        </SelectTrigger>
                        <SelectContent>
                          {teamMembers.map((member) => (
                            <SelectItem key={member.id} value={member.id}>
                              {member.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Comments section */}
                    <ItemComments itemId={item.id} initialCommentCount={item.commentCount} />
                  </CardContent>
                </Card>
              ))}
              {openItems.length === 0 && (
                <div className="text-center py-8 text-sm text-gray-400 dark:text-gray-500">
                  No open items
                </div>
              )}
            </div>
          </div>

          {/* In Progress Column */}
          <div className="space-y-3">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                In Progress
                <span className="text-sm font-normal text-gray-500">({claimedItems.length})</span>
              </h2>
            </div>
            <div className="space-y-3">
              {claimedItems.map((item) => (
                <Card 
                  key={item.id} 
                  className="hover:shadow-lg transition-all duration-200 border-l-4 border-l-blue-500" 
                  data-testid={`card-item-${item.id}`}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <Badge variant="secondary" className={`capitalize ${getTypeColor(item.type)} flex items-center gap-1`}>
                        {getTypeIcon(item.type)}
                        {item.type}
                      </Badge>
                      <div className="flex items-center gap-1">
                        <LikeButton itemId={item.id} />
                        <CreateMultipleTasksDialog sourceItem={item} />
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(item.id)}
                          className="h-7 w-7 p-0 text-gray-400 hover:text-red-600 dark:text-gray-500 dark:hover:text-red-400"
                          data-testid={`button-delete-${item.id}`}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                    
                    <p className="text-sm text-gray-700 dark:text-gray-300 mb-4 whitespace-pre-wrap leading-relaxed">
                      {item.content}
                    </p>
                    
                    <div className="space-y-2 mb-4">
                      <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                        <Avatar className={`h-6 w-6 ${getAvatarColor(item.createdByName)}`}>
                          <AvatarFallback className="text-white text-xs">
                            {getInitials(item.createdByName)}
                          </AvatarFallback>
                        </Avatar>
                        <span>Posted by <span className="font-medium">{item.createdByName}</span></span>
                      </div>
                      {item.assignedToNames && item.assignedToNames.length > 0 && (
                        <div className="space-y-1">
                          <div className="text-xs text-blue-600 dark:text-blue-400 font-medium">
                            Working on it:
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {item.assignedToNames.map((name, index) => (
                              <div
                                key={index}
                                className="flex items-center gap-1.5 bg-blue-50 dark:bg-blue-950 px-2 py-1 rounded-md border border-blue-200 dark:border-blue-800"
                                data-testid={`assigned-user-progress-${item.id}-${index}`}
                              >
                                <Avatar className={`h-4 w-4 ${getAvatarColor(name)}`}>
                                  <AvatarFallback className="text-white text-[8px]">
                                    {getInitials(name)}
                                  </AvatarFallback>
                                </Avatar>
                                <span className="text-xs font-medium text-blue-700 dark:text-blue-300">{name}</span>
                                <button
                                  onClick={() => handleUnassign(item, item.assignedTo![index])}
                                  className="text-blue-400 hover:text-red-600 dark:hover:text-red-400 ml-1"
                                  data-testid={`button-unassign-progress-${item.id}-${index}`}
                                  title="Remove assignee"
                                >
                                  <X className="h-3 w-3" />
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="flex gap-2">
                      <Button
                        onClick={() => handleComplete(item)}
                        disabled={updateItemMutation.isPending}
                        className="flex-1 bg-green-600 hover:bg-green-700 text-sm min-w-0"
                        size="sm"
                        data-testid={`button-complete-${item.id}`}
                      >
                        <CheckCircle2 className="h-3.5 w-3.5 mr-1.5 flex-shrink-0" />
                        <span className="truncate">Mark Done</span>
                      </Button>
                      <Button
                        onClick={() => handleReopen(item)}
                        disabled={updateItemMutation.isPending}
                        variant="outline"
                        size="sm"
                        className="flex-1 text-sm min-w-0"
                        data-testid={`button-reopen-${item.id}`}
                      >
                        <span className="truncate">Reopen</span>
                      </Button>
                    </div>

                    {/* Comments section */}
                    <ItemComments itemId={item.id} initialCommentCount={item.commentCount} />
                  </CardContent>
                </Card>
              ))}
              {claimedItems.length === 0 && (
                <div className="text-center py-8 text-sm text-gray-400 dark:text-gray-500">
                  No items in progress
                </div>
              )}
            </div>
          </div>

          {/* Done Column */}
          <div className="space-y-3">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-green-500"></div>
                Done
                <span className="text-sm font-normal text-gray-500">({doneItems.length})</span>
              </h2>
            </div>
            <div className="space-y-3">
              {doneItems.map((item) => (
                <Card 
                  key={item.id} 
                  className="hover:shadow-lg transition-all duration-200 border-l-4 border-l-green-500 opacity-90" 
                  data-testid={`card-item-${item.id}`}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <Badge variant="secondary" className={`capitalize ${getTypeColor(item.type)} flex items-center gap-1`}>
                        {getTypeIcon(item.type)}
                        {item.type}
                      </Badge>
                      <div className="flex items-center gap-1">
                        <LikeButton itemId={item.id} />
                        <CreateMultipleTasksDialog sourceItem={item} />
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(item.id)}
                          className="h-7 w-7 p-0 text-gray-400 hover:text-red-600 dark:text-gray-500 dark:hover:text-red-400"
                          data-testid={`button-delete-${item.id}`}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                    
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-4 whitespace-pre-wrap leading-relaxed line-through">
                      {item.content}
                    </p>
                    
                    <div className="space-y-2 mb-4">
                      <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                        <Avatar className={`h-6 w-6 ${getAvatarColor(item.createdByName)}`}>
                          <AvatarFallback className="text-white text-xs">
                            {getInitials(item.createdByName)}
                          </AvatarFallback>
                        </Avatar>
                        <span>Posted by <span className="font-medium">{item.createdByName}</span></span>
                      </div>
                      {item.assignedToNames && item.assignedToNames.length > 0 && (
                        <div className="space-y-1">
                          <div className="text-xs text-green-600 dark:text-green-400 font-medium">
                            Completed by:
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {item.assignedToNames.map((name, index) => (
                              <div
                                key={index}
                                className="flex items-center gap-1.5 bg-green-50 dark:bg-green-950 px-2 py-1 rounded-md border border-green-200 dark:border-green-800"
                                data-testid={`assigned-user-done-${item.id}-${index}`}
                              >
                                <Avatar className={`h-4 w-4 ${getAvatarColor(name)}`}>
                                  <AvatarFallback className="text-white text-[8px]">
                                    {getInitials(name)}
                                  </AvatarFallback>
                                </Avatar>
                                <span className="text-xs font-medium text-green-700 dark:text-green-300">{name}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      {item.completedAt && (
                        <div className="text-xs text-gray-400 dark:text-gray-500">
                          Done: {new Date(item.completedAt).toLocaleDateString()}
                        </div>
                      )}
                    </div>

                    <Button
                      onClick={() => handleReopen(item)}
                      disabled={updateItemMutation.isPending}
                      variant="outline"
                      size="sm"
                      className="w-full text-sm"
                      data-testid={`button-reopen-${item.id}`}
                    >
                      Reopen
                    </Button>

                    {/* Comments section */}
                    <ItemComments itemId={item.id} initialCommentCount={item.commentCount} />
                  </CardContent>
                </Card>
              ))}
              {doneItems.length === 0 && (
                <div className="text-center py-8 text-sm text-gray-400 dark:text-gray-500">
                  No completed items
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
