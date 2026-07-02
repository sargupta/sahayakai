// Shared base-URL resolver for forensic repro probes.
//
// These probes call live AI/TTS endpoints, which bill Gemini against the
// project. The June-5 spike was amplified by repro scripts pointed at the
// production deployment. This resolver refuses to target the production
// service (`hotfix-resilience`) unless QA_ALLOW_PROD=1 is set explicitly,
// so a probe can never bill prod by accident.
//
// Precedence: explicit arg > QA_BASE_URL > SAHAYAK_BASE > BASE > HOST > fallback.
const PROD_HOST_MARKER = 'hotfix-resilience';

export function resolveBase(fallback = 'http://localhost:3000') {
    const base =
        process.env.QA_BASE_URL ||
        process.env.SAHAYAK_BASE ||
        process.env.BASE ||
        process.env.HOST ||
        fallback;

    if (base.includes(PROD_HOST_MARKER) && process.env.QA_ALLOW_PROD !== '1') {
        console.error(
            `[qa] REFUSING to run against the production deployment (${base}).\n` +
            `[qa] These probes bill Gemini/TTS against prod. Point at localhost or the\n` +
            `[qa] preview service, or set QA_ALLOW_PROD=1 to override deliberately.`,
        );
        process.exit(3);
    }
    return base;
}
