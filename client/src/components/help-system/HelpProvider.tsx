import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
} from 'react';
import { HelpContent } from './HelpBubble';
import { logger } from '@/lib/logger';

interface HelpContextType {
  showHelp: (content: HelpContent) => void;
  hideHelp: (id: string) => void;
  registerHelp: (id: string, content: HelpContent) => void;
  isHelpEnabled: boolean;
  toggleHelpMode: () => void;
  getHelpContent: (id: string) => HelpContent | null;
}

const HelpContext = createContext<HelpContextType | null>(null);

export function useHelp() {
  const context = useContext(HelpContext);
  if (!context) {
    throw new Error('useHelp must be used within a HelpProvider');
  }
  return context;
}

interface HelpProviderProps {
  children: React.ReactNode;
}

export function HelpProvider({ children }: HelpProviderProps) {
  const [registeredHelp, setRegisteredHelp] = useState<
    Map<string, HelpContent>
  >(new Map());
  const [isHelpEnabled, setIsHelpEnabled] = useState(() => {
    // Check if user has help mode preference stored
    const saved = localStorage.getItem('help-mode-enabled');
    return saved ? JSON.parse(saved) : true; // Default to enabled
  });

  const registerHelp = useCallback((id: string, content: HelpContent) => {
    setRegisteredHelp((prev) => new Map(prev.set(id, content)));
  }, []);

  const showHelp = useCallback((content: HelpContent) => {
    // This would be used for programmatic help display
    logger.log('Showing help:', content);
  }, []);

  const hideHelp = useCallback((id: string) => {
    logger.log('Hiding help:', id);
  }, []);

  const toggleHelpMode = useCallback(() => {
    const newMode = !isHelpEnabled;
    setIsHelpEnabled(newMode);
    localStorage.setItem('help-mode-enabled', JSON.stringify(newMode));
  }, [isHelpEnabled]);

  const getHelpContent = useCallback(
    (id: string): HelpContent | null => {
      return registeredHelp.get(id) || null;
    },
    [registeredHelp]
  );

  // Clear any existing guide localStorage entries on startup
  useEffect(() => {
    // Clear all help-related localStorage entries to prevent guide spam
    const keysToRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (
        key &&
        (key.startsWith('help-') || key.startsWith('tooltip-dismissed-'))
      ) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach((key) => localStorage.removeItem(key));

    // Permanently disable help system
    localStorage.setItem('help-system-disabled', 'true');
  }, []);

  // Initialize default help content - DISABLED
  useEffect(() => {
    // All help content registration disabled to prevent any guides from appearing
    const isHelpDisabled =
      localStorage.getItem('help-system-disabled') === 'true';
    if (isHelpDisabled) {
      return; // Exit early - no help content registered
    }

    const defaultHelpContent: Array<[string, HelpContent]> = [
      // All content commented out to prevent any guides
      [
        'collections-log-nav',
        {
          id: 'collections-log-nav',
          title: 'Collections Log',
          message:
            "This is where all your sandwich collection data lives! Click here to view, add, or manage collection records. Each entry tells a story of community impact.",
          tone: 'informative',
          character: 'guide',
          position: 'right',
        },
      ],
      [
        'collections-form',
        {
          id: 'collections-form',
          title: 'Recording Your Collections',
          message:
            "Every sandwich you record here represents a meal for someone in need. Don't worry about making mistakes - you can always edit entries later. Just do your best, and know that your contribution matters so much!",
          tone: 'supportive',
          character: 'mentor',
          position: 'right',
        },
      ],
      [
        'navigation-help',
        {
          id: 'navigation-help',
          title: 'Finding Your Way Around',
          message:
            "Think of this sidebar as your map to everything TSP! Each section is designed to help you contribute in your own unique way. Take your time exploring - there's no rush.",
          tone: 'informative',
          character: 'guide',
          position: 'right',
        },
      ],
      [
        'team-chat',
        {
          id: 'team-chat',
          title: 'Connect with Your Team',
          message:
            "This is where the magic happens! Chat with your fellow volunteers, share updates, and celebrate each other's wins. We're all in this together, and your voice matters here.",
          tone: 'encouraging',
          character: 'friend',
          position: 'top',
        },
      ],
      [
        'reports-analytics',
        {
          id: 'reports-analytics',
          title: 'See Your Impact',
          message:
            "These numbers tell the story of our collective impact! Every chart and statistic represents real people whose lives we've touched. You should feel proud - you're part of something beautiful.",
          tone: 'celebratory',
          character: 'coach',
          position: 'bottom',
        },
      ],
      [
        'directory-contacts',
        {
          id: 'directory-contacts',
          title: 'Your TSP Family',
          message:
            "Here's everyone who's part of our wonderful community! Don't hesitate to reach out to anyone - we're all here to support each other in this important work.",
          tone: 'supportive',
          character: 'friend',
          position: 'left',
        },
      ],
      [
        'meetings-schedule',
        {
          id: 'meetings-schedule',
          title: 'Stay Connected',
          message:
            "Meetings are where we come together as a team! They're not just about business - they're about connecting, sharing ideas, and supporting each other. Your participation is valued!",
          tone: 'encouraging',
          character: 'mentor',
          position: 'bottom',
        },
      ],
      [
        'project-management',
        {
          id: 'project-management',
          title: 'Making Things Happen',
          message:
            "Projects might seem overwhelming, but remember - every big change starts with small steps. You don't have to do everything at once. Just pick something that speaks to you and take it one task at a time!",
          tone: 'supportive',
          character: 'coach',
          position: 'right',
        },
      ],
      [
        'data-entry-tips',
        {
          id: 'data-entry-tips',
          title: 'Data Entry Made Easy',
          message:
            "I know forms can feel tedious, but think of each entry as a story of generosity! Take breaks when you need them, and remember - accuracy matters more than speed. You're doing great!",
          tone: 'encouraging',
          character: 'mentor',
          position: 'top',
        },
      ],
      [
        'first-time-user',
        {
          id: 'first-time-user',
          title: "New Here? You're Welcome!",
          message:
            "Starting something new can feel a bit overwhelming, but you've joined an incredibly supportive community! Take things at your own pace, ask questions whenever you need to, and know that everyone here wants to see you succeed.",
          tone: 'supportive',
          character: 'friend',
          position: 'bottom',
          showOnFirstVisit: false, // Disabled auto-show
          actions: [
            {
              label: 'Take a Quick Tour',
              action: () => {
                logger.log('Starting tour');
                // Mark onboarding as complete when starting tour
                localStorage.setItem('onboarding-complete', 'true');
                localStorage.setItem('help-first-time-user-seen', 'true');
              },
              primary: true,
            },
            {
              label: "I'll Explore on My Own",
              action: () => {
                logger.log('Self exploration');
                // Mark onboarding as complete and help as seen when skipping
                localStorage.setItem('onboarding-complete', 'true');
                localStorage.setItem('help-first-time-user-seen', 'true');
                // Hide the help bubble
                hideHelp('first-time-user');
              },
            },
          ],
        },
      ],
    ];

    defaultHelpContent.forEach(([id, content]) => {
      registerHelp(id, content);
    });
  }, [registerHelp]);

  const contextValue: HelpContextType = {
    showHelp,
    hideHelp,
    registerHelp,
    isHelpEnabled,
    toggleHelpMode,
    getHelpContent,
  };

  return (
    <HelpContext.Provider value={contextValue}>{children}</HelpContext.Provider>
  );
}
