/**
 * Unit tests for detectLangCode and stripMarkdown from src/lib/tts.ts
 */
import { detectLangCode, stripMarkdown } from '@/lib/tts';

describe('detectLangCode', () => {
    it('detects Hindi (Devanagari)', () => {
        expect(detectLangCode('नमस्ते दुनिया')).toBe('hi-IN');
    });

    it('detects Bengali', () => {
        expect(detectLangCode('হ্যালো বিশ্ব')).toBe('bn-IN');
    });

    it('detects Tamil', () => {
        expect(detectLangCode('வணக்கம் உலகம்')).toBe('ta-IN');
    });

    it('detects Telugu', () => {
        expect(detectLangCode('హలో ప్రపంచం')).toBe('te-IN');
    });

    it('detects Kannada', () => {
        expect(detectLangCode('ಹಲೋ ಪ್ರಪಂಚ')).toBe('kn-IN');
    });

    it('detects Malayalam', () => {
        expect(detectLangCode('ഹലോ ലോകം')).toBe('ml-IN');
    });

    it('detects Gujarati', () => {
        expect(detectLangCode('હેલો વિશ્વ')).toBe('gu-IN');
    });

    it('detects Punjabi (Gurmukhi)', () => {
        expect(detectLangCode('ਹੈਲੋ ਦੁਨੀਆ')).toBe('pa-IN');
    });

    it('defaults to English for ASCII text', () => {
        expect(detectLangCode('Hello world')).toBe('en-IN');
    });

    it('defaults to English for empty string', () => {
        expect(detectLangCode('')).toBe('en-IN');
    });

    it('detects first matching script in mixed text', () => {
        expect(detectLangCode('Hello नमस्ते')).toBe('hi-IN');
    });
});

describe('stripMarkdown', () => {
    it('removes heading markers', () => {
        expect(stripMarkdown('## Hello World')).toBe('Hello World');
    });

    it('removes bold markers', () => {
        expect(stripMarkdown('This is **bold** text')).toBe('This is bold text');
    });

    it('removes italic markers', () => {
        expect(stripMarkdown('This is *italic* text')).toBe('This is italic text');
    });

    it('converts links to text only', () => {
        expect(stripMarkdown('Click [here](https://example.com) now')).toBe('Click here now');
    });

    it('removes unordered list markers', () => {
        expect(stripMarkdown('- Item one\n- Item two')).toBe('Item one\nItem two');
    });

    it('removes ordered list markers', () => {
        expect(stripMarkdown('1. First\n2. Second')).toBe('First\nSecond');
    });

    it('removes fenced code blocks', () => {
        expect(stripMarkdown('Before\n```\ncode here\n```\nAfter')).toBe('Before\n\nAfter');
    });

    it('removes inline code', () => {
        expect(stripMarkdown('Use `console.log` for debugging')).toBe('Use  for debugging');
    });

    it('removes blockquote markers', () => {
        expect(stripMarkdown('> This is a quote')).toBe('This is a quote');
    });

    it('preserves plain text', () => {
        expect(stripMarkdown('Just normal text here')).toBe('Just normal text here');
    });
});
