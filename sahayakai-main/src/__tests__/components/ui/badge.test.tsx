import { render, screen } from '@testing-library/react';
import { Badge } from '@/components/ui/badge';

describe('Badge Component', () => {
  it('should render with default variant', () => {
    render(<Badge>Default Badge</Badge>);
    const badgeElement = screen.getByText('Default Badge');
    expect(badgeElement).toBeInTheDocument();
    expect(badgeElement).toHaveClass('bg-primary text-primary-foreground');
  });

  it('should render with secondary variant', () => {
    render(<Badge variant="secondary">Secondary Badge</Badge>);
    const badgeElement = screen.getByText('Secondary Badge');
    expect(badgeElement).toBeInTheDocument();
    expect(badgeElement).toHaveClass('bg-secondary text-secondary-foreground');
  });

  it('should render with destructive variant', () => {
    render(<Badge variant="destructive">Destructive Badge</Badge>);
    const badgeElement = screen.getByText('Destructive Badge');
    expect(badgeElement).toBeInTheDocument();
    expect(badgeElement).toHaveClass('bg-destructive text-destructive-foreground');
  });

  it('should render with outline variant', () => {
    render(<Badge variant="outline">Outline Badge</Badge>);
    const badgeElement = screen.getByText('Outline Badge');
    expect(badgeElement).toBeInTheDocument();
    expect(badgeElement).toHaveClass('text-foreground');
  });

  it('should apply additional classNames', () => {
    render(<Badge className="extra-class">Badge with extra class</Badge>);
    const badgeElement = screen.getByText('Badge with extra class');
    expect(badgeElement).toHaveClass('extra-class');
    expect(badgeElement).toHaveClass('bg-primary'); // Default variant class
  });
});
