/**
 * Tests for src/components/community/chat-preview-banner.tsx.
 *
 * Phase 4 fix verified: replaces hardcoded blue with deterministic
 * getGroupColor(groupName) so each banner reads as part of its group's
 * visual identity.
 */

import { render, screen, fireEvent } from '@testing-library/react';
import { ChatPreviewBanner } from '@/components/community/chat-preview-banner';
import { getGroupColor } from '@/types/community';

describe('ChatPreviewBanner', () => {
    it('renders the message count and group name', () => {
        render(
            <ChatPreviewBanner
                groupId="grp-1"
                groupName="Class 8 Science"
                messageCount={3}
                latestMessage="hi all"
                onClick={jest.fn()}
            />,
        );
        expect(screen.getByText(/3 new messages/i)).toBeInTheDocument();
        expect(screen.getByText('Class 8 Science')).toBeInTheDocument();
    });

    it('uses singular "message" when count === 1', () => {
        render(
            <ChatPreviewBanner
                groupId="grp-1"
                groupName="X"
                messageCount={1}
                onClick={jest.fn()}
            />,
        );
        expect(screen.getByText('1 new message')).toBeInTheDocument();
    });

    it('renders the latest message excerpt when provided', () => {
        render(
            <ChatPreviewBanner
                groupId="grp-1"
                groupName="X"
                messageCount={1}
                latestMessage="anyone tried chapati fractions?"
                onClick={jest.fn()}
            />,
        );
        expect(screen.getByText(/anyone tried chapati fractions/i)).toBeInTheDocument();
    });

    it('omits latest message when not provided', () => {
        render(
            <ChatPreviewBanner
                groupId="grp-1"
                groupName="X"
                messageCount={1}
                onClick={jest.fn()}
            />,
        );
        // The italic <p> for latestMessage should not be present.
        expect(screen.queryByText(/anyone/i)).not.toBeInTheDocument();
    });

    it('calls onClick(groupId) when the banner is clicked', () => {
        const onClick = jest.fn();
        render(
            <ChatPreviewBanner
                groupId="grp-X"
                groupName="X"
                messageCount={1}
                onClick={onClick}
            />,
        );
        fireEvent.click(screen.getByRole('button'));
        expect(onClick).toHaveBeenCalledWith('grp-X');
    });

    it('uses getGroupColor for the color stripe (Phase 4)', () => {
        const { container } = render(
            <ChatPreviewBanner
                groupId="grp-1"
                groupName="Karnataka Teachers"
                messageCount={1}
                onClick={jest.fn()}
            />,
        );
        const stripe = container.querySelector('span[style*="background"]');
        expect(stripe).not.toBeNull();
        const expectedColor = getGroupColor('Karnataka Teachers');
        expect((stripe as HTMLElement).getAttribute('style')).toContain(expectedColor);
    });
});
