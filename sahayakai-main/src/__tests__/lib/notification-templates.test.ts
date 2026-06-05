/**
 * Lane A13: every notification type must render in every supported language.
 * Locks in the fact that Hindi/Tamil/Bengali teachers no longer see English
 * copy in their bell dropdown.
 */

import {
    renderNotification,
    NOTIFICATION_TEMPLATES,
    NOTIFICATION_LANGUAGES,
    DEFAULT_NOTIFICATION_LANGUAGE,
} from '@/lib/notifications/templates';

describe('notification templates i18n', () => {
    it('has translations for every supported language for every template key', () => {
        const keys = Object.keys(NOTIFICATION_TEMPLATES) as Array<keyof typeof NOTIFICATION_TEMPLATES>;
        for (const key of keys) {
            for (const lang of NOTIFICATION_LANGUAGES) {
                const pair = NOTIFICATION_TEMPLATES[key][lang];
                expect(pair).toBeDefined();
                expect(typeof pair.title).toBe('string');
                expect(typeof pair.message).toBe('string');
                expect(pair.title.length).toBeGreaterThan(0);
                expect(pair.message.length).toBeGreaterThan(0);
            }
        }
    });

    it('renders FOLLOW in Hindi with sender substituted', () => {
        const { title, message } = renderNotification('FOLLOW', 'Hindi', { senderName: 'Priya' });
        expect(title).toBe('नया फ़ॉलोअर');
        expect(message).toContain('Priya');
        // Sanity: not the English template
        expect(message).not.toContain('started following');
    });

    it('renders LIKE in Tamil with sender + resource title substituted', () => {
        const { title, message } = renderNotification('LIKE', 'Tamil', {
            senderName: 'Karthik',
            resourceTitle: 'Class 5 Fractions',
        });
        expect(title).toBe('உங்கள் வளத்தை ஒருவர் விரும்பினார்');
        expect(message).toContain('Karthik');
        expect(message).toContain('Class 5 Fractions');
        expect(message).not.toContain('liked your');
    });

    it('renders RESOURCE_SAVED in Bengali with both placeholders', () => {
        const { title, message } = renderNotification('RESOURCE_SAVED', 'Bengali', {
            senderName: 'Rahul',
            resourceTitle: 'Photosynthesis Lesson',
        });
        expect(title).toBe('রিসোর্স সংরক্ষিত');
        expect(message).toContain('Rahul');
        expect(message).toContain('Photosynthesis Lesson');
    });

    it('renders CONNECT_REQUEST in Marathi', () => {
        const { title, message } = renderNotification('CONNECT_REQUEST', 'Marathi', { senderName: 'Sneha' });
        expect(title).toBe('नवीन कनेक्शन विनंती');
        expect(message).toContain('Sneha');
    });

    it('renders CONNECT_ACCEPTED in Kannada', () => {
        const { title, message } = renderNotification('CONNECT_ACCEPTED', 'Kannada', { senderName: 'Ravi' });
        expect(title).toBe('ಸಂಪರ್ಕ ಸ್ವೀಕರಿಸಲಾಗಿದೆ');
        expect(message).toContain('Ravi');
    });

    it('renders MESSAGE virtual key with sender + preview', () => {
        const { title, message } = renderNotification('MESSAGE', 'Gujarati', {
            senderName: 'Anil',
            preview: 'Hello, how are you?',
        });
        expect(title).toContain('Anil');
        expect(message).toBe('Hello, how are you?');
    });

    it('falls back to English when language is unknown', () => {
        const { title, message } = renderNotification('FOLLOW', 'Klingon' as any, { senderName: 'Worf' });
        expect(title).toBe('New Follower');
        expect(message).toBe('Worf started following you');
    });

    it('falls back to English when language is undefined', () => {
        const { title } = renderNotification('FOLLOW', undefined, { senderName: 'A' });
        expect(title).toBe(NOTIFICATION_TEMPLATES.FOLLOW[DEFAULT_NOTIFICATION_LANGUAGE].title);
    });

    it('leaves unknown placeholders intact (loud failure mode)', () => {
        // Render with a missing placeholder — the {resourceTitle} token should
        // remain in the output rather than collapsing to '' so QA spots it.
        const { message } = renderNotification('LIKE', 'English', {
            senderName: 'X',
            // resourceTitle intentionally omitted
        } as any);
        expect(message).toContain('{resourceTitle}');
    });

    it('LIKE templates in every language contain both placeholders', () => {
        for (const lang of NOTIFICATION_LANGUAGES) {
            const tmpl = NOTIFICATION_TEMPLATES.LIKE[lang];
            expect(tmpl.message).toContain('{senderName}');
            expect(tmpl.message).toContain('{resourceTitle}');
        }
    });

    it('RESOURCE_SAVED templates in every language contain both placeholders', () => {
        for (const lang of NOTIFICATION_LANGUAGES) {
            const tmpl = NOTIFICATION_TEMPLATES.RESOURCE_SAVED[lang];
            expect(tmpl.message).toContain('{senderName}');
            expect(tmpl.message).toContain('{resourceTitle}');
        }
    });

    it('SYSTEM is a pass-through escape hatch', () => {
        const { title, message } = renderNotification('SYSTEM', 'Hindi', {
            title: 'Custom Title',
            message: 'Custom Message',
        });
        expect(title).toBe('Custom Title');
        expect(message).toBe('Custom Message');
    });
});
