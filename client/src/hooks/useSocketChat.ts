import { useEffect, useState, useCallback, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from './useAuth';
import { logger } from '@/lib/logger';
import { useToast } from '@/hooks/use-toast';

export interface ChatMessage {
  id: string;
  userId: string;
  userName: string;
  content: string;
  timestamp: Date;
  room: string;
}

export interface ChatRoom {
  id: string;
  name: string;
}

export interface ChatUser {
  userId: string;
  userName: string;
  room: string;
}

export function useSocketChat() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const [rooms, setRooms] = useState<ChatRoom[]>([]);
  const [messages, setMessages] = useState<Record<string, ChatMessage[]>>({});
  const [activeUsers, setActiveUsers] = useState<Record<string, ChatUser[]>>(
    {}
  );
  const [currentRoom, setCurrentRoom] = useState<string>('');

  // Use refs for values needed in socket handlers
  const currentRoomRef = useRef<string>('');
  const roomsRef = useRef<ChatRoom[]>([]);

  // Keep refs in sync
  useEffect(() => {
    currentRoomRef.current = currentRoom;
  }, [currentRoom]);

  useEffect(() => {
    roomsRef.current = rooms;
  }, [rooms]);

  // Initialize socket connection
  useEffect(() => {
    if (!user) return;

    // Use current origin for Socket.IO connection
    const socketUrl = window.location.origin;
    logger.log('Connecting to Socket.IO at:', socketUrl);

    const newSocket = io(socketUrl, {
      path: '/socket.io/',
      transports: ['polling', 'websocket'], // Try polling first, then upgrade to websocket
      upgrade: true,
      timeout: 30000,
      forceNew: true,
      autoConnect: true,
    });

    newSocket.on('connect', () => {
      setConnected(true);
      logger.log('Socket.io connected');

      // Get available rooms first
      newSocket.emit('get-rooms');
    });

    newSocket.on('disconnect', () => {
      setConnected(false);
      logger.log('Socket.io disconnected');
    });

    newSocket.on('rooms', ({ available }) => {
      setRooms(available || []);
      logger.log('Received rooms:', available);

      // Request message history for all rooms to populate "no messages yet" correctly
      (available || []).forEach((room: ChatRoom) => {
        newSocket.emit('get-history', room.id);
      });

      // Auto-select first room if none selected
      if ((available || []).length > 0 && !currentRoom) {
        setCurrentRoom((available || [])[0]?.id);
      }
    });

    newSocket.on('new-message', (message: ChatMessage) => {
      setMessages((prev) => ({
        ...prev,
        [message.room]: [...(prev[message.room] || []), message],
      }));

      // Trigger notification refresh for new messages
      window.dispatchEvent(new CustomEvent('refreshNotifications'));
      logger.log('New message received, triggering notification refresh');

      // Show toast notification if:
      // 1. Message is from a different user
      // 2. Message is in a different room than the current one OR user is not on the chat page
      const isFromOtherUser = message.userId !== (user as any)?.id;
      const isInDifferentRoom = message.room !== currentRoomRef.current;
      const isOnChatPage = window.location.pathname.includes('/chat');

      if (isFromOtherUser && (isInDifferentRoom || !isOnChatPage)) {
        const roomName = roomsRef.current.find(r => r.id === message.room)?.name || message.room;
        const truncatedContent = message.content.length > 50
          ? message.content.substring(0, 50) + '...'
          : message.content;

        toast({
          title: `${message.userName} in ${roomName}`,
          description: truncatedContent,
          duration: 5000,
        });
      }
    });

    newSocket.on(
      'message-history',
      (data: { room: string; messages: ChatMessage[] }) => {
        const { room, messages: roomMessages } = data;
        setMessages((prev) => ({
          ...prev,
          [room]: roomMessages || [],
        }));
        logger.log(
          `Received message history for ${room}:`,
          roomMessages?.length || 0,
          'messages'
        );
      }
    );

    newSocket.on('joined-channel', ({ channel }) => {
      logger.log(`Successfully joined channel: ${channel}`);
    });

    newSocket.on('user_joined', ({ userId, username, room }) => {
      setActiveUsers((prev) => ({
        ...prev,
        [room]: [
          ...(prev[room] || []).filter((u) => u.userId !== userId),
          { userId, username, room },
        ],
      }));
    });

    newSocket.on('user_left', ({ userId, room }) => {
      setActiveUsers((prev) => ({
        ...prev,
        [room]: (prev[room] || []).filter((u) => u.userId !== userId),
      }));
    });

    newSocket.on('error', ({ message }) => {
      logger.error('Socket.io error:', message);
    });

    setSocket(newSocket);

    return () => {
      newSocket.close();
    };
  }, [user, toast]);

  // Send message
  const sendMessage = useCallback(
    (room: string, content: string) => {
      if (socket && connected && user) {
        socket.emit('send-message', {
          channel: room,
          content,
        });
      }
    },
    [socket, connected, user]
  );

  // Join room and get history
  const joinRoom = useCallback(
    (roomId: string) => {
      if (socket && connected && user) {
        setCurrentRoom(roomId);
        const userName =
          (user as any)?.firstName || (user as any)?.email || 'Anonymous';
        const userId = (user as any)?.id || 'anonymous';
        socket.emit('join-channel', {
          channel: roomId,
          userId: userId,
          userName: userName,
        });
      }
    },
    [socket, connected, user]
  );

  return {
    connected,
    rooms,
    messages,
    activeUsers,
    currentRoom,
    sendMessage,
    joinRoom,
    setCurrentRoom,
  };
}
