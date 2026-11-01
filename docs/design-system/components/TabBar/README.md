The app's floating capsule navigation: Home, Library, Community and Profile as four icon discs, never five.

**Use** on every app screen, centred `tabbar-bottom` (18px) above the screen's foot: wrap it in `.sk-tabbar-dock` inside a positioned screen, or use `PhoneScreen`'s `overlay`. Screen content pads `screen-pad-bottom` (96px) so nothing hides under it.

**Destinations**
- **Home**: the day (what is waiting, today's periods, quick actions), roll call and parent calls.
- **Library**: everything VIDYA made and the tools that make it: lessons, worksheets, quizzes, rubrics, the scanner.
- **Community**: teachers sharing, asking and celebrating.
- **Profile**: the teacher, their classes and board, settings, the offline queue.

Creation is not a tab: VIDYA, the orb, starts it from any screen. The orb is never inside the tab bar.

**The consumer provides** `active`, `onChange` (or `hrefs`) and translated `labels`. Labels are not drawn; they are each tab's accessible name and tooltip.

**States**
- `emphasis="fill"`: the active tab is a saffron disc with a white icon (stroke 1.8). This is the normal state.
- `emphasis="tint"` with `dimmed`: while the orb is dragged, the bar drops to half opacity and the active tab becomes a 12% saffron disc with a `saffron-600` icon.
- `tone="camera"` on the scanner: a 16% milk capsule with no shadow; inactive icons `on-camera-icon`.

**Rules**
- Icons are the app's own 20×20 line icons at 1.7 stroke, drawn 18px; inactive in `ink-500` (5.6:1).
- Each disc draws at 42px; its touch area extends to 48px.
- The active tab carries `aria-current="page"`.
