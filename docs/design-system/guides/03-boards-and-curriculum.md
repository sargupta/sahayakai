# Boards and curriculum

SahayakAI is built for every Indian school, not one syllabus. A teacher sets their board once, and everything VIDYA makes is grounded in that board's textbooks and labelled with it.

## Coverage

- **29 boards are mapped and selectable:**
  - CBSE, with NCERT textbooks.
  - ICSE / ISC.
  - 27 state and UT boards: Andhra Pradesh, Assam (SEBA), Bihar (BSEB), Chhattisgarh (CGBSE), Goa, Gujarat (GSEB), Haryana (HBSE), Himachal Pradesh (HPBOSE), Jharkhand (JAC), Karnataka (KSEEB), Kerala (SCERT), Madhya Pradesh (MPBSE), Maharashtra (MSBSHSE), Manipur (COHSEM), Meghalaya (MBOSE), Nagaland (NBSE), Odisha (BSE Odisha), Punjab (PSEB), Rajasthan (RBSE), Tamil Nadu (SSLC), Telangana (TSBIE), Tripura (TBSE), Uttar Pradesh (UPMSP), Uttarakhand (UBSE), West Bengal (WBBSE), Delhi (DBSE) and Puducherry.
- **The curriculum graph.** The unit of curriculum is a cell: board × class × subject × language stream. A cell resolves to a textbook and its chapters. Exam papers follow each board's own blueprint.

## The board switch

- **Set once, change anytime.** Onboarding asks for language, classes and board. Profile shows them, and `BoardSwitch` changes them.
- **Three chips.** CBSE · ICSE / ISC · State board. "State board" opens an `OptionSheet` of all 27 with search; the chosen board's short code then shows on the chip ("KSEEB").
- **Selected colour.** Indigo, the curriculum colour, so the board never competes with language (saffron) or class (leaf).
- **Per output.** The composer shows the board as a compact `Field` (`as="select"`) beside Class and Length, so a teacher who teaches two syllabi can switch for one lesson without changing their profile.

## Labelling every output

- **Pills.** Each output carries an indigo curriculum pill naming the board and chapter: "CBSE · NCERT Ch 8", "ICSE · Ch 8", "KSEEB · Class 7 · Ch 8".
- **Notice.** Before anything is written, the curriculum `NoticeCard` says what VIDYA aligned to: "Aligned to CBSE · NCERT Ganita Prakash 7, Chapter 8 before anything is written". Its square mark shows the board's initial.
- **Provenance.** The output's provenance line names the textbook and chapter. The disclosure ("VIDYA drafts; you check it before you teach.") is always shown with it, never replaced by it.
- **Print.** The print sheet (`DocumentSheet`) lists Board, Textbook and Chapter in its header.

## Accuracy discipline

- **Real chapters only.** Under NCF-2023, Class 7 fractions is NCERT Ganita Prakash 7, Chapter 8 "Working with Fractions"; the water cycle is a Class 6 science topic. Check every example in a design, deck or screenshot against the curriculum data.
- **Never NCERT-only.** NCERT is CBSE's textbook series. Name the board first, then the textbook.
- **Honest unknowns.** If a chapter cannot be matched, VIDYA says so and asks ("I couldn't find that chapter in KSEEB Class 7. Which book is it from?") instead of inventing a citation.
