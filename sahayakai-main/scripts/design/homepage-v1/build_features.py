import re, sys, json, os

"""Regenerate /features cards and features.css from docs/design/homepage-v1/Features.dc.html.
See docs/HOMEPAGE_V1.md. Output is unformatted: run prettier on the card files afterwards,
and note that hand edits made since (palette names, a11y) are recorded in docs/HOMEPAGE_V1.md."""
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import dc2jsx
from css2scoped import scope

APP = os.path.abspath(os.path.join(HERE, '..', '..', '..'))
SRC = open(os.path.join(APP, 'docs/design/homepage-v1/Features.dc.html'), encoding='utf-8').read()
OUT = APP + '/src/components/landing/features'
os.makedirs(OUT, exist_ok=True)

body = SRC[SRC.index('</helmet>') + 9:SRC.index('</x-dc>')]
p = dc2jsx.P(); p.feed(body)
top = [k for k in p.root.kids if not isinstance(k, str)][0]
kids = [k for k in top.kids if not isinstance(k, str)]

FONTS = [(r"'Tiro Bangla', Georgia, serif", 'var(--font-hp-display), Georgia, serif'),
         (r"'Hind Siliguri', 'Noto Sans', sans-serif", 'var(--font-hp-body), sans-serif'),
         (r"'Hind Siliguri',sans-serif", 'var(--font-hp-body),sans-serif'),
         (r"'Kalam',cursive", 'var(--font-hp-hand),cursive'),
         (r"'Bricolage Grotesque',sans-serif", 'var(--font-display),sans-serif')]

def post(j):
    for a, b in FONTS: j = j.replace(a, b)
    j = j.replace('AI mentor', 'AI Mentor')
    j = j.replace('src="/_blob/6e77bc9d5b8c265086fa3737da51d152"', 'src="/icons/mark.png"')
    j = j.replace('href="Main.dc.html#demo"', 'href={demoHref()} target="_blank" rel="noopener noreferrer"')
    j = j.replace('href="Main.dc.html"', 'href="/"').replace('href="Features.dc.html"', 'href="/features"')
    # switch state holes
    j = re.sub(r'\$\{HOLE\.k(\d+)\.s(\d)\}', r'${on(\1, \2)}', j)
    j = re.sub(r'aria-pressed=\{`\$\{HOLE\.k(\d+)\.a(\d)\}`\}', r'aria-pressed={sel[\1] === \2}', j)
    j = re.sub(r'onClick=\{`\$\{HOLE\.k(\d+)\.p(\d)\}`\}', r'onClick={() => pick(\1, \2)}', j)
    j = re.sub(r'onclick=\{`\$\{HOLE\.k(\d+)\.p(\d)\}`\}', r'onClick={() => pick(\1, \2)}', j)
    return j

SVG_COLOUR_ATTRS = ('fill', 'stroke', 'stop-color')
SVG_TAGS = {'lineargradient': 'linearGradient', 'radialgradient': 'radialGradient', 'clippath': 'clipPath',
            'foreignobject': 'foreignObject', 'textpath': 'textPath'}

def prep(n):
    """Move hex colours out of SVG presentation attributes into style (var() is not
    resolved in presentation attributes), fix lower-cased SVG tag names, and drop
    duplicate declarations in a style string (last one wins, as in CSS)."""
    if isinstance(n, str):
        return
    n.tag = SVG_TAGS.get(n.tag, n.tag)
    attrs = []
    extra = []
    for k, v in n.attrs:
        if k in SVG_COLOUR_ATTRS and v and re.search(r'#[0-9a-fA-F]{3,6}\b', v):
            extra.append('%s: %s' % (k, v))
        else:
            attrs.append((k, v))
    if extra:
        st = [i for i, (k, v) in enumerate(attrs) if k == 'style']
        if st:
            i = st[0]; attrs[i] = ('style', '; '.join(extra) + '; ' + (attrs[i][1] or ''))
        else:
            attrs.append(('style', '; '.join(extra)))
    out = []
    for k, v in attrs:
        if k == 'style' and v:
            decl = {}
            for d in re.split(r';(?![^(]*\))', v):
                if ':' in d:
                    a, b = d.split(':', 1); decl[a.strip()] = b.strip()
            v = '; '.join('%s: %s' % kv for kv in decl.items())
        out.append((k, v))
    n.attrs = out
    for c in n.kids:
        prep(c)

def conv(n):
    prep(n)
    return post(dc2jsx.render(n))

# Find knob spans: converter drops the hole part of style; replace knob span by indexed one.
def fix_knobs(j):
    idx = [0]
    def rep(m):
        # next card index is found from the following aria-pressed
        rest = j[m.end():m.end() + 400]
        k = re.search(r'sel\[(\d+)\]', rest).group(1)
        return '<span className="knob" style={knob(%s)} />' % k
    return re.sub(r'<span className="knob"[^>]*?(?:/>|></span>)', rep, j)


glows = [k for k in kids if k.tag == 'span']
sections = [k for k in kids if k.tag == 'section']
hero, core, tools, closing = sections

def grid_of(sec):
    g = [k for k in sec.kids if not isinstance(k, str) and dict(k.attrs).get('class') == 'grid2'][0]
    return g, [k for k in g.kids if not isinstance(k, str)]

def shell(sec, placeholder):
    g, _ = grid_of(sec)
    keep = g.kids
    g.kids = ['@@' + placeholder + '@@']
    out = conv(sec)
    g.kids = keep
    return out.replace("{t(\"@@%s@@\")}" % placeholder, '{%s}' % placeholder)

_, core_cards = grid_of(core)
_, tool_cards = grid_of(tools)
render_cards = lambda cards: fix_knobs(''.join(conv(c) for c in cards))
core_jsx = render_cards(core_cards)
tools_a = render_cards(tool_cards[:4])
tools_b = render_cards(tool_cards[4:])
core_shell = shell(core, 'children')
tools_shell = shell(tools, 'children')
glow_jsx = ''.join(conv(g) for g in glows)
hero_jsx = conv(hero)
closing_jsx = conv(closing)
allj = hero_jsx + core_jsx + tools_a + tools_b + closing_jsx + glow_jsx + core_shell + tools_shell
print('remaining holes:', set(re.findall(r'HOLE\.[\w.]+', allj)))

css = re.search(r'<style>(.*?)</style>', SRC, re.S).group(1)
for a, b in FONTS: css = css.replace(a, b)
scss = scope(css, '.hpf', 'hpf-')
root_rules = ('.hpf{position:relative;overflow:hidden;font-family:var(--font-hp-body),sans-serif;'
              'color:var(--hp-171310);background:var(--hp-fbf8f3);font-size:17px;line-height:1.6;'
              '--display:var(--font-hp-display),Georgia,serif;--dw:400;--dt:-0.015em}')
palette = dc2jsx.palette_css('  ')
open(OUT + '/features.css', 'w').write(
    '/* /features: founder-approved v1 design (2026-11-27), generated from the Claude Design source.\n'
    '   Colours live here as page-scoped variables so no .tsx file carries a raw hex (Gate 11). */\n'
    '.hpf {\n' + palette + '\n}\n' + root_rules + '\n' + scss + '\n')

HEAD = """"use client";

/* Generated from the founder-approved Claude Design source (Features.dc.html, 2026-11-27).
   Markup only; the switch state lives in features-page.tsx. */
import { useLanguage } from "@/context/language-context";
import { type CompareProps, useCompareView } from "./features-compare";
"""
def cards_file(name, comp, doc, jsx):
    open(OUT + '/' + name, 'w').write(HEAD + """
/** %s */
export function %s({ sel, pick }: CompareProps) {
  const { t } = useLanguage();
  const { on, knob } = useCompareView(sel);
  return (
    <>
%s
    </>
  );
}
""" % (doc, comp, jsx))
cards_file('features-core.tsx', 'CoreCards', 'The four core capabilities: parent calls, VIDYA, exam papers and the AI mentor.', core_jsx)
cards_file('features-tools-a.tsx', 'ToolCardsA', 'Lesson plan, quiz, virtual field trip and assessment scanner.', tools_a)
cards_file('features-tools-b.tsx', 'ToolCardsB', 'Messaging, library, teachers’ community and Video Storyteller.', tools_b)
json.dump({'hero': hero_jsx, 'closing': closing_jsx, 'glow': glow_jsx, 'core_shell': core_shell, 'tools_shell': tools_shell},
          open(os.path.join(HERE, 'parts.json'), 'w'), ensure_ascii=False, indent=0)
