import { render, screen } from '@testing-library/react';
import {
  Card,
  CardHeader,
  CardFooter,
  CardTitle,
  CardDescription,
  CardContent,
} from '@/components/ui/card';

describe('Card Components', () => {
  it('should render a full card structure correctly', () => {
    render(
      <Card>
        <CardHeader>
          <CardTitle>Card Title</CardTitle>
          <CardDescription>Card Description</CardDescription>
        </CardHeader>
        <CardContent>
          <p>Card Content</p>
        </CardContent>
        <CardFooter>
          <p>Card Footer</p>
        </CardFooter>
      </Card>
    );

    expect(screen.getByText('Card Title')).toBeInTheDocument();
    expect(screen.getByText('Card Description')).toBeInTheDocument();
    expect(screen.getByText('Card Content')).toBeInTheDocument();
    expect(screen.getByText('Card Footer')).toBeInTheDocument();
  });

  it('should apply default classes to each part', () => {
    render(
      <Card data-testid="card">
        <CardHeader data-testid="header">
          <CardTitle data-testid="title">Title</CardTitle>
          <CardDescription data-testid="desc">Desc</CardDescription>
        </CardHeader>
        <CardContent data-testid="content">Content</CardContent>
        <CardFooter data-testid="footer">Footer</CardFooter>
      </Card>
    );

    expect(screen.getByTestId('card')).toHaveClass('rounded-lg border bg-card');
    expect(screen.getByTestId('header')).toHaveClass('flex flex-col space-y-1.5 p-4 md:p-6');
    expect(screen.getByTestId('title')).toHaveClass('text-2xl font-semibold');
    expect(screen.getByTestId('desc')).toHaveClass('text-sm text-muted-foreground');
    expect(screen.getByTestId('content')).toHaveClass('p-4 md:p-6 pt-0');
    expect(screen.getByTestId('footer')).toHaveClass('flex items-center p-4 md:p-6 pt-0');
  });

  it('should merge additional classNames for each part', () => {
    render(
      <Card className="extra-card">
        <CardHeader className="extra-header">
          <CardTitle className="extra-title">Title</CardTitle>
          <CardDescription className="extra-desc">Desc</CardDescription>
        </CardHeader>
        <CardContent className="extra-content">Content</CardContent>
        <CardFooter className="extra-footer">Footer</CardFooter>
      </Card>
    );

    expect(screen.getByText('Title').parentElement?.parentElement).toHaveClass('extra-card');
    expect(screen.getByText('Title').parentElement).toHaveClass('extra-header');
    expect(screen.getByText('Title')).toHaveClass('extra-title');
    expect(screen.getByText('Desc')).toHaveClass('extra-desc');
    expect(screen.getByText('Content')).toHaveClass('extra-content');
    expect(screen.getByText('Footer')).toHaveClass('extra-footer');
  });
});
