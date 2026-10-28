/**
 * "Talk to VIDYA" from app chrome (sidebar, rail).
 *
 * VIDYA's voice entry points mark themselves with `data-vidya-entry`: the
 * floating orb on tool pages, the workspace microphone on Home. This presses
 * the first one on the page — the same control the teacher would tap — so
 * the existing microphone flow, permissions prompt and confirm rules are
 * unchanged. Called from a click handler, so the browser still treats the
 * microphone request as a user gesture.
 *
 * Returns false when the page has no entry point (the caller then takes the
 * teacher Home, where VIDYA's workspace lives).
 */
export function pressVidyaEntry(): boolean {
    if (typeof document === "undefined") return false;
    const button = document.querySelector<HTMLButtonElement>('[data-vidya-entry] [data-microphone="true"]');
    if (!button || button.disabled) return false;
    button.click();
    return true;
}
