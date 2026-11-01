The 360×760 app screen every mobile mock starts from: wash, glow, status bar, padded content and an overlay.

**Use**
- Wrap every phone screen in it. Content stacks 14px apart inside 4px 20px padding; the bottom padding (default 96, `screen-pad-bottom`) clears the tab bar.
- `wash="screen"` for every ordinary screen (`wash-screen`), `working` while VIDYA writes (`wash-working`), `call` during a parent call (`wash-call`), `camera` for the scanner (`camera-ground`, milk text).
- VIDYA Live takes the state's wash: `live-listening`, `live-working`, `live-speaking` (each lit from behind the orb by its `glow-live-*`) and `live-failed` (no glow).
- The saffron corner glow is on by default only for `wash="screen"`, and it belongs to the start screens (Onboarding, Home). Tool, list and output screens pass `glow={false}`; the working, call, camera and Live washes never draw it.
- Put the parked orb (`OrbHint` with `parked`), the tab bar (in `.sk-tabbar-dock`), an `OrbPrompt` and any sheet in `overlay`; they are positioned against the screen.
- Under a sheet, set `padBottom={0}`; under an `OrbPrompt`, 150.

**The consumer provides** the children (usually a `ScreenHeader` first), the `overlay` nodes, `network` when offline, and `height` only to crop a preview.

**Anatomy:** 360×760 (`screen-w`, `screen-h`), `radius-screen` corners, `shadow-screen` (drop it with `frame={false}` inside a device frame), and on start screens the `glow-saffron` circle (214px, top -46, right -54) behind everything.

**Rules**
- One orb and one tab bar per screen, both in `overlay`, never in the content.
- Content clips at the screen edge; long pages scroll inside the content area, not the frame.
- On the camera wash the frame gets `.sk-camera`, so focus outlines turn `on-camera`.
