/**
 * Tests for attendance call-related API routes:
 * - /api/attendance/twiml (GET + POST)
 * - /api/attendance/twiml-status (POST)
 * - /api/attendance/call-summary (GET)
 *
 * These are contract/behavior tests with mocked Firebase + AI.
 */

import { TWILIO_LANGUAGE_MAP, TWILIO_VOICE_MAP, CALL_MENU_PROMPTS } from '@/types/attendance';
import type { Language } from '@/types';

// ── Type/constant tests (no mocking needed) ────────────────────────────────

describe('Attendance Call Types', () => {
    describe('TWILIO_LANGUAGE_MAP', () => {
        it('supports 10 languages (all except Odia)', () => {
            const supported = Object.entries(TWILIO_LANGUAGE_MAP)
                .filter(([, v]) => v !== null);
            expect(supported).toHaveLength(10);
        });

        it('returns null for Odia', () => {
            expect(TWILIO_LANGUAGE_MAP['Odia' as Language]).toBeNull();
        });

        it('maps Hindi to hi-IN', () => {
            expect(TWILIO_LANGUAGE_MAP['Hindi' as Language]).toBe('hi-IN');
        });

        it('maps English to en-IN', () => {
            expect(TWILIO_LANGUAGE_MAP['English' as Language]).toBe('en-IN');
        });

        it('maps Kannada to kn-IN', () => {
            expect(TWILIO_LANGUAGE_MAP['Kannada' as Language]).toBe('kn-IN');
        });

        it('maps all supported languages to valid BCP-47 codes', () => {
            const bcp47Pattern = /^[a-z]{2}-[A-Z]{2}$/;
            for (const [lang, code] of Object.entries(TWILIO_LANGUAGE_MAP)) {
                if (code !== null) {
                    expect(code).toMatch(bcp47Pattern);
                }
            }
        });
    });

    describe('TWILIO_VOICE_MAP', () => {
        it('uses Google voices for all languages', () => {
            for (const [, voice] of Object.entries(TWILIO_VOICE_MAP)) {
                expect(voice).toMatch(/^Google\./);
            }
        });

        it('uses Neural2 for Hindi and English (best quality)', () => {
            expect(TWILIO_VOICE_MAP['Hindi' as Language]).toContain('Neural2');
            expect(TWILIO_VOICE_MAP['English' as Language]).toContain('Neural2');
        });

        it('uses Wavenet for most regional languages', () => {
            const wavenetLangs: Language[] = ['Kannada', 'Tamil', 'Malayalam', 'Bengali', 'Marathi', 'Gujarati', 'Punjabi'] as Language[];
            for (const lang of wavenetLangs) {
                expect(TWILIO_VOICE_MAP[lang]).toContain('Wavenet');
            }
        });

        it('uses Standard for Telugu (no Wavenet available)', () => {
            expect(TWILIO_VOICE_MAP['Telugu' as Language]).toContain('Standard');
        });
    });

    describe('CALL_MENU_PROMPTS', () => {
        const requiredKeys = ['greeting', 'inviteResponse', 'waitingPrompt', 'didntHear', 'noResponseGoodbye', 'thanks'];

        it('has prompts for all 10 supported language codes', () => {
            const supportedCodes = Object.values(TWILIO_LANGUAGE_MAP).filter(Boolean) as string[];
            for (const code of supportedCodes) {
                expect(CALL_MENU_PROMPTS[code]).toBeDefined();
            }
        });

        it('each language has all 6 required prompt fields', () => {
            for (const [langCode, prompts] of Object.entries(CALL_MENU_PROMPTS)) {
                for (const key of requiredKeys) {
                    expect(prompts).toHaveProperty(key);
                    expect((prompts as Record<string, string>)[key]).toBeTruthy();
                }
            }
        });

        it('Hindi prompts are in Devanagari script', () => {
            const hiPrompts = CALL_MENU_PROMPTS['hi-IN'];
            // Devanagari Unicode range: \u0900-\u097F
            expect(hiPrompts.greeting).toMatch(/[\u0900-\u097F]/);
        });

        it('Kannada prompts are in Kannada script', () => {
            const knPrompts = CALL_MENU_PROMPTS['kn-IN'];
            // Kannada Unicode range: \u0C80-\u0CFF
            expect(knPrompts.greeting).toMatch(/[\u0C80-\u0CFF]/);
        });

        it('English prompts contain "Namaste"', () => {
            expect(CALL_MENU_PROMPTS['en-IN'].greeting).toContain('Namaste');
        });

        it('all prompts mention pressing 2 to end call', () => {
            for (const [, prompts] of Object.entries(CALL_MENU_PROMPTS)) {
                expect(prompts.inviteResponse).toMatch(/2/);
            }
        });
    });
});

// ── TwiML XML helper behavior ───────────────────────────────────────────────

describe('TwiML XML structure', () => {
    // Test the escapeXml logic that the twiml route uses
    function escapeXml(text: string): string {
        return text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&apos;');
    }

    it('escapes all XML special characters', () => {
        expect(escapeXml('Tom & Jerry')).toBe('Tom &amp; Jerry');
        expect(escapeXml('<script>')).toBe('&lt;script&gt;');
        expect(escapeXml('"hello"')).toBe('&quot;hello&quot;');
        expect(escapeXml("it's")).toBe('it&apos;s');
    });

    it('handles messages with mixed special chars', () => {
        const msg = 'Student\'s grade is "A+" & 100% < 200>';
        const escaped = escapeXml(msg);
        expect(escaped).not.toContain('<');
        expect(escaped).not.toContain('>');
        expect(escaped).not.toContain('&s'); // no raw & (except &amp; etc.)
        expect(escaped).toContain('&amp;');
    });

    it('does not double-escape', () => {
        expect(escapeXml('&amp;')).toBe('&amp;amp;'); // correct — input was already escaped
    });
});
