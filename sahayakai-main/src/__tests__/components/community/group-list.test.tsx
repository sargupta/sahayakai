/**
 * Tests for src/components/community/group-list.tsx (the mobile chip strip).
 */

import { render, screen, fireEvent } from '@testing-library/react';
import GroupList from '@/components/community/group-list';
import type { Group } from '@/types/community';

const groups: Group[] = [
    { id: 'g1', name: 'Class 8 Science', description: '', type: 'subject_grade', coverColor: '', memberCount: 5, autoJoinRules: {}, lastActivityAt: '', createdAt: '', createdBy: 'system' },
    { id: 'g2', name: 'Karnataka Teachers', description: '', type: 'region', coverColor: '', memberCount: 50, autoJoinRules: {}, lastActivityAt: '', createdAt: '', createdBy: 'system' },
];

describe('GroupList', () => {
    it('renders the All chip plus one per group (names truncated to 2 words)', () => {
        render(<GroupList groups={groups} selectedGroupId={null} onSelectGroup={jest.fn()} />);
        expect(screen.getByRole('button', { name: /all/i })).toBeInTheDocument();
        // "Class 8 Science" → "Class 8" after truncation
        expect(screen.getByRole('button', { name: /^class 8$/i })).toBeInTheDocument();
        // "Karnataka Teachers" → unchanged (only 2 words)
        expect(screen.getByRole('button', { name: /^karnataka teachers$/i })).toBeInTheDocument();
    });

    it('truncates group names longer than 2 words', () => {
        const longGroup: Group = { ...groups[0], id: 'g3', name: 'Karnataka Tier 2 Math Teachers' };
        render(<GroupList groups={[longGroup]} selectedGroupId={null} onSelectGroup={jest.fn()} />);
        // First two words: "Karnataka Tier"
        expect(screen.getByRole('button', { name: /^karnataka tier$/i })).toBeInTheDocument();
    });

    it('calls onSelectGroup(null) when All is clicked', () => {
        const onSelect = jest.fn();
        render(<GroupList groups={groups} selectedGroupId="g1" onSelectGroup={onSelect} />);
        fireEvent.click(screen.getByRole('button', { name: /all/i }));
        expect(onSelect).toHaveBeenCalledWith(null);
    });

    it('calls onSelectGroup with the group id when a chip is clicked', () => {
        const onSelect = jest.fn();
        render(<GroupList groups={groups} selectedGroupId={null} onSelectGroup={onSelect} />);
        fireEvent.click(screen.getByRole('button', { name: /^karnataka teachers$/i }));
        expect(onSelect).toHaveBeenCalledWith('g2');
    });

    it('renders the Explore chip only when hasDiscoverableGroups + onExploreGroups are both set', () => {
        const onExplore = jest.fn();
        const { rerender } = render(
            <GroupList
                groups={groups}
                selectedGroupId={null}
                onSelectGroup={jest.fn()}
                onExploreGroups={onExplore}
                hasDiscoverableGroups={true}
            />,
        );
        expect(screen.getByRole('button', { name: /explore/i })).toBeInTheDocument();

        // Without hasDiscoverableGroups → no Explore chip
        rerender(
            <GroupList
                groups={groups}
                selectedGroupId={null}
                onSelectGroup={jest.fn()}
                onExploreGroups={onExplore}
                hasDiscoverableGroups={false}
            />,
        );
        expect(screen.queryByRole('button', { name: /explore/i })).not.toBeInTheDocument();
    });

    it('Explore chip click fires onExploreGroups', () => {
        const onExplore = jest.fn();
        render(
            <GroupList
                groups={groups}
                selectedGroupId={null}
                onSelectGroup={jest.fn()}
                onExploreGroups={onExplore}
                hasDiscoverableGroups={true}
            />,
        );
        fireEvent.click(screen.getByRole('button', { name: /explore/i }));
        expect(onExplore).toHaveBeenCalledTimes(1);
    });
});
