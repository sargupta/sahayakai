Register: mark the class, and the triage tells you which parents to call today.

Built from the following:
- a page `ScreenHeader` ("Class 6A") with a small solid Outreach button that opens the outreach list;
- `ClassTabs` running edge to edge, controlling the register panel below;
- a `TriageCard` ("Needs outreach today · 20") with absences in red and academic risk in amber;
- a `SegmentedControl` for Today, Students and Reports;
- the day's count in words ("31 present · 7 absent · 2 late") beside the hint "Tap a row to correct it";
- `RosterRow`s that become the current row when tapped, then take P or A;
- the success `Button` "Submit attendance", a parked `Orb` and the `TabBar` on Home.

The count updates as rows are corrected and is announced politely. Students switches to the outreach list.
