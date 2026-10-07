/**
 * @jest-environment node
 *
 * The call-control XML builders. Asserted attribute by attribute rather than
 * snapshotted: a snapshot would record the loss of `finishOnKey="none"` (which
 * turns '#' into "submit") or of the no-input fallthrough as the new truth.
 */

import { EMPTY_HANGUP_XML, noticeAnswerXml, optOutConfirmXml, playThenHangupXml } from '@/lib/sampark/voice/xml';

const PROLOG = '<?xml version="1.0" encoding="UTF-8"?>';
const MESSAGE = 'https://sampark.example.test/api/webhooks/sampark-voice/clip/org~key1.123.sig.wav';
const NO_INPUT = 'https://sampark.example.test/api/webhooks/sampark-voice/clip/org~key2.123.sig.wav';
const GATHER = 'https://sampark.example.test/api/webhooks/sampark-voice/gather?t=org~call.123.sig';

describe('EMPTY_HANGUP_XML', () => {
    it('is a complete document that only hangs up', () => {
        expect(EMPTY_HANGUP_XML).toBe(`${PROLOG}<Response><Hangup/></Response>`);
    });
});

describe('noticeAnswerXml', () => {
    const xml = noticeAnswerXml({ messageAudioUrl: MESSAGE, gatherUrl: GATHER, noInputAudioUrl: NO_INPUT, timeoutSeconds: 8 });

    it('starts with the XML prolog and is one Response', () => {
        expect(xml.startsWith(`${PROLOG}<Response>`)).toBe(true);
        expect(xml.endsWith('</Response>')).toBe(true);
    });

    it('takes exactly one DTMF key, posted to the gather URL, with # as an ordinary key', () => {
        expect(xml).toContain(`<Gather action="${GATHER}" method="POST" inputType="dtmf" numDigits="1" executionTimeout="8" finishOnKey="none">`);
    });

    it('plays the message INSIDE the gather, then the no-input goodbye, then hangs up', () => {
        expect(xml).toBe(
            `${PROLOG}<Response>` +
                `<Gather action="${GATHER}" method="POST" inputType="dtmf" numDigits="1" executionTimeout="8" finishOnKey="none">` +
                `<Play>${MESSAGE}</Play></Gather><Play>${NO_INPUT}</Play><Wait length="1"/><Hangup/></Response>`,
        );
    });

    it('clamps the timeout into the 5–60 s Vobiz accepts', () => {
        expect(noticeAnswerXml({ messageAudioUrl: MESSAGE, gatherUrl: GATHER, noInputAudioUrl: NO_INPUT, timeoutSeconds: 1 })).toContain('executionTimeout="5"');
        expect(noticeAnswerXml({ messageAudioUrl: MESSAGE, gatherUrl: GATHER, noInputAudioUrl: NO_INPUT, timeoutSeconds: 600 })).toContain('executionTimeout="60"');
        expect(noticeAnswerXml({ messageAudioUrl: MESSAGE, gatherUrl: GATHER, noInputAudioUrl: NO_INPUT, timeoutSeconds: Number.NaN })).toContain('executionTimeout="5"');
    });
});

describe('escaping — no interpolated value can break out of its element or attribute', () => {
    const hostile = 'https://x.test/a?t=1&kind=hangup"><Hangup/><Play>evil</Play><x a=\'';

    it('escapes & < > " \' in attribute and text positions alike', () => {
        const xml = noticeAnswerXml({ messageAudioUrl: hostile, gatherUrl: hostile, noInputAudioUrl: hostile, timeoutSeconds: 8 });
        expect(xml).not.toContain('<Play>evil</Play>');
        expect(xml).not.toContain('"><Hangup/>');
        expect(xml).toContain('&amp;kind=hangup&quot;&gt;&lt;Hangup/&gt;');
        expect(xml).toContain('&apos;');
        // Exactly the structure we built: one Gather, two Plays, one Hangup.
        expect(xml.match(/<Gather /g)).toHaveLength(1);
        expect(xml.match(/<Play>/g)).toHaveLength(2);
        expect(xml.match(/<Hangup\/>/g)).toHaveLength(1);
    });

    it('escapes the & between query parameters so the document parses', () => {
        const xml = playThenHangupXml('https://x.test/audio.wav?t=a&b=c');
        expect(xml).toContain('<Play>https://x.test/audio.wav?t=a&amp;b=c</Play>');
        expect(xml).not.toMatch(/&(?!amp;|lt;|gt;|quot;|apos;)/);
    });
});

describe('playThenHangupXml', () => {
    it('plays one clip and hangs up', () => {
        expect(playThenHangupXml(MESSAGE)).toBe(`${PROLOG}<Response><Play>${MESSAGE}</Play><Wait length="1"/><Hangup/></Response>`);
    });
});

describe('optOutConfirmXml', () => {
    const xml = optOutConfirmXml({ promptAudioUrl: MESSAGE, gatherUrl: GATHER, doneAudioUrl: NO_INPUT, timeoutSeconds: 8 });

    it('asks for a second 9 inside a one-key gather', () => {
        expect(xml).toContain(`<Gather action="${GATHER}" method="POST" inputType="dtmf" numDigits="1" executionTimeout="8" finishOnKey="none"><Play>${MESSAGE}</Play></Gather>`);
    });

    it('with no second key still plays opt_out_done (the opt-out stands, plan §5.1), then hangs up', () => {
        expect(xml.endsWith(`</Gather><Play>${NO_INPUT}</Play><Wait length="1"/><Hangup/></Response>`)).toBe(true);
    });
});
