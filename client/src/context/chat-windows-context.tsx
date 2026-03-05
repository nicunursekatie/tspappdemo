import React, { createContext, useContext, useState, useCallback } from 'react';

export interface ChatWindow {
  id: string;
  userId?: string;
  userName: string;
  channelId?: string;
  channelName?: string;
  type: 'direct' | 'channel';
  isMinimized: boolean;
}

interface ChatWindowsContextType {
  windows: ChatWindow[];
  openWindow: (window: Omit<ChatWindow, 'id' | 'isMinimized'>) => void;
  closeWindow: (id: string) => void;
  toggleMinimize: (id: string) => void;
  minimizeAll: () => void;
  closeAll: () => void;
}

const ChatWindowsContext = createContext<ChatWindowsContextType | undefined>(undefined);

export function ChatWindowsProvider({ children }: { children: React.ReactNode }) {
  const [windows, setWindows] = useState<ChatWindow[]>([]);

  const openWindow = useCallback((windowData: Omit<ChatWindow, 'id' | 'isMinimized'>) => {
    setWindows((prev) => {
      // Check if window already exists
      const existingIndex = prev.findIndex(
        (w) =>
          (windowData.type === 'direct' && w.userId === windowData.userId) ||
          (windowData.type === 'channel' && w.channelId === windowData.channelId)
      );

      if (existingIndex !== -1) {
        // Window exists - bring to front and unminimize
        const updated = [...prev];
        updated[existingIndex] = { ...updated[existingIndex], isMinimized: false };
        // Move to end (front)
        const window = updated.splice(existingIndex, 1)[0];
        return [...updated, window];
      }

      // Create new window
      const newWindow: ChatWindow = {
        ...windowData,
        id: `chat-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        isMinimized: false,
      };

      return [...prev, newWindow];
    });
  }, []);

  const closeWindow = useCallback((id: string) => {
    setWindows((prev) => prev.filter((w) => w.id !== id));
  }, []);

  const toggleMinimize = useCallback((id: string) => {
    setWindows((prev) =>
      prev.map((w) => (w.id === id ? { ...w, isMinimized: !w.isMinimized } : w))
    );
  }, []);

  const minimizeAll = useCallback(() => {
    setWindows((prev) => prev.map((w) => ({ ...w, isMinimized: true })));
  }, []);

  const closeAll = useCallback(() => {
    setWindows([]);
  }, []);

  return (
    <ChatWindowsContext.Provider
      value={{ windows, openWindow, closeWindow, toggleMinimize, minimizeAll, closeAll }}
    >
      {children}
    </ChatWindowsContext.Provider>
  );
}

export function useChatWindows() {
  const context = useContext(ChatWindowsContext);
  if (!context) {
    throw new Error('useChatWindows must be used within ChatWindowsProvider');
  }
  return context;
}
