/**
 * @jest-environment node
 *
 * Transcribe-back normalisation: recognisers write numbers their own way, so
 * both sides are normalised before comparing (plan §4⑥).
 */

import { levenshtein, normaliseForCompare, transcriptSimilarity, VERIFY_THRESHOLD } from '@/lib/sampark/speech/verify';

describe('normaliseForCompare', () => {
    it('"बाह्र हजार पाँच सय" and "१२५००" compare equal (the plan’s example)', () => {
        expect(normaliseForCompare('बाह्र हजार पाँच सय', 'Nepali')).toBe('12500');
        expect(normaliseForCompare('१२५००', 'Nepali')).toBe('12500');
        expect(normaliseForCompare('१२,५००', 'Nepali')).toBe('12500');
        expect(transcriptSimilarity('बाह्र हजार पाँच सय रुपैयाँ', '१२५०० रुपैयाँ', 'Nepali')).toBe(1);
    });

    it('maps cardinal words 0–60 in every language', () => {
        expect(normaliseForCompare('साठ', 'Hindi')).toBe('60');
        expect(normaliseForCompare('उनन्साठी', 'Nepali')).toBe('59');
        expect(normaliseForCompare('পঁয়তাল্লিশ', 'Bengali')).toBe('45');
        expect(normaliseForCompare('twenty-one', 'English')).toBe('21');
        expect(normaliseForCompare('twenty one', 'English')).toBe('21');
        expect(normaliseForCompare('twelve thousand five hundred', 'English')).toBe('12500');
    });

    it('drops suffixes glued to digits and maps date and clock forms', () => {
        expect(normaliseForCompare('দশই অক্টোবর', 'Bengali')).toBe(normaliseForCompare('১০ই অক্টোবর', 'Bengali'));
        expect(normaliseForCompare('সকাল দশটায়', 'Bengali')).toBe(normaliseForCompare('সকাল ১০টায়', 'Bengali'));
        expect(normaliseForCompare('Saturday, 10th October', 'English')).toBe('saturday 10 october');
        expect(normaliseForCompare('ten in the morning', 'English')).toBe('10 in the morning');
    });

    it('keeps separate numbers separate', () => {
        expect(normaliseForCompare('दस अक्टूबर को सुबह दस बजे', 'Hindi')).toBe('10 अक्टूबर को सुबह 10 बजे');
        expect(normaliseForCompare('press 1 press 2', 'English')).toBe('press 1 press 2');
        expect(normaliseForCompare('एक दो', 'Hindi')).toBe('1 2');
    });

    it('folds punctuation, nukta, candrabindu and section letters', () => {
        expect(normaliseForCompare('ज़रूरी। आएँगे॥', 'Hindi')).toBe(normaliseForCompare('जरूरी आएंगे', 'Hindi'));
        expect(normaliseForCompare('कक्षा सात, सेक्शन बी', 'Hindi')).toBe(normaliseForCompare('कक्षा 7 सेक्शन B', 'Hindi'));
        expect(normaliseForCompare('ক্লাস সেভেন, সেকশন বি-র', 'Bengali')).toBe('ক্লাস 7 সেকশন b র');
    });
});

describe('Bengali transcript written in Devanagari (a Chirp 2 script wobble seen on live bn-IN clips)', () => {
    it('is folded into Bengali script before comparing', () => {
        expect(normaliseForCompare('धन्यवाद', 'Bengali')).toBe(normaliseForCompare('ধন্যবাদ', 'Bengali'));
        expect(normaliseForCompare('आपनि आसबेन', 'Bengali')).toBe(normaliseForCompare('আপনি আসবেন', 'Bengali'));
        // A real vowel-length difference (Hindi ू vs Bengali ু) is kept, not papered over.
        expect(normaliseForCompare('स्कूल', 'Bengali')).not.toBe(normaliseForCompare('স্কুল', 'Bengali'));
        expect(normaliseForCompare('पाँच', 'Bengali')).toBe('5');
        expect(normaliseForCompare('পাঁচ', 'Bengali')).toBe('5');
    });

    it('does not fold Hindi or Nepali', () => {
        expect(normaliseForCompare('धन्यवाद', 'Hindi')).toBe('धन्यवाद');
    });
});

describe('similarity', () => {
    it('levenshtein basics', () => {
        expect(levenshtein([...'kitten'], [...'sitting'])).toBe(3);
        expect(levenshtein([], [...'abc'])).toBe(3);
        expect(levenshtein([...'abc'], [...'abc'])).toBe(0);
    });

    it('identical after normalisation is 1; spacing differences do not count', () => {
        expect(transcriptSimilarity('हिलभ्यू डेमो स्कूल', 'हिल भ्यू डेमो स्कूल', 'Nepali')).toBe(1);
        expect(transcriptSimilarity('', '', 'Hindi')).toBe(1);
    });

    it('a realistic transcript passes; a different message fails', () => {
        const expected =
            'नमस्ते, यो हिलभ्यू डेमो स्कूलबाट कक्षा सात, सेक्सन बी का अभिभावकहरूका लागि रेकर्ड गरिएको सूचना हो। प्यारेन्ट-टिचर मिटिङ शनिबार, दस अक्टोबर, बिहान दस बजे स्कूलको हलमा हुन्छ।';
        const heard =
            'नमस्ते यो हिलभ्यू डेमो स्कूलबाट कक्षा 7 सेक्सन बी का अभिभावकहरूका लागि रेकर्ड गरिएको सूचना हो प्यारेन्ट टिचर मिटिङ शनिबार 10 अक्टोबर बिहान 10 बजे स्कूलको हलमा हुन्छ';
        expect(transcriptSimilarity(expected, heard, 'Nepali')).toBeGreaterThanOrEqual(0.95);
        const wrongDate = heard.replace('शनिबार 10 अक्टोबर', 'आइतबार 17 नोभेम्बर');
        expect(transcriptSimilarity(expected, wrongDate, 'Nepali')).toBeLessThan(1);
        expect(transcriptSimilarity(expected, 'यो अर्को कुरा हो', 'Nepali')).toBeLessThan(VERIFY_THRESHOLD);
        expect(transcriptSimilarity(expected, '', 'Nepali')).toBe(0);
    });
});
