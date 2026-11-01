The worksheet wizard in its blocked state: the textbook page photo is required, so Generate waits and says why.

Built from the following:
- `ScreenHeader` ("Make a worksheet");
- `UploadDrop` zone, required, in its error state ("Add a photo of the textbook page to continue.");
- `Field` md, multiline, for the worksheet instructions with its inline mic;
- three `SuggestionRow`s in a radiogroup; picking one fills the instructions;
- md select `Field`s for Class, Subject and Language;
- a soft `GlassCard` where the result will appear, whose line is the reason Generate is unavailable;
- a mic `Button` disc beside the primary `Button`, `aria-disabled` and described by that reason until the photo is in.

The orb parks on the left in the action row; the Library tab is active. Adding a photo fills the zone and unlocks Generate.
