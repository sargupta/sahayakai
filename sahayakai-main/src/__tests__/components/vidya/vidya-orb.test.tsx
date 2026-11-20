/**
 * The VIDYA 3D orb: its state comes only from real signals (deriveOrbState, the tts
 * speaking signal, the mic status), the sphere renders with WebGL when available and
 * as a shaded CSS sphere otherwise, the animation loop pauses while hidden, respects
 * reduced motion and releases the GL context on unmount, the mic keeps its button and
 * label while drawing the orb, and the orb steps aside while a dialog or menu is open.
 */

import React from 'react';
import { act, render, screen } from '@testing-library/react';

jest.mock('@/lib/firebase', () => ({ auth: { currentUser: null } }));
jest.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: jest.fn() }) }));
jest.mock('@/context/language-context', () => ({
    ...jest.requireActual('@/context/language-context'),
    useLanguage: () => ({ t: (k: string) => k, language: 'English', isLoaded: true }),
}));

import { MicrophoneInput } from '@/components/microphone-input';
import { deriveOrbState } from '@/components/vidya/orb-state';
import { useOverlayOpen } from '@/components/vidya/use-overlay-open';
import { hslVarToRgb, VidyaSphere } from '@/components/vidya/vidya-sphere';
import { tts } from '@/lib/tts';

describe('deriveOrbState', () => {
    const base = { failed: false, micStatus: 'idle' as const, speaking: false, awaitingReply: false };
    it('maps each real signal to one state, with a fixed precedence', () => {
        expect(deriveOrbState(base)).toBe('idle');
        expect(deriveOrbState({ ...base, micStatus: 'recording' })).toBe('listening');
        expect(deriveOrbState({ ...base, micStatus: 'processing' })).toBe('thinking');
        expect(deriveOrbState({ ...base, micStatus: 'initializing' })).toBe('thinking');
        expect(deriveOrbState({ ...base, awaitingReply: true })).toBe('thinking');
        expect(deriveOrbState({ ...base, speaking: true })).toBe('speaking');
        expect(deriveOrbState({ ...base, micStatus: 'greeting' })).toBe('speaking');
        expect(deriveOrbState({ ...base, failed: true, speaking: true })).toBe('error');
        // Talking over VIDYA: the mic wins.
        expect(deriveOrbState({ ...base, micStatus: 'recording', speaking: true })).toBe('listening');
        // Speaking only when audio really plays: a pending reply alone is "thinking".
        expect(deriveOrbState({ ...base, awaitingReply: true, speaking: false })).toBe('thinking');
    });
});

describe('tts speaking signal', () => {
    const realAudio = global.Audio;
    const realFetch = global.fetch;
    afterEach(() => {
        global.Audio = realAudio;
        global.fetch = realFetch;
    });

    it('is true only between playback start and end, and false after cancel', async () => {
        let el: { onplaying?: () => void; onended?: () => void; play: () => Promise<void>; pause: () => void; currentTime: number } | null = null;
        global.Audio = jest.fn(() => {
            el = { play: () => Promise.resolve(), pause: jest.fn(), currentTime: 0 };
            return el;
        }) as unknown as typeof Audio;
        global.fetch = jest.fn(async () => ({ ok: true, json: async () => ({ audioContent: 'AAAA' }) })) as unknown as typeof fetch;
        const seen: boolean[] = [];
        const off = tts.subscribeSpeaking((s) => seen.push(s));

        const done = tts.speak('Namaste', 'hi-IN');
        await act(async () => {
            await new Promise((r) => setTimeout(r, 0));
        });
        expect(tts.isSpeaking()).toBe(false); // fetched, not yet playing
        el!.onplaying!();
        expect(tts.isSpeaking()).toBe(true);
        el!.onended!();
        await done;
        expect(tts.isSpeaking()).toBe(false);
        expect(seen).toEqual([true, false]);

        const again = tts.speak('Second', 'hi-IN');
        await act(async () => {
            await new Promise((r) => setTimeout(r, 0));
        });
        el!.onplaying!();
        tts.cancel();
        await again;
        expect(tts.isSpeaking()).toBe(false);
        off();
    });
});

describe('VidyaSphere', () => {
    it('reads the design-token colours', () => {
        const [r, g, b] = hslVarToRgb('24.7 70.1% 38%');
        expect(r).toBeCloseTo(0.646, 2);
        expect(g).toBeCloseTo(0.333, 2);
        expect(b).toBeCloseTo(0.114, 2);
    });

    it('falls back to a shaded CSS sphere without WebGL, reflecting the state', () => {
        const spy = jest.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
        const { container, rerender } = render(<VidyaSphere state="idle" reducedMotion={false} />);
        const el = container.querySelector('[data-vidya-orb-state]')!;
        expect(el.getAttribute('data-vidya-orb-renderer')).toBe('css');
        expect(el.getAttribute('aria-hidden')).toBe('true');
        for (const s of ['listening', 'thinking', 'speaking', 'error'] as const) {
            rerender(<VidyaSphere state={s} reducedMotion={false} />);
            expect(container.querySelector('[data-vidya-orb-state]')!.getAttribute('data-vidya-orb-state')).toBe(s);
        }
        spy.mockRestore();
    });

    function fakeGl() {
        const calls: string[] = [];
        const loseContext = jest.fn();
        const gl = new Proxy(
            { VERTEX_SHADER: 1, FRAGMENT_SHADER: 2, ARRAY_BUFFER: 3, STATIC_DRAW: 4, FLOAT: 5, COLOR_BUFFER_BIT: 6, TRIANGLE_STRIP: 7, COMPILE_STATUS: 8, LINK_STATUS: 9 } as Record<string, unknown>,
            {
                get(target, prop: string) {
                    if (prop in target) return target[prop];
                    if (prop === 'getExtension') return () => ({ loseContext });
                    if (prop === 'getShaderParameter' || prop === 'getProgramParameter') return () => true;
                    return (...args: unknown[]) => {
                        calls.push(prop);
                        return prop.startsWith('create') || prop.startsWith('get') ? {} : undefined;
                    };
                },
            },
        );
        return { gl, calls, loseContext };
    }

    it('draws with WebGL, pauses while the tab is hidden, and releases the context on unmount', () => {
        const { gl, calls, loseContext } = fakeGl();
        const getContext = jest.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(gl as unknown as RenderingContext);
        const raf = jest.spyOn(window, 'requestAnimationFrame').mockImplementation(() => 1);
        const caf = jest.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => undefined);
        const { container, unmount } = render(<VidyaSphere state="thinking" reducedMotion={false} />);
        expect(container.querySelector('[data-vidya-orb-renderer]')!.getAttribute('data-vidya-orb-renderer')).toBe('webgl');
        expect(raf).toHaveBeenCalled();

        Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
        document.dispatchEvent(new Event('visibilitychange'));
        expect(caf).toHaveBeenCalled();
        Object.defineProperty(document, 'hidden', { configurable: true, get: () => false });

        unmount();
        expect(loseContext).toHaveBeenCalled();
        expect(calls).toContain('deleteProgram');
        getContext.mockRestore();
        raf.mockRestore();
        caf.mockRestore();
    });

    it('survives React Strict Mode’s double mount (a lost context is never reused)', () => {
        // Like a browser: once a canvas's context is lost, getContext() returns that dead context.
        const lostCanvases = new WeakSet<HTMLCanvasElement>();
        const getContext = jest.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(function (this: HTMLCanvasElement) {
            const canvas = this;
            const { gl } = fakeGl();
            const dead = lostCanvases.has(canvas);
            return new Proxy(gl as object, {
                get(target, prop: string) {
                    if (prop === 'getExtension') return () => ({ loseContext: () => lostCanvases.add(canvas) });
                    if (dead && (prop === 'getShaderParameter' || prop === 'getProgramParameter')) return () => false;
                    return (target as Record<string, unknown>)[prop];
                },
            }) as unknown as RenderingContext;
        } as unknown as typeof HTMLCanvasElement.prototype.getContext);
        const raf = jest.spyOn(window, 'requestAnimationFrame').mockImplementation(() => 1);
        const { container, unmount } = render(
            <React.StrictMode>
                <VidyaSphere state="idle" reducedMotion={false} />
            </React.StrictMode>,
        );
        expect(container.querySelector('[data-vidya-orb-renderer]')!.getAttribute('data-vidya-orb-renderer')).toBe('webgl');
        expect(container.querySelectorAll('canvas')).toHaveLength(1);
        unmount();
        getContext.mockRestore();
        raf.mockRestore();
    });

    it('with reduced motion draws still frames and never starts the loop', () => {
        const { gl, calls } = fakeGl();
        const getContext = jest.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(gl as unknown as RenderingContext);
        const raf = jest.spyOn(window, 'requestAnimationFrame').mockImplementation(() => 1);
        const { rerender, unmount } = render(<VidyaSphere state="idle" reducedMotion />);
        const draws = calls.filter((c) => c === 'drawArrays').length;
        expect(draws).toBeGreaterThan(0);
        rerender(<VidyaSphere state="speaking" reducedMotion />);
        expect(calls.filter((c) => c === 'drawArrays').length).toBeGreaterThan(draws);
        expect(raf).not.toHaveBeenCalled();
        unmount();
        getContext.mockRestore();
        raf.mockRestore();
    });
});

describe('MicrophoneInput with the orb as its face', () => {
    it('keeps the button, its label and behaviour, draws the visual inside, and reports its status', () => {
        const onStatus = jest.fn();
        render(<MicrophoneInput onTranscriptChange={jest.fn()} onStatusChange={onStatus} renderVisual={(s) => <span data-testid="face">{s}</span>} isFloating iconSize="lg" />);
        const button = screen.getByRole('button', { name: 'Start recording' });
        expect(button).toContainElement(screen.getByTestId('face'));
        expect(screen.getByTestId('face')).toHaveTextContent('idle');
        expect(onStatus).toHaveBeenCalledWith('idle');
    });
});

describe('useOverlayOpen', () => {
    function Probe() {
        return <span data-testid="probe">{String(useOverlayOpen(true))}</span>;
    }
    it('is true while a dialog or menu is open, and false after', async () => {
        const raf = jest.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
            cb(0);
            return 1;
        });
        render(<Probe />);
        expect(screen.getByTestId('probe')).toHaveTextContent('false');
        const dialog = document.createElement('div');
        dialog.setAttribute('role', 'dialog');
        dialog.setAttribute('data-state', 'open');
        await act(async () => {
            document.body.appendChild(dialog);
            await new Promise((r) => setTimeout(r, 0));
        });
        expect(screen.getByTestId('probe')).toHaveTextContent('true');
        await act(async () => {
            dialog.setAttribute('data-state', 'closed');
            await new Promise((r) => setTimeout(r, 0));
        });
        expect(screen.getByTestId('probe')).toHaveTextContent('false');
        dialog.remove();
        raf.mockRestore();
    });
});
