import { useInstantMessaging } from '@/contexts/instant-messaging-context';
import { InstantMessageWindow } from './instant-message-window';

export function InstantMessageContainer() {
  const {
    openWindows,
    closeChat,
    minimizeChat,
    maximizeChat,
    sendMessage,
    markAsRead,
  } = useInstantMessaging();

  if (openWindows.length === 0) return null;

  return (
    <>
      {openWindows.map((window, index) => (
        <InstantMessageWindow
          key={window.id}
          window={window}
          index={index}
          onClose={() => closeChat(window.id)}
          onMinimize={() => minimizeChat(window.id)}
          onMaximize={() => maximizeChat(window.id)}
          onSendMessage={(content) => sendMessage(window.id, content)}
          onMarkAsRead={() => markAsRead(window.id)}
        />
      ))}
    </>
  );
}

export default InstantMessageContainer;
