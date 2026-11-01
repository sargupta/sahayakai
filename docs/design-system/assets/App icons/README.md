# App icons

The app's own line icons: the four destinations of the tab bar, drawn on a 20×20 grid at a 1.7 stroke with round caps and no fill. They are what the app uses; reach for nothing else in navigation.

**Files**
- `home.svg`
- `library.svg` (a folder)
- `community.svg` (two people)
- `profile.svg`

**Ink:** single ink `ink-500` #6E655C (the inactive tab colour) when shown through `<img>`. In code, draw the same paths inline and colour them from a token:
- `ink-500` when inactive;
- white on the `saffron-500` disc when active (stroke 1.8);
- `saffron-600` on the tinted disc while the orb is dragged;
- `on-camera-icon` on the scanner.

Draw them at 18px inside 42px discs (`TabBar`) or 42px rows (`SideRail`).
