import { render, screen, fireEvent } from '@testing-library/react';
import { Button } from '@/components/ui/button';

describe('Button Component', () => {
  it('should render a button with children', () => {
    render(<Button>Click Me</Button>);
    const buttonElement = screen.getByRole('button', { name: /Click Me/i });
    expect(buttonElement).toBeInTheDocument();
  });

  it('should apply default variant and size classes', () => {
    render(<Button>Default</Button>);
    const buttonElement = screen.getByRole('button', { name: /Default/i });
    expect(buttonElement).toHaveClass('bg-primary', 'text-primary-foreground', 'h-10');
  });

  it('should apply specified variant and size classes', () => {
    render(<Button variant="destructive" size="sm">Destructive SM</Button>);
    const buttonElement = screen.getByRole('button', { name: /Destructive SM/i });
    expect(buttonElement).toHaveClass('bg-destructive', 'h-9');
  });

  it('should handle ghost variant', () => {
    render(<Button variant="ghost">Ghost</Button>);
    const buttonElement = screen.getByRole('button', { name: /Ghost/i });
    expect(buttonElement).toHaveClass('hover:bg-accent');
  });

  it('should handle link variant', () => {
    render(<Button variant="link">Link</Button>);
    const buttonElement = screen.getByRole('button', { name: /Link/i });
    expect(buttonElement).toHaveClass('text-primary', 'underline-offset-4');
  });

  it('should call onClick handler when clicked', () => {
    const handleClick = jest.fn();
    render(<Button onClick={handleClick}>Clickable</Button>);
    const buttonElement = screen.getByRole('button', { name: /Clickable/i });
    fireEvent.click(buttonElement);
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('should not call onClick handler when disabled', () => {
    const handleClick = jest.fn();
    render(<Button onClick={handleClick} disabled>Disabled</Button>);
    const buttonElement = screen.getByRole('button', { name: /Disabled/i });
    expect(buttonElement).toBeDisabled();
    fireEvent.click(buttonElement);
    expect(handleClick).not.toHaveBeenCalled();
  });

  it('should render as a child component when asChild is true', () => {
    render(
      <Button asChild>
        <a href="/home">Go Home</a>
      </Button>
    );
    // The role is now 'link' because the child is an anchor tag
    const linkElement = screen.getByRole('link', { name: /Go Home/i });
    expect(linkElement).toBeInTheDocument();
    expect(linkElement.tagName).toBe('A');
    // It should still have the button classes
    expect(linkElement).toHaveClass('bg-primary', 'h-10');
  });

  it('should apply additional classNames', () => {
    render(<Button className="extra-class">Custom</Button>);
    const buttonElement = screen.getByRole('button', { name: /Custom/i });
    expect(buttonElement).toHaveClass('extra-class');
  });
});
