import {
    buildPlacementWebhookPayload,
    PLACEMENT_WORLD_PLIVO_CALLER_ID,
    PLACEMENT_WORLD_TEST_PHONE,
    placePlacementWorldCall,
    renderPlacementScript,
    sendPlacementWebhookResult,
    signPlacementWebhook,
    type PlacementCandidate,
} from '@/lib/sampark/placement-world';

const candidate: PlacementCandidate = {
    candidateId: 'cand-42',
    candidateName: 'Rohit Verma',
    phoneE164: PLACEMENT_WORLD_TEST_PHONE,
    language: 'en',
    feeTerms: 'Rs 500 placement coordination fee',
};

describe('Placement World screening call flow (SP-11)', () => {
    it('keeps opener strictly to Placement World + recorded notice, and keeps fee line at the end', () => {
        for (const lang of ['en', 'hi', 'bn'] as const) {
            const script = renderPlacementScript(lang, 'Rohit Verma', candidate.feeTerms);
            expect(script.opener.toLowerCase()).not.toMatch(/fee|शुल्क|ফি|charge|rupee|rs\b/);
            expect(script.closing).toContain('Rs 500 placement coordination fee');
            expect(script.questions).toHaveLength(4);
            expect(script.edgeCases.wrong_person).toBeTruthy();
            expect(script.edgeCases.call_back_later).toBeTruthy();
            expect(script.edgeCases.refuses).toBeTruthy();
        }
        const en = renderPlacementScript('en', 'Rohit Verma', candidate.feeTerms);
        expect(en.opener).toContain('Placement World');
        expect(en.opener.toLowerCase()).toContain('recorded');
    });

    it('dials through Plivo using configured caller ID and enforces test phone in test mode', async () => {
        let sentBody: Record<string, unknown> | null = null;
        const fakeFetch: typeof fetch = async (_url, init) => {
            sentBody = JSON.parse(String(init?.body ?? '{}')) as Record<string, unknown>;
            return new Response(JSON.stringify({ request_uuid: 'plivo-req-123' }), { status: 201 });
        };

        const blocked = await placePlacementWorldCall({
            plivoConfig: { authId: 'MA123456789012345678', authToken: 'tok', baseUrl: 'https://api.plivo.com/v1' },
            candidate: { ...candidate, phoneE164: '+919999999999' },
            answerUrl: 'https://example.invalid/answer',
            hangupUrl: 'https://example.invalid/hangup',
            testMode: true,
            fetchImpl: fakeFetch,
        });
        expect(blocked).toEqual({ ok: false, failure: { category: 'invalid_destination' } });

        const ok = await placePlacementWorldCall({
            plivoConfig: { authId: 'MA123456789012345678', authToken: 'tok', baseUrl: 'https://api.plivo.com/v1' },
            candidate,
            answerUrl: 'https://example.invalid/answer',
            hangupUrl: 'https://example.invalid/hangup',
            testMode: true,
            fetchImpl: fakeFetch,
        });
        expect(ok).toEqual({ ok: true, requestUuid: 'plivo-req-123' });
        expect(sentBody?.from).toBe('919800000206');
        expect(sentBody?.to).toBe('919800000101');
        expect(PLACEMENT_WORLD_PLIVO_CALLER_ID).toBe('+919800000206');
    });

    it('signs and delivers structured screening results by webhook', async () => {
        const payload = buildPlacementWebhookPayload({
            callId: 'pw-call-1',
            carrierCallId: 'plivo-req-123',
            candidate,
            status: 'completed',
            answers: {
                availableForInterviews: true,
                preferredLocation: 'Bengaluru',
                shiftFlexible: true,
                experienceSummary: '2 years customer support',
                expectedMonthlySalary: '22000',
                noticePeriod: 'Immediate',
            },
            recordingUrl: 'https://example.invalid/pw-1.mp3',
        });

        let capturedSig = '';
        let capturedRaw = '';
        const fakeFetch: typeof fetch = async (_url, init) => {
            const headers = init?.headers as Record<string, string>;
            capturedSig = headers['X-Placement-Signature'] ?? '';
            capturedRaw = String(init?.body ?? '');
            return new Response('ok', { status: 200 });
        };

        const res = await sendPlacementWebhookResult({
            webhookUrl: 'https://example.invalid/pw-webhook',
            signingSecret: 'test-secret-key',
            payload,
            fetchImpl: fakeFetch,
        });
        expect(res).toEqual({ ok: true, status: 200 });
        expect(capturedSig).toBe(`sha256=${signPlacementWebhook('test-secret-key', capturedRaw)}`);
    });
});
