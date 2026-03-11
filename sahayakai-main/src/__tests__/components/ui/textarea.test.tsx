import { render, screen, fireEvent } from '@testing-library/react';
import { Textarea } from '@/components/ui/textarea';
import React from 'react';

describe('Textarea Component', () => {
  it('should render a textarea element', () => {
    render(<Textarea data-testid="test-textarea" />);
    const textareaElement = screen.getByTestId('test-textarea');
    expect(textareaElement).toBeInTheDocument();
    expect(textareaElement.tagName).toBe('TEXTAREA');
  });

  it('should apply default classes', () => {
    render(<Textarea data-testid="test-textarea" />);
    const textareaElement = screen.getByTestId('test-textarea');
    expect(textareaElement).toHaveClass('flex h-10 w-full rounded-md border');
  });

  it('should forward the placeholder and other props', () => {
    render(<Textarea placeholder="Enter text here" />);
    const textareaElement = screen.getByPlaceholderText('Enter text here');
    expect(textareaElement).toBeInTheDocument();
  });

  it('should handle user input with onChange', () => {
    const handleChange = jest.fn();
    render(<Textarea onChange={handleChange} data-testid="test-textarea" />);
    const textareaElement = screen.getByTestId('test-textarea');
    fireEvent.change(textareaElement, { target: { value: 'new text' } });
    expect(handleChange).toHaveBeenCalledTimes(1);
  });

  // A more complete example showing state change
  const StatefulTextarea = () => {
    const [value, setValue] = React.useState('');
    return <Textarea value={value} onChange={(e) => setValue(e.target.value)} placeholder="stateful" />;
  };

  it('should update its value when user types', () => {
    render(<StatefulTextarea />);
    const textareaElement = screen.getByPlaceholderText('stateful') as HTMLTextAreaElement;
    expect(textareaElement.value).toBe('');
    fireEvent.change(textareaElement, { target: { value: 'updated text' } });
    expect(textareaElement.value).toBe('updated text');
  });

  it('should be disabled when the disabled prop is set', () => {
    render(<Textarea disabled data-testid="test-textarea" />);
    const textareaElement = screen.getByTestId('test-textarea');
    expect(textareaElement).toBeDisabled();
  });

  it('should merge additional classNames', () => {
    render(<Textarea className="extra-class" data-testid="test-textarea" />);
    const textareaElement = screen.getByTestId('test-textarea');
    expect(textareaElement).toHaveClass('extra-class');
    expect(textareaElement).toHaveClass('border-input'); // Default class
  });
});
