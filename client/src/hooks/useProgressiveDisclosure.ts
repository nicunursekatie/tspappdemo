import { useState, useCallback } from 'react';

/**
 * Progressive Disclosure Pattern Hook
 *
 * A standardized hook for implementing progressive disclosure UI patterns.
 * Progressive disclosure reduces complexity by showing only essential information
 * initially, revealing additional details when the user needs them.
 *
 * @example
 * // Single toggle
 * const { isOpen, toggle, open, close } = useProgressiveDisclosure();
 *
 * @example
 * // Multiple sections
 * const { states, toggle, isOpen, openAll, closeAll } = useProgressiveDisclosure({
 *   sections: ['details', 'advanced', 'permissions']
 * });
 */

interface UseProgressiveDisclosureOptions {
  /**
   * List of section identifiers for multi-section disclosure
   */
  sections?: string[];

  /**
   * Initial state - single boolean or object for multiple sections
   */
  initialState?: boolean | Record<string, boolean>;

  /**
   * Callback when disclosure state changes
   */
  onChange?: (state: boolean | Record<string, boolean>) => void;
}

interface SingleDisclosureReturn {
  isOpen: boolean;
  toggle: () => void;
  open: () => void;
  close: () => void;
  set: (value: boolean) => void;
}

interface MultiDisclosureReturn {
  states: Record<string, boolean>;
  toggle: (section: string) => void;
  isOpen: (section: string) => boolean;
  open: (section: string) => void;
  close: (section: string) => void;
  openAll: () => void;
  closeAll: () => void;
  set: (section: string, value: boolean) => void;
}

/**
 * Hook for single disclosure state
 */
export function useProgressiveDisclosure(
  options?: Omit<UseProgressiveDisclosureOptions, 'sections'>
): SingleDisclosureReturn;

/**
 * Hook for multiple disclosure states
 */
export function useProgressiveDisclosure(
  options: UseProgressiveDisclosureOptions & { sections: string[] }
): MultiDisclosureReturn;

export function useProgressiveDisclosure(
  options: UseProgressiveDisclosureOptions = {}
): SingleDisclosureReturn | MultiDisclosureReturn {
  const { sections, initialState = false, onChange } = options;

  // Single disclosure state
  const [singleState, setSingleState] = useState<boolean>(
    typeof initialState === 'boolean' ? initialState : false
  );

  // Multiple disclosure states
  const [multiState, setMultiState] = useState<Record<string, boolean>>(() => {
    if (!sections) return {};

    if (typeof initialState === 'object') {
      return initialState;
    }

    return sections.reduce((acc, section) => {
      acc[section] = false;
      return acc;
    }, {} as Record<string, boolean>);
  });

  // Single disclosure handlers
  const toggle = useCallback(() => {
    setSingleState(prev => {
      const newState = !prev;
      onChange?.(newState);
      return newState;
    });
  }, [onChange]);

  const open = useCallback(() => {
    setSingleState(true);
    onChange?.(true);
  }, [onChange]);

  const close = useCallback(() => {
    setSingleState(false);
    onChange?.(false);
  }, [onChange]);

  const set = useCallback((value: boolean) => {
    setSingleState(value);
    onChange?.(value);
  }, [onChange]);

  // Multiple disclosure handlers
  const toggleMulti = useCallback((section: string) => {
    setMultiState(prev => {
      const newState = { ...prev, [section]: !prev[section] };
      onChange?.(newState);
      return newState;
    });
  }, [onChange]);

  const isOpen = useCallback((section: string) => {
    return multiState[section] ?? false;
  }, [multiState]);

  const openSection = useCallback((section: string) => {
    setMultiState(prev => {
      const newState = { ...prev, [section]: true };
      onChange?.(newState);
      return newState;
    });
  }, [onChange]);

  const closeSection = useCallback((section: string) => {
    setMultiState(prev => {
      const newState = { ...prev, [section]: false };
      onChange?.(newState);
      return newState;
    });
  }, [onChange]);

  const openAll = useCallback(() => {
    if (!sections) return;
    setMultiState(prev => {
      const newState = sections.reduce((acc, section) => {
        acc[section] = true;
        return acc;
      }, {} as Record<string, boolean>);
      onChange?.(newState);
      return newState;
    });
  }, [sections, onChange]);

  const closeAll = useCallback(() => {
    if (!sections) return;
    setMultiState(prev => {
      const newState = sections.reduce((acc, section) => {
        acc[section] = false;
        return acc;
      }, {} as Record<string, boolean>);
      onChange?.(newState);
      return newState;
    });
  }, [sections, onChange]);

  const setSection = useCallback((section: string, value: boolean) => {
    setMultiState(prev => {
      const newState = { ...prev, [section]: value };
      onChange?.(newState);
      return newState;
    });
  }, [onChange]);

  // Return appropriate interface based on configuration
  if (sections && sections.length > 0) {
    return {
      states: multiState,
      toggle: toggleMulti,
      isOpen,
      open: openSection,
      close: closeSection,
      openAll,
      closeAll,
      set: setSection,
    };
  }

  return {
    isOpen: singleState,
    toggle,
    open,
    close,
    set,
  };
}

/**
 * Common Progressive Disclosure Patterns
 *
 * 1. MODE-BASED DISCLOSURE
 *    Show/hide fields based on form mode (create vs edit)
 *    Example: UserFormDialog.tsx
 *
 * 2. STATE-BASED TOGGLE
 *    Toggle between simple and advanced views
 *    Example: CompactCollectionForm.tsx (simple vs detailed mode)
 *
 * 3. COLLAPSIBLE SECTIONS
 *    Expandable sections for additional information
 *    Example: DynamicErrorMessage.tsx (recovery actions, prevention tips)
 *
 * 4. EXPANDABLE GROUPS
 *    Accordion-style groups that can be expanded/collapsed
 *    Example: CleanPermissionsEditor.tsx (permission categories)
 *
 * 5. CONDITIONAL STEPS
 *    Multi-step forms that show/hide steps based on previous answers
 *    Example: Wizard-style forms
 */

/**
 * Best Practices:
 *
 * 1. START SIMPLE
 *    - Show only essential fields initially
 *    - Progressive disclosure should reduce cognitive load, not hide critical info
 *
 * 2. PROVIDE CLEAR AFFORDANCES
 *    - Use clear labels like "Show Advanced Options" or "View Details"
 *    - Use icons (ChevronDown, ChevronUp) to indicate expandable content
 *
 * 3. MAINTAIN STATE APPROPRIATELY
 *    - Remember user preferences when possible
 *    - Consider persisting disclosure state to localStorage for frequently used features
 *
 * 4. ACCESSIBILITY
 *    - Use semantic HTML (details/summary or proper ARIA attributes)
 *    - Ensure keyboard navigation works
 *    - Announce state changes to screen readers
 *
 * 5. PERFORMANCE
 *    - Use lazy loading for heavy content
 *    - Consider code splitting for large sections
 *
 * 6. CONSISTENCY
 *    - Use consistent patterns across the application
 *    - Use this hook for standardized behavior
 */
