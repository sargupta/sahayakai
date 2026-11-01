The scanner's running tally under the camera frame: sheets captured, how to hold the next one, and the latest sheets.

**Use**
- The scanner screen, between the camera frame and the camera toggles, on `camera-ground` (default `tone="camera"`).
- `tone="light"` when capture happens on a screen wash (picking photos from the gallery).
- Show the latest three sheets beside the parked orb; four when the orb is elsewhere.

**The consumer provides** `count`, `sheets` (latest, each `read` or `check`, with a spoken `label` such as "Roll 12"), `onOpen`, `onAdd`, and translated `title`, `hint`, `statusLabels`, `addLabel`.

**Rules**
- The count is announced politely as it changes.
- A sheet's state is its edge colour plus a check or alert badge plus a spoken word: never colour alone.
- On the camera ground the disc and edges switch to `leaf-300` / `saffron-300`, the card to `camera-glass`; focus rings turn `on-camera`.
- The add tile picks a photo instead of the camera; it is a 52x64 button named "Add a sheet".
- Thumbnails are 52x64 paper sheets, 8px apart; the strip scrolls sideways when more are shown.
