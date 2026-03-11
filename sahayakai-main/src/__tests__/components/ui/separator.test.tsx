import { render, screen } from '@testing-library/react';
import { Separator } from '@/components/ui/separator';

describe('Separator Component', () => {
  it('should render a horizontal separator by default', () => {
    render(<Separator data-testid="separator" />);
    const separatorElement = screen.getByTestId('separator');
    expect(separatorElement).toBeInTheDocument();
    // Default orientation is horizontal
    expect(separatorElement).toHaveClass('h-[1px] w-full');
    expect(separatorElement).not.toHaveClass('h-full w-[1px]');
  });

  it('should render a vertical separator when orientation is vertical', () => {
    render(<Separator orientation="vertical" data-testid="separator" />);
    const separatorElement = screen.getByTestId('separator');
    expect(separatorElement).toBeInTheDocument();
    expect(separatorElement).toHaveClass('h-full w-[1px]');
    expect(separatorElement).not.toHaveClass('h-[1px] w-full');
  });

  it('should apply default background class', () => {
    render(<Separator data-testid="separator" />);
    const separatorElement = screen.getByTestId('separator');
    expect(separatorElement).toHaveClass('bg-border');
  });

  it('should merge additional classNames', () => {
    render(<Separator className="extra-class" data-testid="separator" />);
    const separatorElement = screen.getByTestId('separator');
    expect(separatorElement).toHaveClass('extra-class');
  });
});
