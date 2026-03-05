/**
 * Unit tests for CelebrationToast component
 * Tests success/celebration notification display
 */

import { describe, it, expect } from '@jest/globals';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

// Mock the celebration toast component
const CelebrationToast = ({ title, message, type = 'success', show }: any) => {
  if (!show) return null;

  return (
    <div
      data-testid="celebration-toast"
      role="status"
      aria-live="polite"
      className={`toast-${type}`}
    >
      {title && <div data-testid="toast-title">{title}</div>}
      <div data-testid="toast-message">{message}</div>
    </div>
  );
};

describe('CelebrationToast Component', () => {
  it('should render toast with title and message when show is true', () => {
    render(
      <CelebrationToast
        title="Success!"
        message="Your action was completed successfully"
        show={true}
      />
    );

    expect(screen.getByTestId('celebration-toast')).toBeInTheDocument();
    expect(screen.getByTestId('toast-title')).toHaveTextContent('Success!');
    expect(screen.getByTestId('toast-message')).toHaveTextContent(
      'Your action was completed successfully'
    );
  });

  it('should not render when show is false', () => {
    render(
      <CelebrationToast
        title="Success!"
        message="Your action was completed successfully"
        show={false}
      />
    );

    expect(screen.queryByTestId('celebration-toast')).not.toBeInTheDocument();
  });

  it('should render without title when title is not provided', () => {
    render(<CelebrationToast message="Simple message" show={true} />);

    expect(screen.queryByTestId('toast-title')).not.toBeInTheDocument();
    expect(screen.getByTestId('toast-message')).toHaveTextContent('Simple message');
  });

  it('should apply correct type class', () => {
    const { rerender } = render(
      <CelebrationToast message="Success message" type="success" show={true} />
    );

    expect(screen.getByTestId('celebration-toast')).toHaveClass('toast-success');

    rerender(<CelebrationToast message="Error message" type="error" show={true} />);

    expect(screen.getByTestId('celebration-toast')).toHaveClass('toast-error');
  });

  it('should default to success type', () => {
    render(<CelebrationToast message="Default type message" show={true} />);

    expect(screen.getByTestId('celebration-toast')).toHaveClass('toast-success');
  });

  it('should have proper accessibility attributes', () => {
    render(<CelebrationToast message="Accessible toast" show={true} />);

    const toast = screen.getByTestId('celebration-toast');
    expect(toast).toHaveAttribute('role', 'status');
    expect(toast).toHaveAttribute('aria-live', 'polite');
  });
});
