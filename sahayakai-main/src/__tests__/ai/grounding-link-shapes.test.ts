/**
 * Class gate for the citation guard's two blind spots, found 2026-08-25.
 *
 * WHAT THIS PROTECTS
 * Instant Answer has no web search — the tool that used to "ground" it returned
 * a hardcoded fixture of example.com links. stripSourceLinks is therefore the
 * last thing standing between a model-invented citation and a teacher, and it
 * has to satisfy two guarantees that pull against each other:
 *
 *   1. Nothing react-markdown would render as a link may survive.
 *   2. An answer with no links must come back byte-for-byte unchanged.
 *
 * Two shapes broke guarantee 1 and 2 respectively.
 *
 * PARENS (broke 1). The destination matcher ended in `[^()]*`, which cannot
 * cross a "(". CommonMark allows balanced parens in a destination, so the most
 * common citation shape in school answers — a Wikipedia disambiguation URL like
 * en.wikipedia.org/wiki/Mercury_(planet) — passed through untouched and
 * rendered a live anchor, while containsUrl() reported false. The guard and its
 * own oracle agreed with each other and were both wrong.
 *
 * REFERENCE DEFINITIONS (broke 2). The definition matcher ended in `.*$`, so it
 * ate the whole line. A line whose trailing prose makes it an INVALID
 * definition — "[JPEG]: image.jpg is the usual extension for photographs." —
 * renders as ordinary paragraph text, draws no anchor either way, and was being
 * deleted outright. Pure content loss for no safety gain, and a glossary-style
 * answer about file formats produces it naturally.
 *
 * WHAT THIS GATE CATCHES
 * Not those two strings. The class is: any link shape CommonMark renders must
 * be stripped, and any line it does not render as a link must survive intact.
 * A future tightening that reopens either side fails here.
 *
 * DELIBERATE, DOCUMENTED TRADE-OFF
 * `arr[i](x)`, `Ca[OH](aq)`, `[v](m/s)` and `[x](1.5)` DO render as anchors
 * under react-markdown, and this guard leaves them alone: their targets are
 * bare words with no dot and no slash, so they are textually indistinguishable
 * from index expressions and chemical formulae. The round-trip guarantee wins
 * there, on the reasoning that a link to "aq" points at nothing and cannot
 * masquerade as a citation to a real source. That is a choice, not an
 * oversight, and the tests below pin it so it stays a choice.
 */

import { stripSourceLinks, containsUrl } from '@/ai/grounding';

describe('stripSourceLinks — link shapes that must not survive', () => {
    // The paren case: a regex that cannot cross "(" let these straight through.
    const parenCitations = [
        '[Mercury](en.wikipedia.org/wiki/Mercury_(planet))',
        '[Photosynthesis](https://en.wikipedia.org/wiki/Photosynthesis_(biology))',
        '[Mughal Empire](en.wikipedia.org/wiki/Akbar_(emperor))',
        '[Force](ncert.nic.in/textbook/chapter_9_(motion).pdf)',
    ];

    it.each(parenCitations)('strips a balanced-paren destination: %s', (md) => {
        const out = stripSourceLinks(`See ${md} for more.`);
        expect(out).not.toMatch(/\]\(/);
        expect(out).not.toMatch(/wikipedia|ncert\.nic\.in/);
    });

    it('leaves no paren destination that the oracle then calls clean', () => {
        // The guard and containsUrl() must agree. Previously both said "no URL
        // here" about a string that rendered a live anchor.
        for (const md of parenCitations) {
            expect(containsUrl(stripSourceLinks(`See ${md} for more.`))).toBe(false);
        }
    });

    it.each([
        '[NCERT](ncert.nic.in/textbook/pdf/hesc106.pdf)',
        '[Chapter 6](/textbook/ch6)',
        '[source](//example.com/a)',
        '[this page](example.com/photosynthesis)',
    ])('still strips the scheme-less shapes: %s', (md) => {
        expect(stripSourceLinks(`Read ${md} today.`)).not.toMatch(/\]\(/);
    });

    it('still removes a genuine reference definition', () => {
        const out = stripSourceLinks('Plants use sunlight[1].\n\n[1]: ncert.nic.in/ch6');
        expect(out).not.toMatch(/ncert\.nic\.in/);
    });

    it('removes a reference definition that carries a title', () => {
        const out = stripSourceLinks('See [2].\n\n[2]: ncert.nic.in/ch7 "Chapter 7"');
        expect(out).not.toMatch(/ncert\.nic\.in/);
    });
});

describe('stripSourceLinks — prose that must survive untouched', () => {
    // These read like reference definitions but are not: the trailing prose
    // makes them invalid, so CommonMark renders them as plain paragraphs.
    it.each([
        'File types you will meet:\n\n[JPEG]: image.jpg is the usual extension for photographs.',
        '[PDF]: chapter6.pdf is the file the students download.',
        '[Config]: ./setup.sh runs it and then prints the report.',
    ])('does not delete an invalid reference definition line: %s', (md) => {
        expect(stripSourceLinks(md)).toBe(md);
    });

    it('leaves an answer with no links byte-for-byte identical', () => {
        const cases = [
            '```python\nfor i in range(3):\n    if i % 2 == 0:\n        print(i)\n    else:\n        pass\n```',
            '- Sunlight\n  - From the sun',
            '    def f():\n        return 1',
            'Use arr[i](x) to call.',
            'Ca[OH](aq) dissolves.',
            'Area = ( ) is empty',
            'সালোকসংশ্লেষণ:\n\n- সূর্যালোক\n  - সূর্য থেকে আসে',
        ];
        for (const md of cases) {
            expect(stripSourceLinks(md)).toBe(md);
        }
    });
});
