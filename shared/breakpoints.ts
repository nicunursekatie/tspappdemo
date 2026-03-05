export const BREAKPOINTS = {
  xs: 480,
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
  '2xl': 1536,
} as const;

export type BreakpointKey = keyof typeof BREAKPOINTS;

export const TAILWIND_SCREENS: Record<BreakpointKey, string> = Object.fromEntries(
  Object.entries(BREAKPOINTS).map(([key, value]) => [key, `${value}px`])
) as Record<BreakpointKey, string>;

export const MOBILE_BREAKPOINT = BREAKPOINTS.md;
