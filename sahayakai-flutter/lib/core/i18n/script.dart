/// Whether [text] contains a character from one of the Indian scripts the app
/// ships (Devanagari, Bengali, Gurmukhi, Gujarati, Odia, Tamil, Telugu,
/// Kannada, Malayalam: U+0900–U+0D7F).
///
/// Design system v2 never uppercases or letter-spaces Indic text and sets it
/// at 12px in 10px roles, so eyebrows and field labels ask this before they
/// transform a string. It looks at the script, not at "anything non-ASCII": a
/// curly apostrophe or a dash in an English label is still English.
bool isIndicText(String text) =>
    text.runes.any((r) => r >= 0x0900 && r <= 0x0D7F);
