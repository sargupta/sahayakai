/**
 * @jest-environment node
 *
 * Spoken forms come from the reviewed lexicon, deterministically (plan §4⑥).
 */

import {
    fillPattern,
    formatAudience,
    formatDate,
    formatGrade,
    formatTime,
    formatVenue,
    locativeOf,
    parseCalendarDate,
} from '@/lib/sampark/scripts/spoken';
import { ScriptRenderError } from '@/lib/sampark/scripts/types';
import type { SchoolVenue, SpokenTime } from '@/types/sampark';

const t = (hour: number, minute: 0 | 30): SpokenTime => ({ hour, minute });

describe('formatDate', () => {
    it('says the weekday, day and month — never the year', () => {
        expect(formatDate('2026-10-10', 'English')).toBe('Saturday, the tenth of October');
        expect(formatDate('2026-10-10', 'Hindi')).toBe('शनिवार, दस अक्टूबर');
        expect(formatDate('2026-10-10', 'Bengali')).toBe('শনিবার, দশই অক্টোবর');
        expect(formatDate('2026-10-10', 'Nepali')).toBe('शनिबार, दस अक्टोबर');
        expect(formatDate('2026-10-08', 'Nepali')).toBe('बिहीबार, आठ अक्टोबर');
    });

    it('uses the Bengali date forms', () => {
        expect(formatDate('2026-10-01', 'Bengali')).toBe('বৃহস্পতিবার, পয়লা অক্টোবর');
        expect(formatDate('2026-10-02', 'Bengali')).toBe('শুক্রবার, দোসরা অক্টোবর');
        expect(formatDate('2026-10-03', 'Bengali')).toBe('শনিবার, তেসরা অক্টোবর');
        expect(formatDate('2026-10-04', 'Bengali')).toBe('রবিবার, চৌঠা অক্টোবর');
        expect(formatDate('2026-10-15', 'Bengali')).toBe('বৃহস্পতিবার, পনেরোই অক্টোবর');
        expect(formatDate('2026-10-19', 'Bengali')).toBe('সোমবার, উনিশে অক্টোবর');
        expect(formatDate('2026-10-31', 'Bengali')).toBe('শনিবার, একত্রিশে অক্টোবর');
    });

    it('computes the weekday from the calendar date, not the clock', () => {
        expect(parseCalendarDate('2026-10-08').weekday).toBe(4);
        expect(formatDate('2028-02-29', 'English')).toBe('Tuesday, the twenty-ninth of February');
    });

    it('refuses impossible or malformed dates', () => {
        expect(() => formatDate('2026-02-30', 'Hindi')).toThrow(ScriptRenderError);
        expect(() => formatDate('2026-13-01', 'Hindi')).toThrow(ScriptRenderError);
        expect(() => formatDate('10/10/2026', 'Hindi')).toThrow(ScriptRenderError);
        expect(() => formatDate('', 'Hindi')).toThrow(ScriptRenderError);
    });
});

describe('formatTime', () => {
    it('whole and half hours with the day period', () => {
        expect(formatTime(t(10, 0), 'Hindi')).toBe('सुबह दस बजे');
        expect(formatTime(t(10, 30), 'Hindi')).toBe('सुबह साढ़े दस बजे');
        expect(formatTime(t(10, 0), 'Nepali')).toBe('बिहान दस बजे');
        expect(formatTime(t(10, 30), 'Nepali')).toBe('बिहान साढे दस बजे');
        expect(formatTime(t(10, 0), 'Bengali')).toBe('সকাল দশটায়');
        expect(formatTime(t(10, 30), 'Bengali')).toBe('সকাল সাড়ে দশটায়');
        // Indian English: "ten thirty", never the British "half past ten".
        expect(formatTime(t(10, 0), 'English')).toBe("ten o'clock in the morning");
        expect(formatTime(t(10, 30), 'English')).toBe('ten thirty in the morning');
        expect(formatTime(t(18, 30), 'English')).toBe('six thirty in the evening');
    });

    it('1:30 and 2:30 have their own words', () => {
        expect(formatTime(t(13, 30), 'Hindi')).toBe('दोपहर डेढ़ बजे');
        expect(formatTime(t(14, 30), 'Hindi')).toBe('दोपहर ढाई बजे');
        expect(formatTime(t(13, 30), 'Bengali')).toBe('দুপুর দেড়টায়');
        expect(formatTime(t(14, 30), 'Bengali')).toBe('দুপুর আড়াইটায়');
        expect(formatTime(t(13, 30), 'Nepali')).toBe('दिउँसो डेढ बजे');
        expect(formatTime(t(14, 30), 'Nepali')).toBe('दिउँसो अढाई बजे');
    });

    it('noon, afternoon and evening', () => {
        expect(formatTime(t(12, 0), 'English')).toBe('twelve noon');
        expect(formatTime(t(12, 0), 'Hindi')).toBe('दोपहर बारह बजे');
        expect(formatTime(t(12, 30), 'Hindi')).toBe('दोपहर साढ़े बारह बजे');
        expect(formatTime(t(16, 0), 'Nepali')).toBe('बेलुका चार बजे');
        expect(formatTime(t(16, 0), 'Bengali')).toBe('বিকেল চারটেয়');
        expect(formatTime(t(18, 30), 'Bengali')).toBe('সন্ধ্যা সাড়ে ছটায়');
    });

    it('refuses minutes other than 0/30 and hours no notice may name', () => {
        expect(() => formatTime({ hour: 10, minute: 15 as 0 }, 'Hindi')).toThrow(/whole and half hours/);
        expect(() => formatTime(t(23, 0), 'Hindi')).toThrow(/no day period/);
        expect(() => formatTime(t(5, 30), 'English')).toThrow(ScriptRenderError);
        expect(() => formatTime(t(24, 0), 'English')).toThrow(ScriptRenderError);
        expect(() => formatTime({ hour: 9.5, minute: 0 }, 'English')).toThrow(ScriptRenderError);
    });
});

describe('formatGrade and formatAudience', () => {
    it('says classes and sections as words, the way parents say them', () => {
        expect(formatGrade(7, 'B', 'Hindi')).toBe('क्लास सेवन बी');
        expect(formatGrade(7, 'B', 'Bengali')).toBe('ক্লাস সেভেন, বি সেকশন');
        expect(formatGrade(7, 'B', 'Nepali')).toBe('क्लास सेभेन, सेक्सन बी');
        expect(formatGrade(7, 'b', 'English')).toBe('Class Seven B');
        expect(formatGrade(12, 'F', 'Nepali')).toBe('क्लास ट्वेल्भ, सेक्सन एफ');
    });

    it('Bengali genitive falls on সেকশন, never a suffix hyphenated onto the letter', () => {
        expect(formatGrade(7, 'B', 'Bengali', { genitive: true })).toBe('ক্লাস সেভেন, বি সেকশনের');
        expect(formatGrade(12, 'F', 'Bengali', { genitive: true })).toBe('ক্লাস টুয়েলভ, এফ সেকশনের');
        // Languages without a genitivePattern use the plain pattern.
        expect(formatGrade(7, 'B', 'Hindi', { genitive: true })).toBe('क्लास सेवन बी');
    });

    it('builds the audience phrase in the case the template needs, naming no child', () => {
        const section = { kind: 'section', grade: 7, section: 'B' } as const;
        expect(formatAudience(section, 'English', 'X')).toBe('the parents of Class Seven B');
        expect(formatAudience(section, 'Hindi', 'X')).toBe('क्लास सेवन बी के पेरेंट्स');
        expect(formatAudience(section, 'Bengali', 'X')).toBe('ক্লাস সেভেন, বি সেকশনের অভিভাবকদের');
        expect(formatAudience(section, 'Nepali', 'X')).toBe('क्लास सेभेन, सेक्सन बी का प्यारेन्टहरू');
        expect(formatAudience({ kind: 'school' }, 'Nepali', 'X')).toBe('सबै प्यारेन्टहरू');
    });

    it('refuses a class or section it cannot say', () => {
        expect(() => formatGrade(13, 'A', 'Hindi')).toThrow(ScriptRenderError);
        expect(() => formatGrade(0, 'A', 'Hindi')).toThrow(ScriptRenderError);
        expect(() => formatGrade(7, 'Z', 'Hindi')).toThrow(ScriptRenderError);
        expect(() => formatGrade(7, 'AB', 'Hindi')).toThrow(ScriptRenderError);
    });
});

describe('formatVenue', () => {
    const venues: SchoolVenue[] = [
        { id: 'library', names: { English: 'the library', Hindi: 'पुस्तकालय', Bengali: 'লাইব্রেরি', Nepali: 'पुस्तकालय' } },
        { id: 'hall', names: { English: 'the hall', Hindi: 'हॉल', Bengali: 'হল', Nepali: 'हल' } },
    ];

    it('uses the defaults with each language’s postposition', () => {
        expect(formatVenue('school_hall', [], 'English')).toBe('in the school hall');
        expect(formatVenue('school_hall', [], 'Hindi')).toBe('स्कूल हॉल में');
        expect(formatVenue('school_hall', [], 'Bengali')).toBe('স্কুলের হলে');
        expect(formatVenue('school_hall', [], 'Nepali')).toBe('स्कुलको हलमा');
        expect(formatVenue('main_ground', [], 'Bengali')).toBe('স্কুলের মাঠে');
    });

    it("prefers the school's own reviewed venue names", () => {
        expect(formatVenue('library', venues, 'Bengali')).toBe('লাইব্রেরিতে');
        expect(formatVenue('hall', venues, 'Bengali')).toBe('হলে');
        expect(formatVenue('library', venues, 'Nepali')).toBe('पुस्तकालयमा');
    });

    it('refuses an unknown venue id', () => {
        expect(() => formatVenue('rooftop', venues, 'Hindi')).toThrow(/Unknown venue/);
    });

    it('Bengali locative: -এ after a consonant, -তে after a vowel', () => {
        expect(locativeOf('মাঠ', 'Bengali')).toBe('মাঠে');
        expect(locativeOf('অডিটোরিয়াম', 'Bengali')).toBe('অডিটোরিয়ামে');
        expect(locativeOf('লাইব্রেরি', 'Bengali')).toBe('লাইব্রেরিতে');
        expect(() => locativeOf('hall', 'English')).toThrow(ScriptRenderError);
    });
});

describe('fillPattern', () => {
    it('throws when a placeholder has no value', () => {
        expect(fillPattern('{a} and {b}', { a: 'x', b: 'y' })).toBe('x and y');
        expect(() => fillPattern('{a} and {b}', { a: 'x' })).toThrow(/\{b\}/);
    });
});
