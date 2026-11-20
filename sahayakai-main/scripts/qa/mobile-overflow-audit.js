/**
 * Mobile overflow audit — paste into the DevTools console of a PHONE-SIZED window
 * (e.g. Chrome device toolbar at 375–394px, or a window.open(..., 'popup,width=390')).
 *
 *   mobileOverflowAudit()        // audits the page open in this window
 *
 * To sweep many pages, open the app in a narrow popup from another tab
 * (const pop = window.open('/', 'phone', 'popup,width=390,height=844')), then for each route set
 * pop.location.href, wait for it to settle, and call mobileOverflowAudit(pop).
 *
 * Reports, per page: whether the page scrolls sideways, and the outermost elements that stick
 * out past the right edge or are CLIPPED by <main> (overflow-x: clip/hidden hides real bugs).
 * Elements inside their own horizontal scroller (overflow-x: auto/scroll), or inside a clipping
 * container that itself fits the screen (carousels), are not reported. Used for the 2026-11-17
 * mobile pass (src/__tests__/components/mobile-overflow-gates.test.tsx gates what it found).
 */
/* eslint-disable */
function mobileOverflowAudit(win = window) {
    const measure = (win) => {
        const d = win.document; const root = d.scrollingElement || d.documentElement; const cw = root.clientWidth;
        const describe = (el) => {
            const c = (typeof el.className === 'string' ? el.className : '').split(/\s+/).filter(Boolean).slice(0, 10).join('.');
            return `${el.tagName.toLowerCase()}${c ? '.' + c : ''} "${(el.innerText || '').trim().replace(/\s+/g, ' ').slice(0, 40)}"`;
        };
        const contained = (el) => {
            for (let p = el.parentElement; p && p !== d.body; p = p.parentElement) {
                const s = win.getComputedStyle(p);
                if (/(auto|scroll)/.test(s.overflowX)) return true;
                if (/(hidden|clip)/.test(s.overflowX) && p.tagName !== 'MAIN' && p.getBoundingClientRect().right <= cw + 2) return true;
            }
            return false;
        };
        const off = [];
        for (const el of d.body.querySelectorAll('*')) {
            const r = el.getBoundingClientRect(); if (!r.width || !r.height) continue;
            const s = win.getComputedStyle(el);
            if (s.visibility === 'hidden' || s.display === 'none' || s.opacity === '0') continue;
            if (s.position === 'fixed' && (r.left < -1 || r.right > cw + 400)) continue;
            if (r.right > cw + 2 && r.left < cw && !contained(el)) off.push({ el, over: Math.round(r.right - cw) });
        }
        const outer = off.filter((o) => !off.some((p) => p !== o && p.el.contains(o.el))).sort((a, b) => b.over - a.over);
        return {
            page: win.location.pathname,
            width: cw,
            scrollsSideways: Math.max(root.scrollWidth, d.body.scrollWidth) - cw,
            offenders: outer.slice(0, 6).map((o) => `+${o.over}px ${describe(o.el)}`),
        };
    };
    return measure(win);
}
if (typeof window !== 'undefined') window.mobileOverflowAudit = mobileOverflowAudit;
