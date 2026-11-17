/**
 * VidyaPresence — product-native orb (2026-10 redesign).
 *
 * Class gate for the "looks AI-generated" feedback: the orb must stay ONE
 * fill + ONE ring. Any reintroduced orbit SVG / glow / sheen layer fails here.
 * Also pins the contract the voice pipeline and e2e tests depend on
 * (data-testid, data-state, data-live-state, aria-pressed, onActivate).
 */
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { VidyaPresence, toVisualState } from '@/components/vidya/vidya-presence';
import type { VidyaLiveState } from '@/lib/vidya-live/live-session';

beforeAll(() => {
    (global as any).IntersectionObserver = class {
        observe() {}
        disconnect() {}
    };
});

describe('toVisualState', () => {
    it.each<[VidyaLiveState, string]>([
        ['idle', 'idle'],
        ['ended', 'idle'],
        ['connecting', 'connecting'],
        ['listening', 'listening'],
        ['interrupted', 'listening'],
        ['thinking', 'processing'],
        ['speaking', 'speaking'],
        ['error', 'error'],
    ])('%s → %s', (state, visual) => {
        expect(toVisualState(state)).toBe(visual);
    });
});

describe('VidyaPresence', () => {
    it('keeps the voice-pipeline contract', () => {
        const onActivate = jest.fn();
        const { container } = render(<VidyaPresence state="speaking" onActivate={onActivate} label="Talk to VIDYA" />);
        const button = screen.getByTestId('vidya-presence');
        expect(button).toHaveAttribute('aria-label', 'Talk to VIDYA');
        expect(button).toHaveAttribute('aria-pressed', 'true');
        expect(button).toHaveAttribute('data-state', 'speaking');
        const stage = container.querySelector('.vidya-stage')!;
        expect(stage).toHaveAttribute('data-state', 'speaking');
        expect(stage).toHaveAttribute('data-live-state', 'speaking');
        fireEvent.click(button);
        expect(onActivate).toHaveBeenCalledTimes(1);
    });

    it('is inactive (not pressed) at rest and on error', () => {
        const { rerender } = render(<VidyaPresence state="idle" onActivate={() => {}} label="x" />);
        expect(screen.getByTestId('vidya-presence')).toHaveAttribute('aria-pressed', 'false');
        rerender(<VidyaPresence state="error" onActivate={() => {}} label="x" />);
        expect(screen.getByTestId('vidya-presence')).toHaveAttribute('aria-pressed', 'false');
    });

    it.each(['hero', 'workspace', 'compact'] as const)('%s: one fill + one ring, no orbit/glow layers', (size) => {
        const { container } = render(<VidyaPresence state="listening" size={size} onActivate={() => {}} label="x" />);
        expect(container.querySelectorAll('.vidya-core')).toHaveLength(1);
        expect(container.querySelectorAll('.vidya-ring')).toHaveLength(1);
        expect(container.querySelector('svg circle, svg ellipse')).toBeNull(); // orbit system
        for (const old of ['vidya-glow', 'vidya-orbits', 'vidya-rim', 'vidya-sheen', 'vidya-halo', 'vidya-arc']) {
            expect(container.querySelector(`.${old}`)).toBeNull();
        }
    });

    it('compact orb is 64px and has no wordmark (does not cover page controls)', () => {
        const { container } = render(<VidyaPresence state="idle" size="compact" onActivate={() => {}} label="x" />);
        const stage = container.querySelector('.vidya-stage')!;
        expect(stage.className).toContain('h-16');
        expect(stage.className).toContain('w-16');
        expect(container.querySelector('.vidya-wordmark')).toBeNull();
    });
});
