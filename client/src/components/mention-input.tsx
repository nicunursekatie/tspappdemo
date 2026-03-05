import React, { useState, useRef, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Send } from 'lucide-react';
import { logger } from '@/lib/logger';

interface User {
  id: string;
  firstName?: string;
  lastName?: string;
  displayName?: string;
  email: string;
}

interface MentionSuggestion {
  id: string;
  name: string;
  email: string;
}

interface MentionInputProps {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  placeholder?: string;
  disabled?: boolean;
}

export function MentionInput({
  value,
  onChange,
  onSend,
  placeholder,
  disabled,
}: MentionInputProps) {
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestions, setSuggestions] = useState<MentionSuggestion[]>([]);
  const [selectedSuggestion, setSelectedSuggestion] = useState(0);
  const [mentionPosition, setMentionPosition] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Fetch all users for mentions (uses for-assignments endpoint - no special permissions needed)
  const {
    data: users = [],
    error,
    isLoading,
  } = useQuery<User[]>({
    queryKey: ['/api/users/for-assignments'],
    queryFn: async () => {
      const response = await fetch('/api/users/for-assignments', {
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to fetch users');
      const data = await response.json();
      logger.log('Fetched users for mentions:', data?.length || 0, 'users');
      return Array.isArray(data) ? data : [];
    },
    staleTime: 300000, // 5 minutes
    gcTime: 600000, // 10 minutes
  });

  // Debug logging
  useEffect(() => {
    if (!isLoading) {
      logger.log('Available users for mentions:', (users || []).length);
    }
    if (error) logger.error('Error fetching users for mentions:', error);
  }, [users, error, isLoading]);

  // Parse mentions from text and highlight them
  const renderMessageWithMentions = (text: string) => {
    // Match @username, @"display name", or @email patterns
    const mentionRegex = /@(?:"([^"]+)"|([a-zA-Z0-9._@-]+))/g;
    const parts = [];
    let lastIndex = 0;
    let match;

    while ((match = mentionRegex.exec(text)) !== null) {
      // Add text before the mention
      if (match.index > lastIndex) {
        parts.push(text.slice(lastIndex, match.index));
      }

      // Add the mention with highlighting
      const mentionText = match[1] || match[2]; // quoted name or unquoted
      parts.push(
        <span
          key={match.index}
          className="bg-brand-primary-light text-brand-primary-dark px-1 rounded font-medium"
        >
          @{mentionText}
        </span>
      );

      lastIndex = match.index + match[0].length;
    }

    // Add remaining text
    if (lastIndex < text.length) {
      parts.push(text.slice(lastIndex));
    }

    return parts.length > 0 ? parts : text;
  };

  // Handle input changes and detect @ mentions
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    const cursorPosition = e.target.selectionStart || 0;

    onChange(newValue);

    // Check if we're typing a mention
    const textBeforeCursor = newValue.slice(0, cursorPosition);
    const lastAtIndex = textBeforeCursor.lastIndexOf('@');

    if (lastAtIndex !== -1) {
      const textAfterAt = textBeforeCursor.slice(lastAtIndex + 1);

      // Check if it's a valid mention context (no spaces after @)
      if (!textAfterAt.includes(' ') && textAfterAt.length >= 0) {
        setMentionPosition(lastAtIndex);

        // Filter users based on search and sort alphabetically
        const filteredUsers = (users || [])
          .filter((user) => {
            const fullName =
              user.firstName && user.lastName
                ? `${user.firstName} ${user.lastName}`
                : user.displayName ||
                  user.firstName ||
                  user.email.split('@')[0];
            const email = user.email;
            const searchTerm = textAfterAt.toLowerCase();

            logger.log(
              `Filtering user: ${fullName} (${email}) against "${searchTerm}"`
            );

            return (
              fullName.toLowerCase().includes(searchTerm) ||
              email.toLowerCase().includes(searchTerm)
            );
          })
          .sort((a, b) => {
            const nameA = (
              a.firstName && a.lastName
                ? `${a.firstName} ${a.lastName}`
                : a.displayName || a.firstName || a.email.split('@')[0]
            ).toLowerCase();
            const nameB = (
              b.firstName && b.lastName
                ? `${b.firstName} ${b.lastName}`
                : b.displayName || b.firstName || b.email.split('@')[0]
            ).toLowerCase();
            return nameA.localeCompare(nameB);
          })
          .slice(0, 5) // Limit to 5 suggestions
          .map((user) => ({
            id: user.id,
            name:
              user.firstName && user.lastName
                ? `${user.firstName} ${user.lastName}`
                : user.displayName ||
                  user.firstName ||
                  user.email.split('@')[0],
            email: user.email,
          }));

        logger.log(
          `Found ${filteredUsers.length} matching users for "@${textAfterAt}"`
        );
        logger.log('Filtered users:', filteredUsers);

        setSuggestions(filteredUsers);
        setShowSuggestions(filteredUsers.length > 0);
        setSelectedSuggestion(0);
      } else {
        setShowSuggestions(false);
      }
    } else {
      setShowSuggestions(false);
    }
  };

  // Handle keyboard navigation in mention suggestions
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (showSuggestions) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedSuggestion((prev) =>
          prev < suggestions.length - 1 ? prev + 1 : 0
        );
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedSuggestion((prev) =>
          prev > 0 ? prev - 1 : suggestions.length - 1
        );
      } else if (e.key === 'Tab' || e.key === 'Enter') {
        if (e.key === 'Tab' || (e.key === 'Enter' && suggestions.length > 0)) {
          e.preventDefault();
          insertMention(suggestions[selectedSuggestion]);
        } else if (e.key === 'Enter' && suggestions.length === 0) {
          onSend();
        }
      } else if (e.key === 'Escape') {
        setShowSuggestions(false);
      }
    } else if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSend();
    }
  };

  // Insert selected mention into text
  const insertMention = (suggestion: MentionSuggestion) => {
    const beforeMention = value.slice(0, mentionPosition);
    const afterCursor = value.slice(inputRef.current?.selectionStart || 0);

    // Use quotes if name contains spaces
    const mentionText = suggestion.name.includes(' ')
      ? `"${suggestion.name}"`
      : suggestion.name;

    const newValue = `${beforeMention}@${mentionText} ${afterCursor}`;
    onChange(newValue);
    setShowSuggestions(false);

    // Focus back to input
    setTimeout(() => {
      if (inputRef.current) {
        const newCursorPosition = beforeMention.length + mentionText.length + 2;
        inputRef.current.focus();
        inputRef.current.setSelectionRange(
          newCursorPosition,
          newCursorPosition
        );
      }
    }, 0);
  };

  // Handle clicking on a suggestion
  const handleSuggestionClick = (suggestion: MentionSuggestion) => {
    insertMention(suggestion);
  };

  return (
    <div className="relative">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Input
            ref={inputRef}
            value={value}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder={placeholder || 'Type @ to mention someone...'}
            disabled={disabled}
            className="pr-12"
          />

          {/* Mention suggestions dropdown */}
          {showSuggestions && (
            <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-48 overflow-y-auto">
              {suggestions.map((suggestion, index) => (
                <div
                  key={suggestion.id}
                  className={`px-3 py-2 cursor-pointer hover:bg-gray-100 ${
                    index === selectedSuggestion
                      ? 'bg-brand-primary-lighter border-l-2 border-blue-500'
                      : ''
                  }`}
                  onClick={() => handleSuggestionClick(suggestion)}
                >
                  <div className="font-medium text-gray-900">
                    {suggestion.name}
                  </div>
                  <div className="text-sm text-gray-500">
                    {suggestion.email}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <Button
          onClick={onSend}
          disabled={disabled || !value.trim()}
          size="icon"
          aria-label="Send message"
        >
          <Send className="h-4 w-4" />
        </Button>
      </div>

      {/* Help text */}
      <div className="text-xs text-gray-500 mt-1">
        Type @ to mention users • Press Tab or Enter to select • Press Esc to
        cancel
      </div>
    </div>
  );
}

// Component to render messages with mention highlighting
export function MessageWithMentions({ content }: { content: string }) {
  const mentionRegex = /@(?:"([^"]+)"|([a-zA-Z0-9._@-]+))/g;
  const parts = [];
  let lastIndex = 0;
  let match;

  while ((match = mentionRegex.exec(content)) !== null) {
    // Add text before the mention
    if (match.index > lastIndex) {
      parts.push(content.slice(lastIndex, match.index));
    }

    // Add the mention with highlighting
    const mentionText = match[1] || match[2]; // quoted name or unquoted
    parts.push(
      <span
        key={match.index}
        className="bg-brand-primary-light text-brand-primary-dark dark:bg-brand-primary-darker dark:text-brand-primary-muted px-1 rounded font-medium"
      >
        @{mentionText}
      </span>
    );

    lastIndex = match.index + match[0].length;
  }

  // Add remaining text
  if (lastIndex < content.length) {
    parts.push(content.slice(lastIndex));
  }

  return <span>{parts.length > 0 ? parts : content}</span>;
}

// Textarea version for multiline input with mentions
interface MentionTextareaProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit?: () => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  dataTestId?: string;
}

export function MentionTextarea({
  value,
  onChange,
  onSubmit,
  placeholder,
  disabled,
  className,
  dataTestId,
}: MentionTextareaProps) {
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestions, setSuggestions] = useState<MentionSuggestion[]>([]);
  const [selectedSuggestion, setSelectedSuggestion] = useState(0);
  const [mentionPosition, setMentionPosition] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Fetch all users for mentions (uses for-assignments endpoint - no special permissions needed)
  const {
    data: users = [],
    error,
    isLoading,
  } = useQuery<User[]>({
    queryKey: ['/api/users/for-assignments'],
    queryFn: async () => {
      const response = await fetch('/api/users/for-assignments', {
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to fetch users');
      const data = await response.json();
      logger.log('Fetched users for mentions:', data?.length || 0, 'users');
      return Array.isArray(data) ? data : [];
    },
    staleTime: 300000, // 5 minutes
    gcTime: 600000, // 10 minutes
  });

  // Debug logging
  useEffect(() => {
    if (!isLoading) {
      logger.log('Available users for mentions:', (users || []).length);
    }
    if (error) logger.error('Error fetching users for mentions:', error);
  }, [users, error, isLoading]);

  // Handle textarea changes and detect @ mentions
  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    const cursorPosition = e.target.selectionStart || 0;

    onChange(newValue);

    // Check if we're typing a mention
    const textBeforeCursor = newValue.slice(0, cursorPosition);
    const lastAtIndex = textBeforeCursor.lastIndexOf('@');

    if (lastAtIndex !== -1) {
      const textAfterAt = textBeforeCursor.slice(lastAtIndex + 1);

      // Check if it's a valid mention context (no spaces after @)
      if (!textAfterAt.includes(' ') && textAfterAt.length >= 0) {
        setMentionPosition(lastAtIndex);

        // Filter users based on search and sort alphabetically
        const filteredUsers = (users || [])
          .filter((user) => {
            const fullName =
              user.firstName && user.lastName
                ? `${user.firstName} ${user.lastName}`
                : user.displayName ||
                  user.firstName ||
                  user.email.split('@')[0];
            const email = user.email;
            const searchTerm = textAfterAt.toLowerCase();

            return (
              fullName.toLowerCase().includes(searchTerm) ||
              email.toLowerCase().includes(searchTerm)
            );
          })
          .sort((a, b) => {
            const nameA = (
              a.firstName && a.lastName
                ? `${a.firstName} ${a.lastName}`
                : a.displayName || a.firstName || a.email.split('@')[0]
            ).toLowerCase();
            const nameB = (
              b.firstName && b.lastName
                ? `${b.firstName} ${b.lastName}`
                : b.displayName || b.firstName || b.email.split('@')[0]
            ).toLowerCase();
            return nameA.localeCompare(nameB);
          })
          .slice(0, 5) // Limit to 5 suggestions
          .map((user) => ({
            id: user.id,
            name:
              user.firstName && user.lastName
                ? `${user.firstName} ${user.lastName}`
                : user.displayName ||
                  user.firstName ||
                  user.email.split('@')[0],
            email: user.email,
          }));

        setSuggestions(filteredUsers);
        setShowSuggestions(filteredUsers.length > 0);
        setSelectedSuggestion(0);
      } else {
        setShowSuggestions(false);
      }
    } else {
      setShowSuggestions(false);
    }
  };

  // Handle keyboard navigation in mention suggestions
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (showSuggestions) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedSuggestion((prev) =>
          prev < suggestions.length - 1 ? prev + 1 : 0
        );
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedSuggestion((prev) =>
          prev > 0 ? prev - 1 : suggestions.length - 1
        );
      } else if (e.key === 'Tab') {
        if (suggestions.length > 0) {
          e.preventDefault();
          insertMention(suggestions[selectedSuggestion]);
        }
      } else if (e.key === 'Enter' && !e.shiftKey && suggestions.length > 0) {
        e.preventDefault();
        insertMention(suggestions[selectedSuggestion]);
        if (onSubmit) {
          onSubmit();
        }
      } else if (e.key === 'Escape') {
        setShowSuggestions(false);
      }
    } else if (e.key === 'Enter' && !e.shiftKey && onSubmit) {
      e.preventDefault();
      onSubmit();
    }
  };

  // Insert selected mention into text
  const insertMention = (suggestion: MentionSuggestion) => {
    const beforeMention = value.slice(0, mentionPosition);
    const afterCursor = value.slice(textareaRef.current?.selectionStart || 0);

    // Use quotes if name contains spaces
    const mentionText = suggestion.name.includes(' ')
      ? `"${suggestion.name}"`
      : suggestion.name;

    const newValue = `${beforeMention}@${mentionText} ${afterCursor}`;
    onChange(newValue);
    setShowSuggestions(false);

    // Focus back to textarea
    setTimeout(() => {
      if (textareaRef.current) {
        const newCursorPosition = beforeMention.length + mentionText.length + 2;
        textareaRef.current.focus();
        textareaRef.current.setSelectionRange(
          newCursorPosition,
          newCursorPosition
        );
      }
    }, 0);
  };

  // Handle clicking on a suggestion
  const handleSuggestionClick = (suggestion: MentionSuggestion) => {
    insertMention(suggestion);
  };

  return (
    <div className="relative flex-1">
      <Textarea
        ref={textareaRef}
        value={value}
        onChange={handleTextareaChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder || 'Type @ to mention someone...'}
        disabled={disabled}
        className={className}
        data-testid={dataTestId}
      />

      {/* Mention suggestions dropdown */}
      {showSuggestions && (
        <div className="absolute bottom-full left-0 right-0 z-50 mb-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md shadow-lg max-h-48 overflow-y-auto">
          {suggestions.map((suggestion, index) => (
            <div
              key={suggestion.id}
              className={`px-3 py-2 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 ${
                index === selectedSuggestion
                  ? 'bg-brand-primary-lighter dark:bg-brand-primary-darker border-l-2 border-blue-500'
                  : ''
              }`}
              onClick={() => handleSuggestionClick(suggestion)}
            >
              <div className="font-medium text-gray-900 dark:text-gray-100">
                {suggestion.name}
              </div>
              <div className="text-sm text-gray-500 dark:text-gray-400">
                {suggestion.email}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Help text */}
      {showSuggestions && (
        <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
          Type @ to mention • Tab or Enter to select • Esc to cancel
        </div>
      )}
    </div>
  );
}
