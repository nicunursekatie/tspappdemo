import { useChatWindows } from '@/context/chat-windows-context';
import { FloatingChatWindow } from './floating-chat-window';

/**
 * Container component that renders all open floating chat windows
 * Positioned at bottom-right of the screen
 */
export function FloatingChatWindowsContainer() {
  const { windows } = useChatWindows();

  if (windows.length === 0) {
    return null;
  }

  return (
    <div className="fixed bottom-0 right-0 pointer-events-none z-[1000]">
      <div className="pointer-events-auto">
        {windows.map((window, index) => (
          <FloatingChatWindow
            key={window.id}
            window={window}
            index={index}
            totalWindows={windows.length}
          />
        ))}
      </div>
    </div>
  );
}
