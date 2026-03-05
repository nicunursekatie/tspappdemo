import { useEffect } from 'react';
import { useLocation } from 'wouter';

/**
 * ScrollToTop component - scrolls window to top on route changes
 * This ensures users start at the top of each new page they navigate to
 */
export function ScrollToTop() {
  const [location] = useLocation();

  useEffect(() => {
    // Scroll to top whenever the location changes
    window.scrollTo({
      top: 0,
      left: 0,
      behavior: 'instant' // Use 'instant' for immediate scroll, 'smooth' for animated
    });
  }, [location]);

  return null; // This component doesn't render anything
}
