import { render, screen, fireEvent } from '@testing-library/react';
import { Switch } from '@/components/ui/switch';

describe('Switch Component', () => {
  it('should render in the unchecked state by default', () => {
    render(<Switch data-testid="test-switch" />);
    const switchElement = screen.getByTestId('test-switch');
    expect(switchElement).toBeInTheDocument();
    expect(switchElement).toHaveAttribute('data-state', 'unchecked');
  });

  it('should render in the checked state when checked prop is true', () => {
    render(<Switch checked={true} data-testid="test-switch" />);
    const switchElement = screen.getByTestId('test-switch');
    expect(switchElement).toHaveAttribute('data-state', 'checked');
  });

  it('should call onCheckedChange with the new state when clicked', () => {
    const handleCheckedChange = jest.fn();
    render(<Switch onCheckedChange={handleCheckedChange} data-testid="test-switch" />);
    const switchElement = screen.getByTestId('test-switch');

    // Initial state is unchecked
    expect(switchElement).toHaveAttribute('data-state', 'unchecked');

    // Click to check
    fireEvent.click(switchElement);
    expect(handleCheckedChange).toHaveBeenCalledTimes(1);
    expect(handleCheckedChange).toHaveBeenCalledWith(true);

    // The component itself is uncontrolled, so its state will update
    expect(switchElement).toHaveAttribute('data-state', 'checked');

    // Click to uncheck
    fireEvent.click(switchElement);
    expect(handleCheckedChange).toHaveBeenCalledTimes(2);
    expect(handleCheckedChange).toHaveBeenCalledWith(false);
    expect(switchElement).toHaveAttribute('data-state', 'unchecked');
  });

  it('should not respond to clicks when disabled', () => {
    const handleCheckedChange = jest.fn();
    render(<Switch onCheckedChange={handleCheckedChange} disabled data-testid="test-switch" />);
    const switchElement = screen.getByTestId('test-switch');

    expect(switchElement).toBeDisabled();
    fireEvent.click(switchElement);
    expect(handleCheckedChange).not.toHaveBeenCalled();
  });

  it('should apply additional classNames', () => {
    render(<Switch className="extra-class" data-testid="test-switch" />);
    const switchElement = screen.getByTestId('test-switch');
    expect(switchElement).toHaveClass('extra-class');
  });
});
