import { render, screen } from '@testing-library/react';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';

describe('Alert Component', () => {
  it('should render with default variant', () => {
    render(
      <Alert data-testid="alert">
        <AlertTitle>Default Alert</AlertTitle>
        <AlertDescription>This is a default alert.</AlertDescription>
      </Alert>
    );
    const alertElement = screen.getByTestId('alert');
    expect(alertElement).toBeInTheDocument();
    expect(screen.getByText('Default Alert')).toBeInTheDocument();
    expect(screen.getByText('This is a default alert.')).toBeInTheDocument();
    expect(alertElement).toHaveClass('bg-background text-foreground');
  });

  it('should render with destructive variant', () => {
    render(
      <Alert variant="destructive" data-testid="alert">
        <AlertTitle>Destructive Alert</AlertTitle>
        <AlertDescription>This is a destructive alert.</AlertDescription>
      </Alert>
    );
    const alertElement = screen.getByTestId('alert');
    expect(alertElement).toBeInTheDocument();
    expect(alertElement).toHaveClass('border-destructive/50 text-destructive');
  });

  it('should render an icon inside', () => {
    render(
      <Alert>
        <svg data-testid="icon"></svg>
        <AlertTitle>Alert with Icon</AlertTitle>
      </Alert>
    );
    expect(screen.getByTestId('icon')).toBeInTheDocument();
  });

  it('should apply additional classNames to all parts', () => {
    render(
      <Alert className="extra-alert-class">
        <AlertTitle className="extra-title-class">Title</AlertTitle>
        <AlertDescription className="extra-desc-class">Desc</AlertDescription>
      </Alert>
    );
    expect(screen.getByRole('alert')).toHaveClass('extra-alert-class');
    expect(screen.getByText('Title')).toHaveClass('extra-title-class');
    expect(screen.getByText('Desc')).toHaveClass('extra-desc-class');
  });
});
