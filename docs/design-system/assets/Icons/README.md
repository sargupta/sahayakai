# Icons

These are SahayakAI's own line icons, the same 49 glyphs the `Icon` component draws. Each sits on a 20px grid with a 1.7 stroke, round caps and round joins. One set serves the phone app, the web app, the school console and the website, so every surface shares one hand.

The files use `currentColor`, which shows as black in a plain `<img>`. In code, use the `Icon` component, or inline the SVG and colour it from a token:
- `text-muted` for inactive icons;
- `text-strong` for active ones;
- white on saffron, leaf and indigo fills;
- a meaning colour only where the icon carries that meaning.

**One icon per meaning:**

| Group | Files |
|---|---|
| Destinations | `home`, `library`, `community`, `profile` |
| Voice and controls | `mic`, `mic-off`, `send`, `keyboard`, `play`, `pause`, `speaker`, `phone` |
| Navigation | `plus`, `back`, `forward`, `chevron`, `arrow-up-right`, `more`, `search`, `settings`, `menu`, `cross`, `check` |
| Actions | `copy`, `download`, `upload`, `print`, `share`, `edit`, `refresh`, `thumb-up`, `thumb-down`, `user-plus` |
| Things and states | `book`, `scan`, `message`, `bell`, `calendar`, `clock`, `trend-down`, `alert`, `star`, `globe`, `key`, `lock`, `signal-off`, `sync`, `grid`, `sparkline` |

**Rules**
- A mic glyph is a control you press. VIDYA is the orb, and the orb never carries an icon.
- Pair every icon that means something with a word, a status dot or an accessible name.
- There is no "Create" or "Me" icon: the app has four destinations, and making happens through VIDYA.
- Name channels such as WhatsApp in words, never with brand logos.
- Need an icon that is missing? Add it to this set on the same grid rather than mixing in another library.
