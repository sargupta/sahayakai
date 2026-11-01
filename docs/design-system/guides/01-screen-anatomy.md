# Screen anatomy

Every app screen is built from the same seven layers, bottom to top. Get these right and any new screen will look like SahayakAI before a single colour is chosen.

| # | Layer | What it is | Tokens and components |
| --- | --- | --- | --- |
| 1 | Ground | The wash plus one saffron glow off the top-right corner | `wash-screen` (`wash-working` while VIDYA works, `wash-call` on a live call), `glow-saffron`; `PhoneScreen` |
| 2 | Status bar | 36px, time left, network right | `StatusBar` |
| 3 | Header | The screen's one title, a subline, an optional trailing pill | `ScreenHeader` |
| 4 | Content stack | Glass cards, rows, fields, stacked 14px apart in 20px gutters | `GlassCard`, `Field`, `TaskRow`, `Tile` … |
| 5 | Primary action | One 52px saffron pill, full width, at the foot of the content | `Button` `lg` `block` |
| 6 | Floating layer | The orb (with its hint) and the tab bar | `OrbHint` / `Orb`, `TabBar` in `.sk-tabbar-dock` |
| 7 | Sheet | VIDYA's sheet over a 14% scrim, the page behind at 34% | `Sheet`, `VoiceSheet`, `DeliverTray`, `OptionSheet` |

## Geometry

- **Screen.** 360 × 760, radius `radius-screen` on mocks. Gutters are 20px (`screen-pad-x`). The content starts 4px under the status bar.
- **Vertical rhythm.** 14px between blocks (`space-7`), 9px between paired cards (`space-4`), 7px between chips (`space-3`).
- **Bottom clearance.** Content pads `screen-pad-bottom` (96px). The tab bar sits `tabbar-bottom` (18px) above the foot. A primary action sits directly above the tab bar.
- **The orb.**
  - Default perch: right 16 / bottom 100.
  - Above a CTA: bottom 172.
  - Left-handed: left 18.
  - There are six snap perches in all: top and bottom on each side, plus the two bottom corners above the tab bar. The orb never covers the primary action or the tab bar.

## Hierarchy rules

- **One title.** `type-screen-title` on Home only (it may break into two short lines). `type-page-title` on tool and destination screens. `type-output-title` on generated outputs and people (a parent on a call).
- **One primary card.** Only the most important card is `raised` with `radius-panel` (Home's "Waiting for you"). Everything else is flat glass.
- **One primary action.** Secondary actions are glass pills beside it (`Deliver` + `Edit`) or text actions inside rows ("Open", "Change").
- **Glass reads on the wash.** Never put glass on a solid ground. Inside sheets and solid cards, use `inset` surfaces.

## Destinations

The four tabs organise everything:
- **Home** is today: what is waiting, the next periods, roll call and parent calls.
- **Library** is everything VIDYA makes and the tools that make it (lesson, worksheet, quiz, rubric, scanner); every output screen lives here.
- **Community** is teachers sharing and asking.
- **Profile** is the teacher, their classes and board, settings and the offline queue.

Creation is not a destination: VIDYA starts it from anywhere.

## On wider screens

On tablets and desktop, the same four destinations move into the `SideRail`. Content sits in a centred 672px column for forms and reading, or a 1024px column for tools and lists. The orb parks at the content column's bottom right. Sheets become centred dialogs no wider than 520px, keeping the same anatomy.
