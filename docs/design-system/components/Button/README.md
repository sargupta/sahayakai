The pill button: one saffron primary per screen, with quieter pills beside it.

**Use**
- `primary`, `size="lg"`, `block`: the single full-width action at the foot of a screen ("Start teaching", "Generate lesson", "Finish and grade"). It sits above the tab bar; park the orb at `orb-park-bottom-cta` (172px) when it is present.
- `primary` `md` beside a `secondary` `md`: the output pair ("Deliver" + "Edit", "Deliver" + "Answer key").
- `success` for completing a register ("Submit attendance"); `danger` only to end something live ("End call"). Colour carries meaning here, so it never decorates.
- `outline` and `quiet` inside sheets ("Minimise to orb", "Stop"); `xs` inside VIDYA's context prompt ("Build it", "Message parents").
- `web` on the website; `dark` is the website nav's one dark pill.

**The consumer provides** the label (a short verb: Open, Deliver, Start teaching), `onClick` or `href`, and `disabled` while an action cannot run.

**Rules**
- Never two primaries on one screen. Never a primary inside a card.
- Labels are verbs in sentence case, translated. Indic labels wrap to a second line rather than truncate or push their neighbour off the screen; the pill grows from its height (52, 50 or 46px) to fit.
- At the phone's 360px width a `block` button spans the 320px between the 20px gutters; a pair splits it 9px apart, the primary taking the rest beside a short secondary.
- The primary fill is `accent-fill` (`saffron-600`): white on it is 5.28:1. White never sits on `saffron-500` (3.77:1) (decided 26 Oct 2026). The action is never the only place information lives.
- Focus shows the system outline 2px outside the pill; press scales to .98.
- `xs` draws at about 33px; its touch area is extended to 44px.
