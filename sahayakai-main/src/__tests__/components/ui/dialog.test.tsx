import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';

const TestDialog = () => (
  <Dialog>
    <DialogTrigger asChild>
      <button>Open Dialog</button>
    </DialogTrigger>
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Dialog Title</DialogTitle>
        <DialogDescription>This is the dialog description.</DialogDescription>
      </DialogHeader>
    </DialogContent>
  </Dialog>
);

describe('Dialog Component', () => {
  it('should not be visible initially', () => {
    render(<TestDialog />);
    expect(screen.queryByText('Dialog Title')).not.toBeInTheDocument();
  });

  it('should open when the trigger is clicked and close when the close button is clicked', async () => {
    render(<TestDialog />);
    const trigger = screen.getByRole('button', { name: /Open Dialog/i });

    // Open the dialog
    fireEvent.click(trigger);

    // Wait for the dialog to appear and verify content
    const title = await screen.findByText('Dialog Title');
    expect(title).toBeInTheDocument();
    expect(screen.getByText('This is the dialog description.')).toBeInTheDocument();

    // Find the close button (by its accessible name) and click it
    const closeButton = screen.getByRole('button', { name: /Close/i });
    fireEvent.click(closeButton);

    // Wait for the dialog to disappear
    await waitFor(() => {
      expect(screen.queryByText('Dialog Title')).not.toBeInTheDocument();
    });
  });

  it('should close when the Escape key is pressed', async () => {
    render(<TestDialog />);
    const trigger = screen.getByRole('button', { name: /Open Dialog/i });

    // Open the dialog
    fireEvent.click(trigger);

    // Wait for the dialog to appear
    const title = await screen.findByText('Dialog Title');
    expect(title).toBeInTheDocument();

    // Simulate pressing the Escape key on the dialog itself
    fireEvent.keyDown(title.closest('[role="dialog"]')!, { key: 'Escape', code: 'Escape' });

    // Wait for the dialog to disappear
    await waitFor(() => {
      expect(screen.queryByText('Dialog Title')).not.toBeInTheDocument();
    });
  });
});
