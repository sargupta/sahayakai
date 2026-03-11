import { render, screen } from '@testing-library/react';
import { Skeleton } from '@/components/ui/skeleton';

describe('Skeleton Component', () => {
  it('should render a div', () => {
    render(<Skeleton data-testid="skeleton" />);
    const skeletonElement = screen.getByTestId('skeleton');
    expect(skeletonElement).toBeInTheDocument();
    expect(skeletonElement.tagName).toBe('DIV');
  });

  it('should have the correct default classes for animation and style', () => {
    render(<Skeleton data-testid="skeleton" />);
    const skeletonElement = screen.getByTestId('skeleton');
    expect(skeletonElement).toHaveClass('animate-pulse', 'rounded-md', 'bg-muted');
  });

  it('should merge additional classNames', () => {
    render(<Skeleton className="h-4 w-1/2" data-testid="skeleton" />);
    const skeletonElement = screen.getByTestId('skeleton');
    expect(skeletonElement).toHaveClass('h-4', 'w-1/2');
    expect(skeletonElement).toHaveClass('animate-pulse'); // Default class
  });
});
