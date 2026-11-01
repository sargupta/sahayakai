The quiz composer: topic, class, board, language, question types, how many, and the Bloom's levels that drive them.

Built from the following:
- `ScreenHeader` ("Make a quiz");
- `Field` lg for the topic with its inline mic;
- md select `Field`s for Class and Language, and `BoardSwitch` as a field for the board, whose sheet offers CBSE, ICSE / ISC and the 27 state and UT boards;
- `CheckCard`s, two across, for the question types;
- `Slider` for the number of questions (1 to 20);
- small saffron `Chip`s for Bloom's levels, multi-select;
- a saffron `NoticeCard` that explains the strategy for exactly the levels chosen, and updates politely as they change;
- a mic `Button` disc (speak the whole request) beside the primary `Button`.

The orb parks on the left in the action row, centred on the CTA, so it never covers the form; the Library tab is active.
