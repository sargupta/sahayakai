/**
 * The two attributes below are the difference between a working call and a call
 * that drops a second after the parent says hello, so they are asserted
 * explicitly rather than snapshotted — a snapshot would happily record their
 * removal as the new truth.
 */
import {
    buildVobizAnswerXml,
    escapeXml,
    toWebSocketOrigin,
    VOBIZ_CONTENT_TYPES,
} from '@/lib/vobiz/answer-xml';

describe('answer XML', () => {
    const xml = buildVobizAnswerXml({ streamUrl: 'wss://sidecar/telephony/vobiz/stream?t=A&cuid=C' });

    it('keeps the call alive so the leg survives the media stream', () => {
        // Without keepCallAlive Vobiz hangs up ~1s after handing off the verb.
        expect(xml).toContain('keepCallAlive="true"');
    });

    it('opens the stream bidirectionally so VIDYA can actually speak', () => {
        expect(xml).toContain('bidirectional="true"');
    });

    it('declares the known-working inbound wire format by default', () => {
        expect(xml).toContain(`contentType="${VOBIZ_CONTENT_TYPES.mulaw8k}"`);
    });

    it('escapes the query separators so the document parses', () => {
        // A raw & in element text makes the XML invalid and the call dies with
        // no useful provider-side error.
        expect(xml).toContain('t=A&amp;cuid=C');
        expect(xml).not.toMatch(/[^&]&[^a]/);
    });

    it('can request the higher-fidelity inbound format when explicitly asked', () => {
        const l16 = buildVobizAnswerXml({ streamUrl: 'wss://x', inboundFormat: 'l16_16k' });
        expect(l16).toContain(`contentType="${VOBIZ_CONTENT_TYPES.l16_16k}"`);
    });
});

describe('escapeXml', () => {
    it('escapes all five metacharacters', () => {
        expect(escapeXml(`&<>"'`)).toBe('&amp;&lt;&gt;&quot;&apos;');
    });

    it('escapes ampersands before the entities it introduces', () => {
        expect(escapeXml('a & <b>')).toBe('a &amp; &lt;b&gt;');
    });
});

describe('websocket origin', () => {
    it('converts the sidecar https origin to wss', () => {
        expect(toWebSocketOrigin('https://sahayakai-agents-x.a.run.app/')).toBe('wss://sahayakai-agents-x.a.run.app');
    });

    it('supports a local http sidecar for development', () => {
        expect(toWebSocketOrigin('http://localhost:8080')).toBe('ws://localhost:8080');
    });

    it('returns null for anything that is not http(s), instead of emitting a dead stream URL', () => {
        expect(toWebSocketOrigin('sahayakai-agents.a.run.app')).toBeNull();
        expect(toWebSocketOrigin('')).toBeNull();
    });
});
