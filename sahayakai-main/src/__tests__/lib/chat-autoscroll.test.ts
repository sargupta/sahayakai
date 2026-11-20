/** @jest-environment node */
/**
 * Regression: the Messages thread scrolled to the bottom on EVERY render (its effect was keyed on
 * an array rebuilt each render), so a teacher reading older messages was yanked back down by a
 * typing indicator or a keystroke. The rule, and the fact the effect is keyed per added message.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { shouldAutoScroll } from '@/lib/chat-autoscroll';

describe('chat auto-scroll rule', () => {
    it('follows new messages while the reader is at the bottom', () => {
        expect(shouldAutoScroll({ nearBottom: true, lastIsMine: false })).toBe(true);
    });
    it('never moves a reader who scrolled up, for someone else’s message', () => {
        expect(shouldAutoScroll({ nearBottom: false, lastIsMine: false })).toBe(false);
    });
    it('always shows the reader their own sent message', () => {
        expect(shouldAutoScroll({ nearBottom: false, lastIsMine: true })).toBe(true);
    });
});

describe('conversation thread wiring', () => {
    const src = readFileSync(join(process.cwd(), 'src/components/messages/conversation-thread.tsx'), 'utf8');
    it('is keyed on the added message, not on the per-render message array', () => {
        expect(src).not.toMatch(/\}, \[displayMessages\]\);/);
        expect(src).toMatch(/\}, \[lastKey\]\);/);
        expect(src).toMatch(/useNearBottom\(scrollContainerRef/);
    });
});
