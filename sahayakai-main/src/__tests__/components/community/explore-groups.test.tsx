/**
 * Tests for src/components/community/explore-groups.tsx — the full-page
 * grid view shown when the user taps "Explore" or the new sidebar
 * "View All" link (Phase 4).
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ExploreGroups } from '@/components/community/explore-groups';
import type { Group } from '@/types/community';

const groups: Group[] = [
    { id: 'g1', name: 'Class 8 Math', description: 'Algebra and geometry', type: 'subject_grade', coverColor: '', memberCount: 12, autoJoinRules: {}, lastActivityAt: '', createdAt: '', createdBy: 'system' },
    { id: 'g2', name: 'Karnataka Teachers', description: 'All teachers in Karnataka', type: 'region', coverColor: '', memberCount: 200, autoJoinRules: {}, lastActivityAt: '', createdAt: '', createdBy: 'system' },
];

describe('ExploreGroups', () => {
    it('renders one card per group with name, description, and member count', () => {
        render(<ExploreGroups groups={groups} onJoinGroup={jest.fn()} onPreviewGroup={jest.fn()} />);
        expect(screen.getByText('Class 8 Math')).toBeInTheDocument();
        expect(screen.getByText('Algebra and geometry')).toBeInTheDocument();
        expect(screen.getByText(/12 members/)).toBeInTheDocument();
        expect(screen.getByText(/200 members/)).toBeInTheDocument();
    });

    it('shows the empty-state when no groups are passed', () => {
        render(<ExploreGroups groups={[]} onJoinGroup={jest.fn()} onPreviewGroup={jest.fn()} />);
        expect(screen.getByText(/joined all available groups/i)).toBeInTheDocument();
    });

    it('clicking the card calls onPreviewGroup', () => {
        const onPreview = jest.fn();
        render(<ExploreGroups groups={groups} onJoinGroup={jest.fn()} onPreviewGroup={onPreview} />);
        fireEvent.click(screen.getByText('Class 8 Math'));
        expect(onPreview).toHaveBeenCalledWith('g1');
    });

    it('clicking Join calls onJoinGroup and stops propagation (no preview fired)', async () => {
        const onJoin = jest.fn().mockResolvedValue(undefined);
        const onPreview = jest.fn();
        render(<ExploreGroups groups={groups} onJoinGroup={onJoin} onPreviewGroup={onPreview} />);

        const joinButtons = screen.getAllByRole('button', { name: /join/i });
        fireEvent.click(joinButtons[0]);

        await waitFor(() => expect(onJoin).toHaveBeenCalledWith('g1'));
        // Preview must NOT fire because Join handler stopPropagation.
        expect(onPreview).not.toHaveBeenCalled();
    });

    it('shows "Joining" label while in flight, then "Joined" on success', async () => {
        let resolveJoin: () => void = () => {};
        const onJoin = jest.fn(() => new Promise<void>((r) => { resolveJoin = r; }));
        render(<ExploreGroups groups={[groups[0]]} onJoinGroup={onJoin} onPreviewGroup={jest.fn()} />);

        fireEvent.click(screen.getByRole('button', { name: /join/i }));
        await waitFor(() => expect(screen.getByText(/joining/i)).toBeInTheDocument());

        resolveJoin();
        await waitFor(() => expect(screen.getByText(/^joined$/i)).toBeInTheDocument());
    });
});
