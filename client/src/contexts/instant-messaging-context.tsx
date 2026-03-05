import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { getOrCreateSocket } from '@/lib/socket-singleton';
import { useToast } from '@/hooks/use-toast';
import { logger } from '@/lib/logger';

// Simple notification sound - uses Web Audio API to generate a pleasant chime
function playNotificationSound() {
  try {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();

    // Create a pleasant two-tone chime
    const playTone = (frequency: number, startTime: number, duration: number) => {
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      oscillator.frequency.value = frequency;
      oscillator.type = 'sine';

      // Fade in and out for a smoother sound
      gainNode.gain.setValueAtTime(0, startTime);
      gainNode.gain.linearRampToValueAtTime(0.3, startTime + 0.05);
      gainNode.gain.linearRampToValueAtTime(0, startTime + duration);

      oscillator.start(startTime);
      oscillator.stop(startTime + duration);
    };

    const now = audioContext.currentTime;
    // Play two tones for a pleasant "ding-ding" sound
    playTone(880, now, 0.15); // A5
    playTone(1047, now + 0.1, 0.15); // C6

    // Clean up audio context after sound plays
    setTimeout(() => {
      audioContext.close();
    }, 500);
  } catch (error) {
    // Silently fail if audio is not supported or blocked
    console.debug('Could not play notification sound:', error);
  }
}

export interface ChatUser {
  id: string;
  firstName: string | null;
  lastName: string | null;
  displayName: string | null;
  email: string | null;
  profileImageUrl: string | null;
}

export interface InstantMessage {
  id: number;
  senderId: string;
  senderName: string;
  recipientId: string;
  content: string;
  createdAt: string;
  read: boolean;
}

export interface ChatWindow {
  id: string; // unique window id
  user: ChatUser;
  minimized: boolean;
  messages: InstantMessage[];
  unreadCount: number;
}

interface InstantMessagingContextType {
  openWindows: ChatWindow[];
  openChat: (user: ChatUser) => void;
  closeChat: (windowId: string) => void;
  minimizeChat: (windowId: string) => void;
  maximizeChat: (windowId: string) => void;
  sendMessage: (windowId: string, content: string) => Promise<void>;
  markAsRead: (windowId: string) => void;
  addMessage: (message: InstantMessage) => void;
}

const InstantMessagingContext = createContext<InstantMessagingContextType | null>(null);

export function useInstantMessaging() {
  const context = useContext(InstantMessagingContext);
  if (!context) {
    throw new Error('useInstantMessaging must be used within an InstantMessagingProvider');
  }
  return context;
}

const MAX_OPEN_WINDOWS = 3;

export function InstantMessagingProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [openWindows, setOpenWindows] = useState<ChatWindow[]>([]);
  const { toast } = useToast();

  // Use refs to access current state in socket handler
  const openWindowsRef = useRef<ChatWindow[]>([]);
  const openChatRef = useRef<(user: ChatUser) => void>(() => {});

  // Keep refs in sync with state
  useEffect(() => {
    openWindowsRef.current = openWindows;
  }, [openWindows]);

  // Track last message ID we've seen to detect new messages via polling
  const lastMessageIdRef = useRef<number>(0);
  const [socketConnected, setSocketConnected] = useState(false);

  // Helper function to process a new message (used by both socket and polling)
  const processNewMessage = useCallback((message: InstantMessage) => {
    // Skip messages from yourself entirely - they're added by the sendMessage API response
    // This prevents duplicate messages (the API adds it, then socket would add it again)
    if (message.senderId === user?.id) {
      logger.log('[InstantMessaging] Skipping own message');
      return;
    }

    // Skip if we've already seen this message
    if (message.id <= lastMessageIdRef.current) {
      return;
    }
    lastMessageIdRef.current = Math.max(lastMessageIdRef.current, message.id);

    const senderId = message.senderId;
    const currentWindows = openWindowsRef.current;
    const existingWindow = currentWindows.find(w => w.user.id === senderId);

    // Play notification sound for new messages
    playNotificationSound();

    if (existingWindow) {
      // Window is open - add message to it and maximize if minimized
      setOpenWindows(prev => {
        return prev.map(w => {
          if (w.user.id === senderId) {
            const messageExists = w.messages.some(m => m.id === message.id);
            if (messageExists) return w;
            return {
              ...w,
              messages: [...w.messages, message],
              minimized: false, // Auto-maximize on new message
              unreadCount: 0, // Reset unread since we're showing it
            };
          }
          return w;
        });
      });
    } else {
      // No window open - open chat window minimized with unread badge
      const senderUser: ChatUser = {
        id: message.senderId,
        firstName: null,
        lastName: null,
        displayName: message.senderName,
        email: null,
        profileImageUrl: null,
      };

      // Create a new minimized window with the message and unread count
      setOpenWindows(prev => {
        // Double check it wasn't opened in the meantime
        if (prev.some(w => w.user.id === senderUser.id)) {
          return prev;
        }

        const newWindow: ChatWindow = {
          id: `chat-${senderUser.id}-${Date.now()}`,
          user: senderUser,
          minimized: true, // Start minimized with badge
          messages: [message],
          unreadCount: 1,
        };

        // Limit number of open windows
        if (prev.length >= MAX_OPEN_WINDOWS) {
          return [...prev.slice(1), newWindow];
        }

        return [...prev, newWindow];
      });

      // Load full message history in background
      loadMessageHistoryForUser(senderUser.id);
    }
  }, [user?.id]);

  // Polling fallback: Check for new messages when socket is disconnected
  useEffect(() => {
    if (!user?.id) return;
    if (socketConnected) return; // Don't poll if socket is connected

    const pollForNewMessages = async () => {
      try {
        // Fetch unread messages (includes all unread messages, not just last per conversation)
        const response = await fetch('/api/instant-messages/unread/count', {
          credentials: 'include',
        });
        
        if (response.ok) {
          const data = await response.json();
          
          // Process all unread messages that are new
          if (data.messages && Array.isArray(data.messages)) {
            data.messages.forEach((message: InstantMessage) => {
              if (message.id > lastMessageIdRef.current) {
                processNewMessage(message);
              }
            });
          }
        }
      } catch (error) {
        logger.error('[InstantMessaging] Error polling for messages:', error);
      }
    };

    // Poll every 5 seconds when socket is disconnected
    const pollInterval = setInterval(pollForNewMessages, 5000);
    
    // Initial poll after a short delay to let socket try to connect first
    const initialPollTimeout = setTimeout(pollForNewMessages, 2000);

    return () => {
      clearInterval(pollInterval);
      clearTimeout(initialPollTimeout);
    };
  }, [user?.id, socketConnected, processNewMessage]);

  // Join messaging channel for real-time updates
  useEffect(() => {
    if (!user?.id) return;

    const socket = getOrCreateSocket();
    if (!socket) return;

    const handleNewMessage = (message: InstantMessage) => {
      logger.log('[InstantMessaging] Received instant_message event:', message);
      processNewMessage(message);
    };

    const handleConnect = () => {
      // Join user's messaging channel only after socket is connected
      logger.log('[InstantMessaging] Socket connected, joining messaging channel for user:', user.id);
      setSocketConnected(true);
      socket.emit('join-messaging-channel', { userId: user.id });
    };

    const handleDisconnect = () => {
      logger.log('[InstantMessaging] Socket disconnected, will use polling fallback');
      setSocketConnected(false);
    };

    // Set up event listeners
    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('instant_message', handleNewMessage);

    // Check initial connection status
    setSocketConnected(socket.connected);
    
    // If already connected, join immediately
    if (socket.connected) {
      handleConnect();
    }

    return () => {
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.off('instant_message', handleNewMessage);
    };
  }, [user?.id, processNewMessage]);

  const openChat = useCallback((chatUser: ChatUser) => {
    if (!user?.id) return;

    setOpenWindows(prev => {
      // Check if window is already open
      const existingIndex = prev.findIndex(w => w.user.id === chatUser.id);

      if (existingIndex !== -1) {
        // Maximize and bring to front
        const updated = [...prev];
        const [existing] = updated.splice(existingIndex, 1);
        return [...updated, { ...existing, minimized: false }];
      }

      // Create new window
      const newWindow: ChatWindow = {
        id: `chat-${chatUser.id}-${Date.now()}`,
        user: chatUser,
        minimized: false,
        messages: [],
        unreadCount: 0,
      };

      // Limit number of open windows
      if (prev.length >= MAX_OPEN_WINDOWS) {
        return [...prev.slice(1), newWindow];
      }

      return [...prev, newWindow];
    });

    // Load message history
    loadMessageHistory(chatUser.id);
  }, [user?.id]);

  // Keep openChatRef in sync
  useEffect(() => {
    openChatRef.current = openChat;
  }, [openChat]);

  const loadMessageHistory = async (otherUserId: string, preserveUnreadCount = false) => {
    try {
      const response = await fetch(`/api/instant-messages/${otherUserId}`, {
        credentials: 'include',
      });

      if (response.ok) {
        const messages: InstantMessage[] = await response.json();

        // Update last seen message ID to prevent showing old messages as new
        if (messages.length > 0) {
          const maxId = Math.max(...messages.map(m => m.id));
          lastMessageIdRef.current = Math.max(lastMessageIdRef.current, maxId);
        }

        setOpenWindows(prev =>
          prev.map(w =>
            w.user.id === otherUserId
              ? {
                  ...w,
                  messages,
                  unreadCount: preserveUnreadCount ? w.unreadCount : 0
                }
              : w
          )
        );
      }
    } catch (error) {
      console.error('Failed to load message history:', error);
    }
  };

  // Load message history for a user without resetting unread count
  const loadMessageHistoryForUser = (otherUserId: string) => {
    loadMessageHistory(otherUserId, true);
  };

  const closeChat = useCallback((windowId: string) => {
    // Clear any pending markAsRead timeout for this window
    const timeout = markAsReadTimeouts.current.get(windowId);
    if (timeout) {
      clearTimeout(timeout);
      markAsReadTimeouts.current.delete(windowId);
    }
    setOpenWindows(prev => prev.filter(w => w.id !== windowId));
  }, []);

  const minimizeChat = useCallback((windowId: string) => {
    setOpenWindows(prev =>
      prev.map(w =>
        w.id === windowId ? { ...w, minimized: true } : w
      )
    );
  }, []);

  const maximizeChat = useCallback((windowId: string) => {
    setOpenWindows(prev =>
      prev.map(w =>
        w.id === windowId ? { ...w, minimized: false, unreadCount: 0 } : w
      )
    );
  }, []);

  const sendMessage = useCallback(async (windowId: string, content: string) => {
    if (!user?.id || !content.trim()) return;

    // Use ref to get current windows to avoid stale closure
    const currentWindow = openWindowsRef.current.find(w => w.id === windowId);
    if (!currentWindow) return;

    try {
      const response = await fetch('/api/instant-messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          recipientId: currentWindow.user.id,
          content: content.trim(),
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to send message');
      }

      const newMessage: InstantMessage = await response.json();

      // Add message to window with deduplication check
      // The socket may also broadcast this message, so we need to prevent duplicates
      setOpenWindows(prev =>
        prev.map(w => {
          if (w.id === windowId) {
            const messageExists = w.messages.some(m => m.id === newMessage.id);
            if (messageExists) return w;
            return { ...w, messages: [...w.messages, newMessage] };
          }
          return w;
        })
      );
    } catch (error) {
      console.error('Failed to send message:', error);
      throw error;
    }
  }, [user?.id]);

  // Debounce markAsRead calls to prevent excessive API requests
  const markAsReadTimeouts = useRef<Map<string, NodeJS.Timeout>>(new Map());

  const markAsRead = useCallback((windowId: string) => {
    // Use ref to get current windows to avoid stale closure
    const currentWindow = openWindowsRef.current.find(w => w.id === windowId);
    if (!currentWindow) return;

    // Clear any existing timeout for this window
    const existingTimeout = markAsReadTimeouts.current.get(windowId);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
    }

    // Update UI immediately
    setOpenWindows(prev =>
      prev.map(w =>
        w.id === windowId ? { ...w, unreadCount: 0 } : w
      )
    );

    // Debounce the API call - only send after 500ms of no calls
    const timeout = setTimeout(() => {
      fetch(`/api/instant-messages/${currentWindow.user.id}/read`, {
        method: 'POST',
        credentials: 'include',
      }).catch((error) => {
        console.error('Failed to mark messages as read:', error);
      });
      markAsReadTimeouts.current.delete(windowId);
    }, 500);

    markAsReadTimeouts.current.set(windowId, timeout);
  }, []);

  const addMessage = useCallback((message: InstantMessage) => {
    setOpenWindows(prev => {
      const otherUserId = message.senderId === user?.id ? message.recipientId : message.senderId;
      return prev.map(w => {
        if (w.user.id === otherUserId) {
          const messageExists = w.messages.some(m => m.id === message.id);
          if (messageExists) return w;
          return {
            ...w,
            messages: [...w.messages, message],
            unreadCount: w.minimized ? w.unreadCount + 1 : 0,
          };
        }
        return w;
      });
    });
  }, [user?.id]);

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      markAsReadTimeouts.current.forEach((timeout) => {
        clearTimeout(timeout);
      });
      markAsReadTimeouts.current.clear();
    };
  }, []);

  return (
    <InstantMessagingContext.Provider
      value={{
        openWindows,
        openChat,
        closeChat,
        minimizeChat,
        maximizeChat,
        sendMessage,
        markAsRead,
        addMessage,
      }}
    >
      {children}
    </InstantMessagingContext.Provider>
  );
}
