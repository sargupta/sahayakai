import { render, screen, fireEvent } from '@testing-library/react';
import { Input } from '@/components/ui/input';
import React from 'react';

describe('Input Component', () => {
  it('should render an input element', () => {
    render(<Input data-testid="test-input" />);
    const inputElement = screen.getByTestId('test-input');
    expect(inputElement).toBeInTheDocument();
    expect(inputElement.tagName).toBe('INPUT');
  });

  it('should apply default classes', () => {
    render(<Input data-testid="test-input" />);
    const inputElement = screen.getByTestId('test-input');
    expect(inputElement).toHaveClass('flex h-10 w-full rounded-md border');
  });

  it('should forward the type, placeholder, and other props', () => {
    render(<Input type="password" placeholder="Enter password" />);
    const inputElement = screen.getByPlaceholderText('Enter password');
    expect(inputElement).toHaveAttribute('type', 'password');
  });

  it('should handle user input with onChange', () => {
    const handleChange = jest.fn();
    render(<Input onChange={handleChange} data-testid="test-input" />);
    const inputElement = screen.getByTestId('test-input');
    fireEvent.change(inputElement, { target: { value: 'testing' } });
    expect(handleChange).toHaveBeenCalledTimes(1);
  });

  // A more complete example showing state change
  const StatefulInput = () => {
    const [value, setValue] = React.useState('');
    return <Input value={value} onChange={(e) => setValue(e.target.value)} placeholder="stateful" />;
  };

  it('should update its value when user types', () => {
    render(<StatefulInput />);
    const inputElement = screen.getByPlaceholderText('stateful') as HTMLInputElement;
    expect(inputElement.value).toBe('');
    fireEvent.change(inputElement, { target: { value: 'new value' } });
    expect(inputElement.value).toBe('new value');
  });


  it('should be disabled when the disabled prop is set', () => {
    render(<Input disabled data-testid="test-input" />);
    const inputElement = screen.getByTestId('test-input');
    expect(inputElement).toBeDisabled();
  });

  it('should merge additional classNames', () => {
    render(<Input className="extra-class" data-testid="test-input" />);
    const inputElement = screen.getByTestId('test-input');
    expect(inputElement).toHaveClass('extra-class');
    expect(inputElement).toHaveClass('border-input'); // Default class
  });
});
