/**
 * CLASS GATE — generated-content action rows never crowd.
 *
 * Founder report (2026-11-17): Library cards (Open / Export / delete / language squeezed into
 * one footer row) and a generated quiz (7 buttons beside the title) were cluttered.
 *  - ResultShell: more than INLINE_ACTIONS_MAX buttons always get their own full-width row.
 *  - LibraryCard: the footer holds exactly two equal actions; delete sits in the corner and
 *    its confirmation replaces the footer row instead of adding to it.
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { INLINE_ACTIONS_MAX, ResultShell } from '@/components/ui/result-shell';
import { LibraryCard } from '@/components/library/library-card';

jest.mock('@/context/language-context', () => ({ useLanguage: () => ({ t: (s: string) => s }) }));

const actions = (n: number) => Array.from({ length: n }, (_, i) => ({ label: `A${i}`, onClick: () => {} }));
const actionRow = () => screen.getByRole('button', { name: 'A0' }).parentElement as HTMLElement;

describe('ResultShell action layout', () => {
    it(`up to ${INLINE_ACTIONS_MAX} actions stay beside the title`, () => {
        render(<ResultShell title="T" actions={actions(INLINE_ACTIONS_MAX)}>body</ResultShell>);
        expect(actionRow().className).not.toMatch(/\bw-full\b/);
    });
    it('more actions (a generated quiz has 6 + Share) drop onto their own full-width row', () => {
        render(<ResultShell title="T" actions={actions(6)} extraActions={<button>Share</button>}>body</ResultShell>);
        expect(actionRow().className).toMatch(/\bw-full\b/);
    });
    it('an explicit inline layout is still honoured', () => {
        render(<ResultShell title="T" actionsLayout="inline" actions={actions(6)}>body</ResultShell>);
        expect(actionRow().className).not.toMatch(/\bw-full\b/);
    });
});

describe('LibraryCard actions', () => {
    const resource = { id: 'r1', type: 'quiz', title: 'Planets quiz', gradeLevel: 'Class 6', subject: 'Science', language: 'English' } as never;

    it('footer has exactly two equal actions (Open, Export); delete is in the corner', () => {
        render(<LibraryCard resource={resource} onOpen={() => {}} onDownload={() => {}} onDelete={() => {}} />);
        const footer = screen.getByTestId('library-card-actions');
        const buttons = footer.querySelectorAll('button');
        expect([...buttons].map((b) => b.textContent)).toEqual(['Open', 'Export']);
        expect(footer.className).toMatch(/\bgrid-cols-2\b/);
        expect(footer.contains(screen.getByTestId('library-card-delete'))).toBe(false);
        // the language tag sits with the other tags, not in the action row
        expect(footer.textContent).not.toMatch(/English/);
    });

    it('confirming a delete replaces the two actions instead of adding to them', () => {
        const onDelete = jest.fn();
        render(<LibraryCard resource={resource} onOpen={() => {}} onDownload={() => {}} onDelete={onDelete} />);
        fireEvent.click(screen.getByTestId('library-card-delete'));
        const buttons = screen.getByTestId('library-card-actions').querySelectorAll('button');
        expect([...buttons].map((b) => b.textContent)).toEqual(['Confirm', 'Cancel']);
        fireEvent.click(buttons[0]);
        expect(onDelete).toHaveBeenCalledTimes(1);
    });
});
