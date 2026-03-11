import { render, screen } from '@testing-library/react';
import { Label } from '@/components/ui/label';

describe('Label Component', () => {
  it('should render a label with text', () => {
    render(<Label>Username</Label>);
    const labelElement = screen.getByText('Username');
    expect(labelElement).toBeInTheDocument();
    expect(labelElement.tagName).toBe('LABEL');
  });

  it('should apply default classes', () => {
    render(<Label>Username</Label>);
    const labelElement = screen.getByText('Username');
    expect(labelElement).toHaveClass('text-sm font-medium leading-none');
  });

  it('should forward props like htmlFor', () => {
    render(<Label htmlFor="username-input">Username</Label>);
    const labelElement = screen.getByText('Username');
    expect(labelElement).toHaveAttribute('for', 'username-input');
  });

  it('should merge additional classNames', () => {
    render(<Label className="extra-class">Username</Label>);
    const labelElement = screen.getByText('Username');
    expect(labelElement).toHaveClass('extra-class');
  });
});
