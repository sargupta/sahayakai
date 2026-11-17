/**
 * When a chat should jump to the newest message: only when the reader is already at (or near)
 * the bottom, or when they sent the message themselves. Someone scrolled up to read history is
 * never moved. Pure, so the rule is unit-tested; the caller decides WHEN to ask (once per added
 * message — not on every render).
 */
export function shouldAutoScroll({ nearBottom, lastIsMine }: { nearBottom: boolean; lastIsMine: boolean }): boolean {
    return nearBottom || lastIsMine;
}
