The board a teacher sets once: CBSE, ICSE / ISC, or one of 27 state and UT boards, picked from a searchable sheet.

SahayakAI covers 29 boards. The board decides which textbook and chapter VIDYA aligns to ("CBSE · NCERT Ch 8", "KSEEB · Ch 8"), so it is asked once at onboarding and changed in Profile.

**Use**
- `variant="chips"` (default) during onboarding: a "Board" `Eyebrow` over three `indigo` chips: "CBSE", "ICSE / ISC" and "State board". Tapping "State board" opens an `OptionSheet` of the 27 state and UT boards with search. Once one is chosen, the third chip shows its short code ("KSEEB") or, when it has none, its name ("Puducherry Board").
- `variant="field"` in forms and Profile: a `Field` select labelled "Board" that opens the same sheet with all 29, grouped "National boards" and "State and UT boards".

**The consumer provides** either `value` + `onChange` or `defaultValue`, using the board's full name exactly as in `SahayakAI.BOARDS`. It can also provide `helper` ("CBSE and ICSE / ISC, plus 27 state and UT boards.") and translated `label`, `stateLabel`, `sheetTitle` and `groupLabels`. Place it inside the positioned screen (`PhoneScreen`) so the sheet rises over the whole screen, and dim the page behind to .34 while it is open. On a 360px phone the 29-board list stops 48px below the top of the screen and only the list scrolls.

**Data:** `SahayakAI.BOARDS` is `{ national: ['CBSE', 'ICSE / ISC'], state: [27 names] }`. Store and send the full name; the short code is for display only.

**Rules**
- The chips are a named group (`aria-labelledby` the eyebrow). The third chip has `aria-haspopup="dialog"`. Once a state board is chosen, its accessible name is "State board: " plus the full name, which includes the visible code.
- Never default to CBSE or imply that NCERT is the only curriculum. Show the teacher's board wherever a chapter appears.
- Search matches any part of the name or code ("bengal", "WBBSE"). Focus returns to the chip or field when the sheet closes.
- `indigo` is curriculum: use it for the board and never for unrelated choices.
