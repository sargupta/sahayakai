"""Convert a Claude Design .dc.html fragment into JSX for the SahayakAI app.

- class -> className, style strings -> style objects, SVG attributes camel-cased
- every hex colour -> var(--hp-<name>) (palette emitted separately as CSS)
- visible text with letters -> {t("...")}; numbers and symbols stay literal
- {{hole}} -> {HOLE.hole} marker so dynamic spots are easy to find and wire by hand
"""
import html, json, re
from html.parser import HTMLParser

VOID = {'img', 'br', 'input', 'hr', 'meta', 'link', 'source'}
SVG_LEAF = {'path', 'circle', 'rect', 'line', 'polyline', 'polygon', 'ellipse', 'stop', 'use'}
ATTR = {'class': 'className', 'for': 'htmlFor', 'tabindex': 'tabIndex', 'viewbox': 'viewBox',
        'stroke-width': 'strokeWidth', 'stroke-linecap': 'strokeLinecap', 'stroke-linejoin': 'strokeLinejoin',
        'stroke-dasharray': 'strokeDasharray', 'stroke-dashoffset': 'strokeDashoffset', 'stroke-opacity': 'strokeOpacity',
        'fill-rule': 'fillRule', 'clip-rule': 'clipRule', 'fill-opacity': 'fillOpacity', 'stop-color': 'stopColor',
        'stop-opacity': 'stopOpacity', 'font-size': 'fontSize', 'font-weight': 'fontWeight', 'text-anchor': 'textAnchor',
        'gradientunits': 'gradientUnits', 'gradienttransform': 'gradientTransform', 'preserveaspectratio': 'preserveAspectRatio',
        'readonly': 'readOnly', 'maxlength': 'maxLength', 'inputmode': 'inputMode', 'autocomplete': 'autoComplete',
        'srcset': 'srcSet', 'crossorigin': 'crossOrigin', 'allowfullscreen': 'allowFullScreen', 'frameborder': 'frameBorder'}

PALETTE = {}  # hex -> var name


def colour_name(h):
    h = h.lower()
    if len(h) == 4:
        h = '#' + ''.join(c * 2 for c in h[1:])
    if h not in PALETTE:
        PALETTE[h] = '--hp-' + h[1:]
    return PALETTE[h]


def recolour(v):
    return re.sub(r'#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b', lambda m: 'var(%s)' % colour_name(m.group(0)), v)


def camel(p):
    p = p.strip()
    if p.startswith('--'):
        return json.dumps(p)
    if p.startswith('-webkit-'):
        p = 'Webkit-' + p[8:]
    return re.sub(r'-([a-z])', lambda m: m.group(1).upper(), p)


def hole(s):
    return re.sub(r'\{\{\s*([\w.]+)\s*\}\}', lambda m: '${HOLE.%s}' % m.group(1), s)


def style_obj(s):
    out = []
    # split on ; not inside parentheses
    depth, cur, parts = 0, '', []
    for ch in s:
        if ch == '(':
            depth += 1
        elif ch == ')':
            depth -= 1
        if ch == ';' and depth == 0:
            parts.append(cur); cur = ''
        else:
            cur += ch
    parts.append(cur)
    for d in parts:
        if ':' not in d or not d.strip():
            continue
        k, v = d.split(':', 1)
        k, v = k.strip(), recolour(v.strip())
        if '{{' in v:
            out.append('%s: `%s`' % (camel(k), hole(v)))
        elif re.fullmatch(r'-?\d+(\.\d+)?', v) and k in ('opacity', 'z-index', 'flex-grow', 'flex-shrink', 'line-height', 'font-weight', 'order'):
            out.append('%s: %s' % (camel(k), v))
        else:
            out.append('%s: %s' % (camel(k), json.dumps(v, ensure_ascii=False)))
    return '{{ ' + ', '.join(out) + ' }}'


def text_node(t):
    if not t.strip():
        return ' ' if t and ('\n' not in t) else ''
    lead = ' ' if t[0].isspace() else ''
    trail = ' ' if t[-1].isspace() else ''
    core = re.sub(r'\s+', ' ', t.strip())
    if '{{' in core:
        parts = re.split(r'(\{\{\s*[\w.]+\s*\}\})', core)
        res = ''
        for p in parts:
            m = re.fullmatch(r'\{\{\s*([\w.]+)\s*\}\}', p)
            if m:
                res += '{HOLE.%s}' % m.group(1)
            elif p.strip():
                res += text_node(p)
            else:
                res += p
        return lead + res + trail
    if re.search(r'[A-Za-zऀ-෿]', core):
        return lead + '{t(%s)}' % json.dumps(core, ensure_ascii=False) + trail
    return lead + '{%s}' % json.dumps(core, ensure_ascii=False) + trail


class Node:
    def __init__(self, tag, attrs):
        self.tag, self.attrs, self.kids = tag, attrs, []


class P(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.root = Node('root', [])
        self.stack = [self.root]

    def handle_starttag(self, tag, attrs):
        n = Node(tag, attrs)
        self.stack[-1].kids.append(n)
        if tag not in VOID:
            self.stack.append(n)

    def handle_startendtag(self, tag, attrs):
        self.stack[-1].kids.append(Node(tag, attrs))

    def handle_endtag(self, tag):
        for i in range(len(self.stack) - 1, 0, -1):
            if self.stack[i].tag == tag:
                del self.stack[i:]
                return

    def handle_data(self, d):
        self.stack[-1].kids.append(d)


def attr_js(k, v, tag):
    if k in ('xmlns', 'xmlns:xlink'):
        return None
    name = ATTR.get(k, k)
    if v is None:
        return name
    if k == 'style':
        return 'style=' + style_obj(v)
    if k in ('alt', 'aria-label', 'title', 'placeholder') and re.search(r'[A-Za-z]', v) and '{{' not in v:
        return '%s={t(%s)}' % (name, json.dumps(html.unescape(v), ensure_ascii=False))
    v = recolour(v)
    if '{{' in v:
        return '%s={`%s`}' % (name, hole(v))
    return '%s=%s' % (name, json.dumps(v, ensure_ascii=False))


def render(n, ind=0):
    if isinstance(n, str):
        return text_node(n)
    if n.tag == 'root':
        return ''.join(render(k, ind) for k in n.kids)
    attrs = [a for a in (attr_js(k, v, n.tag) for k, v in n.attrs) if a]
    open_ = '<' + n.tag + (' ' + ' '.join(attrs) if attrs else '')
    if n.tag in VOID or (n.tag in SVG_LEAF and not n.kids):
        return open_ + ' />'
    inner = ''.join(render(k, ind + 1) for k in n.kids)
    return open_ + '>' + inner + '</' + n.tag + '>'


def convert(fragment):
    p = P()
    p.feed(fragment)
    return render(p.root)


def palette_css(prefix='  '):
    return '\n'.join('%s%s: %s;' % (prefix, v, k) for k, v in sorted(PALETTE.items(), key=lambda x: x[1]))
