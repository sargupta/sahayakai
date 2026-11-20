/**
 * Whether the Exotel voicebot is configured (VOICE_PROVIDER=exotel). A configuration read, not a
 * dial: the attendance route's refusal step uses it so an unconfigured provider is refused and
 * released before anything is claimed. The dial itself (forwardToExotel) reads the URL and requires
 * a ContactClearance (gate-every-dial-checks-contact-policy).
 */
export function exotelConfigured(): boolean {
    return Boolean(process.env.VOICE_EXOTEL_CALL_URL);
}
