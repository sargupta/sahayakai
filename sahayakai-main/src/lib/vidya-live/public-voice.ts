/**
 * Build-time switch for the PUBLIC (signed-out) VIDYA voice orb on the
 * landing hero.
 *
 * The orb opens a real Gemini Live conversation for anonymous visitors: it
 * asks for the microphone, then POSTs /api/vidya-voice/public-session for a
 * public stream token. That route answers 503 unless the server has
 * VIDYA_VOICE_PUBLIC_ENABLED=true, and the token it mints is only accepted by
 * a sahayakai-agents sidecar that has `verify_public_stream_token` (vidya_voice
 * router). Shipping the orb before both exist means every visitor who taps it
 * grants the mic and then hears "Voice isn't available right now".
 *
 * So the orb is OFF unless NEXT_PUBLIC_VIDYA_VOICE_PUBLIC=1 is baked into the
 * build. Turn it on ONLY after, in this order:
 *   1. the sahayakai-agents sidecar with `verify_public_stream_token` is
 *      deployed to production;
 *   2. cloudbuild.yaml declares VIDYA_VOICE_PUBLIC_ENABLED=true in the
 *      --update-env-vars of BOTH deploy steps (`deploy` = Singapore,
 *      `deploy-mumbai` = Mumbai);
 *   3. the build passes the flag: `ARG NEXT_PUBLIC_VIDYA_VOICE_PUBLIC` in the
 *      Dockerfile and `--build-arg=NEXT_PUBLIC_VIDYA_VOICE_PUBLIC=1` in the
 *      cloudbuild.yaml build step.
 *
 * While it is off, the signed-out home page keeps the turn-based floating mic
 * (GlobalVoiceInterface, see app-shell.tsx), which works without the sidecar.
 *
 * Class gate: src/__tests__/deploy/public-voice-orb-gate.test.tsx fails if the
 * build ships the flag on while either region lacks the server switch.
 *
 * Read at call time (not a module constant) so tests can flip it; Next still
 * inlines `process.env.NEXT_PUBLIC_*` at build time either way.
 */
export const PUBLIC_VOICE_BUILD_FLAG = "NEXT_PUBLIC_VIDYA_VOICE_PUBLIC";

export function isPublicVoiceOrbEnabled(): boolean {
  return process.env.NEXT_PUBLIC_VIDYA_VOICE_PUBLIC === "1";
}
