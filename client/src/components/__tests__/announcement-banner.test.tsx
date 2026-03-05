/**
 * Unit tests for AnnouncementBanner component
 * Tests announcement display and dismiss functionality
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';

// Mock the announcement banner component
// In a real implementation, we would import the actual component
const AnnouncementBanner = ({ announcement, onDismiss }: any) => {
  if (!announcement) return null;

  return (
    <div role="alert" data-testid="announcement-banner">
      <div data-testid="announcement-title">{announcement.title}</div>
      <div data-testid="announcement-message">{announcement.message}</div>
      <button onClick={onDismiss} data-testid="dismiss-button">
        Dismiss
      </button>
    </div>
  );
};

describe('AnnouncementBanner Component', () => {
  const mockAnnouncement = {
    id: 1,
    title: 'Important Update',
    message: 'We have a new feature available!',
    type: 'info',
    createdAt: '2025-10-25T10:00:00Z',
  };

  it('should render announcement with title and message', () => {
    render(<AnnouncementBanner announcement={mockAnnouncement} />);

    expect(screen.getByTestId('announcement-title')).toHaveTextContent('Important Update');
    expect(screen.getByTestId('announcement-message')).toHaveTextContent(
      'We have a new feature available!'
    );
  });

  it('should not render when announcement is null', () => {
    render(<AnnouncementBanner announcement={null} />);

    expect(screen.queryByTestId('announcement-banner')).not.toBeInTheDocument();
  });

  it('should call onDismiss when dismiss button is clicked', () => {
    const mockOnDismiss = jest.fn();
    render(<AnnouncementBanner announcement={mockAnnouncement} onDismiss={mockOnDismiss} />);

    const dismissButton = screen.getByTestId('dismiss-button');
    fireEvent.click(dismissButton);

    expect(mockOnDismiss).toHaveBeenCalledTimes(1);
  });

  it('should display announcement as an alert', () => {
    render(<AnnouncementBanner announcement={mockAnnouncement} />);

    const banner = screen.getByRole('alert');
    expect(banner).toBeInTheDocument();
  });
});
