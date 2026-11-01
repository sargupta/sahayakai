import type * as React from 'react';


export interface ButtonProps {
  /** primary: the one saffron action per screen. success: leaf, for "Submit attendance". danger: red, for "End call". secondary: glass pill beside a primary ("Edit", "Answer key"). outline: hairline pill ("Minimise to orb"). quiet: grey fill ("Stop"). accent-outline: saffron outline beside a primary inside VIDYA's prompt ("Message parents"). dark: ink pill (website nav). */
  variant?: 'primary' | 'success' | 'danger' | 'secondary' | 'outline' | 'quiet' | 'accent-outline' | 'dark';
  /** lg 52px full-width CTA · md 50px paired buttons · sm 46px inside sheets · web 44px website actions · xs compact prompt buttons (touch area extended to 44px). */
  size?: 'lg' | 'md' | 'sm' | 'web' | 'xs';
  block?: boolean;
  disabled?: boolean;
  type?: 'button' | 'submit' | 'reset';
  /** Renders an <a> instead of a <button>. */
  href?: string;
  onClick?: (e: React.MouseEvent) => void;
  className?: string;
  children?: React.ReactNode;
}
export declare function Button(props: ButtonProps): React.ReactElement;

export interface ChipProps {
  /** choice: a toggle (default) · more: "+7 more", opens an OptionSheet (no pressed state) · filter: a 10px Community filter · action: runs something ("Make it easier", "Add a diagram"), 12px/500 glass, no pressed state. */
  variant?: 'choice' | 'more' | 'filter' | 'action';
  /** The selected fill, by meaning: saffron language · leaf class and include · indigo board · camera the scanner's toggles. For filter, the inactive tint by post type: saffron Resource · amber Tried this · leaf Celebrate · indigo Need help. */
  tone?: 'saffron' | 'leaf' | 'indigo' | 'amber' | 'camera';
  /** md 12px (languages, classes, boards; default) · sm 11px (include options, scanner). filter is always 10px. */
  size?: 'md' | 'sm';
  /** On: the tone's solid fill with white text. Sets aria-pressed. */
  selected?: boolean;
  /** Unselected text: strong (ink-900 600, the default for saffron) or quiet (ink-600 500, the default for leaf and indigo). For action: quiet is glass on the wash (default), strong is solid milk with a row edge, for chips on a card or sheet. */
  emphasis?: 'strong' | 'quiet';
  /** action only: a leading glyph name from SK.ICONS ("plus" for "Add a diagram"). Never a text symbol. */
  icon?: string;
  disabled?: boolean;
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  /** Language of the label when it differs from the page ("hi" for हिन्दी). */
  lang?: string;
  id?: string;
  /** For variant "more": whether its sheet is open. */
  'aria-expanded'?: boolean;
  'aria-haspopup'?: 'dialog' | 'listbox' | boolean;
  'aria-label'?: string;
  className?: string;
  style?: React.CSSProperties;
  /** One to three words, translated. */
  children?: React.ReactNode;
}
export declare function Chip(props: ChipProps): React.ReactElement;

export interface PillProps {
  /** Tone is meaning. saffron: VIDYA, pending, preview · amber: language, tried-this, late · leaf: done, on, class facts · indigo: curriculum, working, need help · red: absent, alert · glass: the language pill on a screen header · solid-leaf: live status ("34 present", "On call · 1:12") · solid-saffron: the active filter · camera: a count on the scanner ("12 / 34"). */
  tone?: 'saffron' | 'amber' | 'leaf' | 'indigo' | 'red' | 'glass' | 'solid-leaf' | 'solid-saffron' | 'camera';
  /** sm 10px (default) · xs 10px tight (tags) · md 11px (solid status pills). Indic text renders at 12px. */
  size?: 'sm' | 'xs' | 'md';
  /** A leading dot in the pill's colour. */
  dot?: boolean;
  lang?: string;
  className?: string;
  style?: React.CSSProperties;
  children?: React.ReactNode;
}
export declare function Pill(props: PillProps): React.ReactElement;

export interface EyebrowProps {
  /** app 10px tracked .16em (default) · tight 10px .14em (inside composer cards and sheets) · web 11px .18em. */
  size?: 'app' | 'tight' | 'web';
  /** Default saffron-600. muted for counts ("3 items queued"), faint for website card eyebrows, onCamera on the scanner. */
  tone?: 'muted' | 'faint' | 'onCamera';
  as?: keyof JSX.IntrinsicElements;
  id?: string;
  lang?: string;
  className?: string;
  style?: React.CSSProperties;
  children?: React.ReactNode;
}
export declare function Eyebrow(props: EyebrowProps): React.ReactElement;

export interface IconProps {
  /** Glyph name: one of `SahayakAI.ICONS` (home, library, community, profile, mic, send, phone, ...). */
  name: string;
  /** Drawn size in px (default 20; the glyphs are designed on a 20px grid). */
  size?: number;
  /** Stroke width (default 1.7). */
  stroke?: number;
  /** Colour; defaults to the inherited text colour. */
  color?: string;
  /** Accessible name. Omit when a visible label sits beside the icon (it is then hidden from assistive tech). */
  label?: string;
  className?: string;
}
export declare function Icon(props: IconProps): React.ReactElement;
export declare const ICONS: string[];

export interface AvatarProps {
  /** The full name ("Meena Kulkarni", "Daily Briefing"). It names the avatar for assistive tech and gives the initials. */
  name: string;
  /** Override the initials, or the letter of a mark ("स", "N"). Default: first letters of the first and last words. */
  initials?: string;
  /** lg 44px (profile) · md 36px (screen header; default for circles) · sm 26px (post authors and marks; default for squares). Glass avatars add their 1px edge outside. */
  size?: 'sm' | 'md' | 'lg';
  /** circle: a person · square: a radius-sm mark for something that is not a person (VIDYA's Daily Briefing, a board or curriculum). */
  shape?: 'circle' | 'square';
  /** Circles: glass (the teacher's own, on a header; default md/lg) or a 14% tint of amber, leaf or saffron (post authors). Squares: solid saffron or indigo with white text. */
  tone?: 'glass' | 'amber' | 'leaf' | 'saffron' | 'indigo';
  /** A photo URL; it fills the shape. Initials show while there is none. */
  src?: string;
  /** Overrides the accessible name (default: name). */
  label?: string;
  /** Hide from assistive tech when the name is written right beside it. */
  decorative?: boolean;
  /** Language of the initials when they are in another script. */
  lang?: string;
  id?: string;
  title?: string;
  className?: string;
  style?: React.CSSProperties;
}
export declare function Avatar(props: AvatarProps): React.ReactElement;

export interface SwitchProps {
  /** What the setting does, translated ("Orb on the left hand"). It is the switch's accessible name. */
  label: React.ReactNode;
  /** Controlled state. Pass checked + onChange, or defaultChecked. */
  checked?: boolean;
  defaultChecked?: boolean;
  /** Called with the new state. */
  onChange?: (checked: boolean) => void;
  /** The state word drawn before the track. Default { on: 'On', off: 'Off' }; translate both. */
  stateLabels?: { on?: string; off?: string };
  /** Default true. The word is hidden from assistive tech; aria-checked carries the state. */
  showState?: boolean;
  /** Keep the label for assistive tech but do not draw it (when a row title already shows it). */
  hideLabel?: boolean;
  disabled?: boolean;
  id?: string;
  lang?: string;
  'aria-describedby'?: string;
  className?: string;
  style?: React.CSSProperties;
}
export declare function Switch(props: SwitchProps): React.ReactElement;

export interface SegmentedOption {
  value: string;
  /** Translated label; one or two words. */
  label: React.ReactNode;
  /** Language of this label when it differs from the page. */
  lang?: string;
  disabled?: boolean;
}
export interface SegmentedControlProps {
  /** Two to four options: strings, or { value, label, lang }. */
  options: Array<string | SegmentedOption>;
  /** Controlled value. Pass value + onChange, or defaultValue (default: the first option). */
  value?: string;
  defaultValue?: string;
  /** Called with the chosen value, on tap or arrow key. */
  onChange?: (value: string) => void;
  /** The radiogroup's accessible name ("Difficulty"), translated. Or pass aria-labelledby. */
  label?: string;
  'aria-labelledby'?: string;
  disabled?: boolean;
  id?: string;
  className?: string;
  style?: React.CSSProperties;
}
export declare function SegmentedControl(props: SegmentedControlProps): React.ReactElement;

export interface FieldProps {
  /** The eyebrow label inside the card ("Topic", "Class", "Board"). Translated; Indic labels are not uppercased. */
  label: React.ReactNode;
  id?: string;
  name?: string;
  /** Controlled value. Pass value + onChange, or defaultValue, never both. */
  value?: string;
  defaultValue?: string;
  placeholder?: string;
  /** lg: the topic card (18px radius, 15px value). md: compact paired cards such as Class and Length (16px radius, 14px value). */
  size?: 'lg' | 'md';
  /** glass over a screen wash (default); inset inside a sheet or solid card. */
  surface?: 'glass' | 'inset';
  /** select: the value is a button that opens an OptionSheet (Class, Board, Language). Pass onOpen. */
  as?: 'input' | 'select';
  onOpen?: () => void;
  multiline?: boolean;
  rows?: number;
  type?: string;
  inputMode?: 'text' | 'numeric' | 'search' | 'tel';
  /** Shows the mic button (a flat saffron disc with a mic glyph) for dictation into this field: 'idle', or 'listening' while VIDYA hears it. */
  mic?: false | 'idle' | 'listening';
  onMic?: () => void;
  micLabel?: string;
  micStopLabel?: string;
  /** Says what happened and what to do, not "Error". */
  error?: React.ReactNode;
  helper?: React.ReactNode;
  /** true shows "Optional", or pass translated text. */
  optional?: boolean | string;
  /** e.g. "24 / 200", announced politely. */
  counter?: string;
  disabled?: boolean;
  required?: boolean;
  readOnly?: boolean;
  maxLength?: number;
  autoComplete?: string;
  lang?: string;
  onChange?: React.ChangeEventHandler<HTMLInputElement | HTMLTextAreaElement>;
  onFocus?: React.FocusEventHandler;
  onBlur?: React.FocusEventHandler;
  className?: string;
  style?: React.CSSProperties;
}
export declare function Field(props: FieldProps): React.ReactElement;

export interface ComposerProps {
  /** sheet (default): the inset pill under VIDYA's suggestions in a VoiceSheet · chat: the glass pill with a shadow at the foot of a conversation, 38px discs, 13px text. */
  variant?: 'sheet' | 'chat';
  /** Controlled text. Pass value + onChange, or defaultValue. */
  value?: string;
  defaultValue?: string;
  /** Called with the new text, then the event. */
  onChange?: (value: string, e: React.ChangeEvent<HTMLInputElement>) => void;
  /** Called with the trimmed text on Enter (never while an Indic keyboard is composing). Uncontrolled composers then clear. Without it, Enter calls onSend. */
  onSubmit?: (text: string) => void;
  /** Shows the leaf send disc. Called with the trimmed text when it is tapped (an empty composer takes focus instead). Without onSubmit, Enter calls it too. */
  onSend?: (text: string) => void;
  /** Default true for uncontrolled composers. */
  clearOnSubmit?: boolean;
  /** The mic disc: open the VoiceSheet (sheet) or start a voice turn (chat). */
  onMic?: () => void;
  /** idle (default): the mic is live (and pulses in the sheet variant). offline: the mic turns stone-500 with the mic-off glyph and stops, and the placeholder says typing still works. */
  state?: 'idle' | 'offline';
  /** An example, never a label. Default "Or type what you need…" (sheet) or "Type your message…" (chat). */
  placeholder?: string;
  /** Default "Typing still works". */
  offlinePlaceholder?: string;
  /** The input's accessible name. Default "Type what you need" (sheet) or "Message VIDYA" (chat). */
  label?: string;
  /** The mic's accessible name. Default "Speak". */
  micLabel?: string;
  /** Default "Speak, needs signal". */
  micOfflineLabel?: string;
  /** The send disc's accessible name. Default "Send". */
  sendLabel?: string;
  disabled?: boolean;
  /** Language the teacher is typing in ("hi"). */
  lang?: string;
  id?: string;
  name?: string;
  onKeyDown?: React.KeyboardEventHandler<HTMLInputElement>;
  onFocus?: React.FocusEventHandler<HTMLInputElement>;
  onBlur?: React.FocusEventHandler<HTMLInputElement>;
  'aria-describedby'?: string;
  className?: string;
  style?: React.CSSProperties;
}
export declare function Composer(props: ComposerProps): React.ReactElement;

export interface SearchFieldProps {
  /** The input's label, translated ("Search shared resources"). It is visually hidden, so the placeholder must say the same thing; defaults to the placeholder. */
  label?: string;
  /** An example of what to type: "Search lessons, quizzes, worksheets…", "What did you do today?". */
  placeholder?: string;
  /** Controlled text. Pass value + onChange, or defaultValue. */
  value?: string;
  defaultValue?: string;
  /** Called with the new text, then the event. */
  onChange?: (value: string, e: React.SyntheticEvent) => void;
  /** Called with the trimmed text on Enter (never while an Indic keyboard is composing). */
  onSubmit?: (text: string) => void;
  /** Uncontrolled fields clear after submit. Default false. */
  clearOnSubmit?: boolean;
  /** The leading glyph: search (default) or none (false) for the post prompt and the ask bar. */
  glyph?: 'search' | false;
  /** search (default with the search glyph: Escape and the cross clear it; the pill is a search landmark) or text. */
  type?: 'search' | 'text';
  /** solid (default): milk with a hairline, for search and the post prompt. glass: the lifted Staff room ask bar, 13px text. */
  surface?: 'solid' | 'glass';
  /** Shows the trailing 36px saffron mic disc: dictation into this field. */
  onMic?: () => void;
  /** Pass to make the mic a toggle (aria-pressed); listening pulses it. */
  micState?: 'idle' | 'listening';
  /** Accessible name of the mic. Default "Speak instead". */
  micLabel?: string;
  /** Hide the cross that clears a search. */
  clearable?: boolean;
  /** Accessible name of the cross. Default "Clear". */
  clearLabel?: string;
  /** Accessible name of the search landmark when a screen has more than one. */
  regionLabel?: string;
  disabled?: boolean;
  /** Language the teacher types in ("hi"). */
  lang?: string;
  id?: string;
  name?: string;
  onKeyDown?: React.KeyboardEventHandler<HTMLInputElement>;
  onFocus?: React.FocusEventHandler<HTMLInputElement>;
  onBlur?: React.FocusEventHandler<HTMLInputElement>;
  'aria-describedby'?: string;
  className?: string;
  style?: React.CSSProperties;
}
export declare function SearchField(props: SearchFieldProps): React.ReactElement;

export interface CheckCardProps {
  /** The option, in a few words ("Multiple choice", "Short answer"). */
  label: React.ReactNode;
  /** One short line under the label (rare: "Answer key included"). */
  hint?: React.ReactNode;
  /** Controlled checked state. Leave undefined and use `defaultChecked` for uncontrolled. */
  checked?: boolean;
  /** Initial state when uncontrolled. */
  defaultChecked?: boolean;
  /** Called with the new checked state. */
  onChange?: (checked: boolean, e: React.ChangeEvent<HTMLInputElement>) => void;
  /** Form field name and value of the underlying checkbox. */
  name?: string;
  value?: string;
  disabled?: boolean;
  required?: boolean;
  /** Marks the checkbox aria-invalid (the group's error is shown by the consumer). */
  invalid?: boolean;
  id?: string;
  /** Language of the label (BCP 47). */
  lang?: string;
  className?: string;
  style?: React.CSSProperties;
}
export declare function CheckCard(props: CheckCardProps): React.ReactElement;

/** Checkbox — the plain row: a 20px box and its label. Same props as CheckCard. */
export interface CheckboxProps extends CheckCardProps {}
export declare function Checkbox(props: CheckboxProps): React.ReactElement;

export interface SliderProps {
  /** The eyebrow label before the track ("Questions"). */
  label: React.ReactNode;
  /** Lowest value. Default 0. */
  min?: number;
  /** Highest value. Default 100. */
  max?: number;
  /** Step between values. Default 1. */
  step?: number;
  /** Controlled value. Leave undefined and use `defaultValue` for uncontrolled. */
  value?: number;
  /** Initial value when uncontrolled. Default `min`. */
  defaultValue?: number;
  /** Called with the new value on every move. */
  onChange?: (value: number, e: React.ChangeEvent<HTMLInputElement>) => void;
  /** Formats the visible value (default: the number). */
  format?: (value: number) => React.ReactNode;
  /** What a screen reader says for the value ("5 questions"), as a string or a function of the value. */
  valueText?: string | ((value: number) => string);
  /** Unit for the spoken value when `valueText` is not given ("questions"). */
  unit?: string;
  /** One line under the row (rare). */
  helper?: React.ReactNode;
  name?: string;
  disabled?: boolean;
  id?: string;
  /** Language of the label (BCP 47). */
  lang?: string;
  className?: string;
  style?: React.CSSProperties;
}
export declare function Slider(props: SliderProps): React.ReactElement;

export interface UploadDropFile {
  /** File name as the teacher will recognise it ("IMG_2041.jpg"). */
  name: string;
  /** One line under the name ("Photo · 1.4 MB"). */
  meta?: string;
  /** Thumbnail URL (object URL or data URI). Without it a drawn page stands in. */
  thumb?: string;
}
export interface UploadDropProps {
  /** "zone" (default): the dashed dropzone with its eyebrow label. "row": the compact optional line. */
  variant?: 'zone' | 'row';
  /** What to add ("Textbook page", "Add a context image"). Eyebrow above the zone; the row's text. */
  label: React.ReactNode;
  /** The input must be filled; adds " · Required" to the label. */
  required?: boolean;
  /** Word shown for required. Default "Required". */
  requiredLabel?: string;
  /** Set false to hide "Optional" when not required. */
  optional?: boolean;
  /** Word shown for optional. Default "Optional". */
  optionalLabel?: string;
  /** Zone only: the prompt under the glyph. Default "Take a photo or browse". */
  prompt?: React.ReactNode;
  /** Zone only: one line under the prompt ("JPG or PNG · up to 10 MB"). */
  hint?: React.ReactNode;
  /** Row only: the action word after the aside. Default "Browse". */
  actionLabel?: string;
  /** Shown (red, role="alert") while no file is in, and sets aria-invalid. Say what to do: "Add a photo of the textbook page to continue." */
  error?: React.ReactNode;
  /** The file once added; switches to the filled state. */
  file?: UploadDropFile | null;
  /** Called with the chosen or dropped file. */
  onFile?: (file: File, e: React.ChangeEvent<HTMLInputElement>) => void;
  /** Called before the picker reopens from Replace. */
  onReplace?: () => void;
  /** Shows the Remove button in the filled state. */
  onRemove?: () => void;
  /** Replace / Remove words. The file name is added to their accessible names. */
  replaceLabel?: string;
  removeLabel?: string;
  /** File types. Default "image/*". */
  accept?: string;
  /** Opens the camera directly on phones ("environment"). Leave unset to offer camera and files. */
  capture?: 'environment' | 'user';
  name?: string;
  disabled?: boolean;
  id?: string;
  /** Language of the text (BCP 47). */
  lang?: string;
  className?: string;
  style?: React.CSSProperties;
}
export declare function UploadDrop(props: UploadDropProps): React.ReactElement;

/** Every board SahayakAI covers: 2 national and 27 state and UT boards, 29 in all. Names are stored and passed exactly as listed. */
export declare const BOARDS: { national: string[]; state: string[] };
export interface BoardSwitchProps {
  /** chips (default): an eyebrow over CBSE · ICSE / ISC · State board, for onboarding. field: a Field select for forms and Profile. */
  variant?: 'chips' | 'field';
  /** Controlled board name, exactly as in BOARDS ("CBSE", "Karnataka State Board (KSEEB)"). Pass value + onChange, or defaultValue. */
  value?: string;
  defaultValue?: string;
  /** Called with the chosen board's full name. */
  onChange?: (board: string) => void;
  /** The eyebrow or field label. Default "Board". */
  label?: string;
  /** The third chip before a state board is chosen. Default "State board". After, it shows the board's short code (KSEEB) or its name. */
  stateLabel?: string;
  /** The chips variant's sheet title. Default "State and UT boards". */
  sheetTitle?: string;
  /** The field variant's sheet groups. Default "National boards" and "State and UT boards". */
  groupLabels?: { national?: string; state?: string };
  searchPlaceholder?: string;
  searchLabel?: string;
  /** Field variant: shown before a board is chosen. Default "Choose your board". */
  placeholder?: string;
  /** Field variant size and surface (default md, glass). */
  size?: 'lg' | 'md';
  surface?: 'glass' | 'inset';
  /** A line under the control, e.g. "CBSE and ICSE / ISC, plus 27 state and UT boards." */
  helper?: React.ReactNode;
  disabled?: boolean;
  id?: string;
  className?: string;
  style?: React.CSSProperties;
}
export declare function BoardSwitch(props: BoardSwitchProps): React.ReactElement;

/** The 11 languages, as [code, native name, English name]. Chips and rows show the native name. */
export declare const LANGUAGES: Array<[string, string, string]>;
export interface LanguagePickerProps {
  /** Controlled language code ("hi"). Pass value + onChange, or defaultValue. */
  value?: string;
  defaultValue?: string;
  /** Called with the chosen code. */
  onChange?: (code: string) => void;
  /** How many chips show before "+N more". Default 4. */
  visible?: number;
  /** Chip order by code. Default ['hi', 'mr', 'en', 'bn']; the rest follow in LANGUAGES order. The chosen language always shows, taking the last slot if needed. */
  order?: string[];
  /** The eyebrow, and the sheet's title. Default "Language"; null hides the eyebrow (then pass groupLabel). */
  label?: string | null;
  /** The chip group's accessible name when there is no eyebrow. */
  groupLabel?: string;
  /** The sheet's title. Default: label. */
  sheetTitle?: string;
  /** The more chip's text. Default n => "+n more". */
  moreLabel?: (count: number) => string;
  /** Its accessible name. Default "+n more languages". */
  moreAriaLabel?: (count: number) => string;
  /** Default true: the sheet can be searched by native or English name ("Tamil" finds தமிழ்). */
  search?: boolean;
  /** Default "Search 11 languages". */
  searchPlaceholder?: string;
  /** Default "Search languages". */
  searchLabel?: string;
  disabled?: boolean;
  id?: string;
  className?: string;
  style?: React.CSSProperties;
}
export declare function LanguagePicker(props: LanguagePickerProps): React.ReactElement;

export interface OptionSheetOption {
  value: string;
  /** The choice as the teacher reads it ("Class 7", "हिन्दी", "Karnataka State Board (KSEEB)"). */
  label: React.ReactNode;
  /** A quieter second line ("Hindi", "28 students"). */
  meta?: React.ReactNode;
  /** Rows with the same group sit under one eyebrow, in order of first appearance. */
  group?: string;
  /** Language of the label ("hi"). */
  lang?: string;
  /** Extra words the search should match. */
  keywords?: string;
  disabled?: boolean;
}
export interface OptionSheetProps {
  /** Default true. */
  open?: boolean;
  /** Escape, a scrim tap, and a selection (unless closeOnSelect is false) call this. Focus returns to the opener. */
  onClose?: () => void;
  /** The sheet's title and the list's name ("Board", "Language"). */
  title?: React.ReactNode;
  /** The accessible name when title is not plain text. */
  label?: string;
  /** Strings, or option objects. */
  options: Array<string | OptionSheetOption>;
  /** The current choice; its row is tinted and checked. */
  value?: string;
  /** Called with the chosen value. */
  onSelect?: (value: string) => void;
  /** Default true. */
  closeOnSelect?: boolean;
  /** Show the search pill (for long lists such as the 29 boards). */
  search?: boolean;
  searchPlaceholder?: string;
  /** The search input's accessible name. Default "Search". */
  searchLabel?: string;
  /** What to say when nothing matches. Default: 'Nothing matches “…”. Try fewer letters.' */
  emptyText?: (query: string) => React.ReactNode;
  /** The polite announcement while searching. Default "3 matches". */
  countText?: (count: number) => string;
  /** Default true: inside the nearest positioned ancestor (the PhoneScreen). */
  contained?: boolean;
  /** Default true: focus the search, else the checked row, on open. */
  autoFocus?: boolean;
  className?: string;
  style?: React.CSSProperties;
}
export declare function OptionSheet(props: OptionSheetProps): React.ReactElement | null;

export interface GlassCardProps {
  /** tile 16px (content sections), card 18px (default), panel 20px (the primary card), field 14px (inset context cards). */
  radius?: 'tile' | 'card' | 'panel' | 'field';
  /** glass 82% (default) · soft 70% (secondary) · strong 88% (content: lesson sections, quiz, stats) · inset (milk-300 + hairline, inside sheets) · solid (milk-50) · accent (strong glass with a saffron edge: the Daily Briefing). */
  tone?: 'glass' | 'soft' | 'strong' | 'inset' | 'solid' | 'accent';
  /** The soft warm shadow. Only the primary card on a screen is raised. */
  raised?: boolean;
  /** Override padding (default 14px 15px; tile 13px 14px; field 11px 12px). */
  padding?: number | string;
  gap?: number | string;
  as?: keyof JSX.IntrinsicElements;
  className?: string;
  style?: React.CSSProperties;
  children?: React.ReactNode;
}
export declare function GlassCard(props: GlassCardProps): React.ReactElement;

export interface TileProps {
  /** The action in two or three words, set in the display face ("Roll call", "Make a lesson"). */
  title: React.ReactNode;
  /** One short line under the title ("Speak the names", "Script in हिन्दी"). */
  subtitle?: React.ReactNode;
  /** Makes the tile a full-width, left-aligned <button>. */
  onClick?: (e: React.MouseEvent) => void;
  /** Makes the tile a link instead of a button. */
  href?: string;
  /** Toggle tiles only: draws the selected fill and sets aria-pressed. Leave undefined for action tiles. */
  selected?: boolean;
  disabled?: boolean;
  /** Language of the tile's text (BCP 47, e.g. "hi"). */
  lang?: string;
  className?: string;
  style?: React.CSSProperties;
  /** Extra content under the subtitle (rare). */
  children?: React.ReactNode;
}
export declare function Tile(props: TileProps): React.ReactElement;

export interface ToolTileProps {
  /** "tool" (default): lettered badge, arrow, name and one line. "template": compact centred quick-start tile. */
  variant?: 'tool' | 'template';
  /** The tool's name ("Lesson plan") or, for a template, the topic ("Fractions"). */
  title: React.ReactNode;
  /** Tool only: what it makes, in a few words ("A timed 40-minute plan"). */
  subtitle?: React.ReactNode;
  /** Tool only: the two-letter badge (LP, WS, QZ, AT). Decorative; hidden from assistive tech. */
  mark?: string;
  /** Template only: the subject under the topic ("Maths", "Science"); shown in capitals for Latin text. */
  kicker?: React.ReactNode;
  /** Badge tint (tool) or subject colour (template). Default "saffron". */
  tone?: 'saffron' | 'leaf' | 'indigo' | 'amber';
  /** Makes the tile a full-width <button>. */
  onClick?: (e: React.MouseEvent) => void;
  /** Makes the tile a link. */
  href?: string;
  disabled?: boolean;
  /** Language of the tile's text (BCP 47, e.g. "hi"). */
  lang?: string;
  className?: string;
  style?: React.CSSProperties;
  /** Extra content under the text (rare). */
  children?: React.ReactNode;
}
export declare function ToolTile(props: ToolTileProps): React.ReactElement;

export interface NoticeCardProps {
  /** Tone is meaning. indigo: curriculum and board alignment · saffron: VIDYA's own state (working offline) · leaf: done, back online, sent · note: the plain trust line in a deliver tray (no mark, ink-600 text). Default indigo. */
  tone?: 'indigo' | 'saffron' | 'leaf' | 'note';
  /** One or two letters in a 26px square mark, e.g. the board's initial ("C" for CBSE, "K" for KSEEB). Decorative: the text must say the same thing. Ignored on the note tone. */
  mark?: string;
  /** A display title. With a title the card grows: 18px radius, 13px 14px padding, 12px/1.6 body. */
  title?: React.ReactNode;
  /** The notice text, one or two sentences. */
  children?: React.ReactNode;
  /** Default "note". Pass "status" when the notice reports a state that changes while the screen is open (working offline), so it is announced. */
  role?: 'note' | 'status' | 'alert';
  /** Language of the text (BCP 47). */
  lang?: string;
  id?: string;
  className?: string;
  style?: React.CSSProperties;
}
export declare function NoticeCard(props: NoticeCardProps): React.ReactElement;

export interface HonestyNoteProps {
  /** The plain admission, as a short title: "Not checked against web sources". With a title the note is the 16px card with the alert glyph. */
  title?: React.ReactNode;
  /** What VIDYA did instead and what the teacher should do, in VIDYA's first person: "I answered from my own knowledge, not a web search. Please check the facts before you teach them." Without a title, the one-line note. */
  children?: React.ReactNode;
  /** A glyph name from SK.ICONS, or false for none. Default "alert" when titled, none when compact. Decorative: the words carry the meaning. */
  glyph?: string | false;
  /** Default "note". Pass "status" if the note appears while the screen is open (a web check that failed), so it is announced. */
  role?: 'note' | 'status';
  /** Language of the text (BCP 47). */
  lang?: string;
  id?: string;
  className?: string;
  style?: React.CSSProperties;
}
export declare function HonestyNote(props: HonestyNoteProps): React.ReactElement;

export interface StatTileProps {
  /** The number, formatted for the teacher's locale ("68%", "4", "1,240"). */
  value: React.ReactNode;
  /** What the number counts, in sentence case ("Class average", "Weak concepts"). */
  label: React.ReactNode;
  /** Value colour, only when it carries meaning the label also states. red: a problem ("4 weak concepts") · leaf: done or good · indigo: curriculum or work in progress. */
  tone?: 'red' | 'leaf' | 'indigo';
  /** sm (default): the phone's results row, 18px value. lg: the web and admin console, 26px value, worded delta and sparkline. */
  size?: 'sm' | 'lg';
  /** lg only. The change in words, never a bare number or colour: "+12 calls this week", "3 fewer than last week". */
  delta?: React.ReactNode;
  /** lg only. good: leaf-700 · bad: red-700 · neutral (default): ink-600. The sparkline takes the same tone. */
  deltaTone?: 'good' | 'bad' | 'neutral';
  /** lg only. Recent values, oldest first (e.g. seven days), drawn as a decorative 72x24 sparkline. */
  series?: number[];
  id?: string;
  className?: string;
  style?: React.CSSProperties;
}
export declare function StatTile(props: StatTileProps): React.ReactElement;

export interface ProgressBarProps {
  /** Progress between min and max. */
  value: number;
  /** Default 0. */
  min?: number;
  /** Default 100. */
  max?: number;
  /** What is progressing ("Writing your lesson"). Required: it names the progressbar, drawn or not. */
  label: string;
  /** Draw the label and the percentage above the track (11px). */
  showLabel?: boolean;
  /** Replaces the percentage, drawn and announced ("12 of 34 sheets"). */
  valueText?: string;
  /** indigo: VIDYA working (default) · leaf: done or ready · saffron: pending, waiting to send. */
  tone?: 'indigo' | 'leaf' | 'saffron';
  /** md 10px track (default) · sm 6px, inside rows and cards. */
  size?: 'md' | 'sm';
  lang?: string;
  id?: string;
  className?: string;
  style?: React.CSSProperties;
}
export declare function ProgressBar(props: ProgressBarProps): React.ReactElement;

export interface SkeletonProps {
  /** block: a card-sized slab (tile radius) · line: a 10px pill for a line of text · circle: an avatar or orb. Default block. */
  variant?: 'block' | 'line' | 'circle';
  /** block: height in px (default 120). */
  height?: number | string;
  /** block: grow to fill the remaining height of a flex column instead of a fixed height. */
  fill?: boolean;
  /** line: width as a percentage of the container (number) or any CSS length. Default 100. */
  width?: number | string;
  /** circle: diameter in px. Default 36. */
  size?: number;
  /** glass (default): 88% white, on a screen wash · ink: an 8% ink fill, on milk cards and sheets. */
  tone?: 'glass' | 'ink';
  className?: string;
  style?: React.CSSProperties;
}
export declare function Skeleton(props: SkeletonProps): React.ReactElement;

export interface ToastProps {
  /** The message: what just happened, in one short line ("Sent to the Class 7 parent group"). Empty or omitted = no toast. */
  children?: React.ReactNode;
  /** false empties the toast but keeps its live region mounted, so the next message is announced. Default true. */
  open?: boolean;
  /** A leading 8px status dot; the message must say the same thing. leaf: done · amber: queued · red: failed · saffron: VIDYA · indigo: working. */
  tone?: 'leaf' | 'amber' | 'red' | 'saffron' | 'indigo';
  /** One trailing text action, a short verb ("Undo", "View"). */
  action?: React.ReactNode;
  onAction?: (e: React.MouseEvent) => void;
  lang?: string;
  id?: string;
  className?: string;
  style?: React.CSSProperties;
}
export declare function Toast(props: ToastProps): React.ReactElement;

export interface EmptyStateAction {
  /** A short verb, translated: "Make a lesson". */
  label: string;
  onClick?: () => void;
  /** Renders a link instead of a button. */
  href?: string;
}
export interface EmptyStateProps {
  /** What is missing, said plainly: "Nothing saved yet". */
  title: React.ReactNode;
  /** One or two lines on how it fills, in VIDYA's voice where it acts. */
  body?: React.ReactNode;
  /** A labelled sample of what will land here. label defaults to "Example". */
  example?: { title: React.ReactNode; meta?: React.ReactNode; label?: string };
  /** The action that fills the screen (primary, md). */
  primary?: EmptyStateAction;
  /** A quieter second action (secondary, md). */
  secondary?: EmptyStateAction;
  /** The orb's state. resting (default); offline when the emptiness is the network's. */
  orbState?: 'resting' | 'offline';
  /** Heading level of the title. Default 2 (the screen's <h1> is the ScreenHeader). */
  headingLevel?: 2 | 3 | 4;
  /** BCP 47 code when the copy is in an Indic language. */
  lang?: string;
  id?: string;
  className?: string;
  style?: React.CSSProperties;
  /** Extra content between the example and the actions. */
  children?: React.ReactNode;
}
export declare function EmptyState(props: EmptyStateProps): React.ReactElement;

export interface SheetProps {
  /** Default true. */
  open?: boolean;
  /** Escape, a scrim tap and any close action call this. */
  onClose?: () => void;
  /** Plain title (Bricolage 14/600), used as the dialog's name. */
  title?: React.ReactNode;
  /** A custom header row (e.g. orb + title + pill) drawn under the handle. Pass aria-labelledby or label to name the dialog. */
  header?: React.ReactNode;
  label?: string;
  'aria-labelledby'?: string;
  /** Default true: positioned inside the nearest positioned ancestor (a PhoneScreen). false: fixed to the viewport. */
  contained?: boolean;
  /** Default true: the 14% ink scrim. */
  scrim?: boolean;
  /** Default true. false for a non-modal sheet (VIDYA working while the teacher keeps using the app). */
  modal?: boolean;
  /** Focus the first control on open. Default true. */
  autoFocus?: boolean;
  role?: 'dialog' | 'alertdialog';
  className?: string;
  style?: React.CSSProperties;
  children?: React.ReactNode;
}
export declare function Sheet(props: SheetProps): React.ReactElement | null;

export interface DialogProps {
  /** Default true. */
  open?: boolean;
  /** Escape, the close button and a scrim click call this (an alertdialog's scrim does nothing). */
  onClose?: () => void;
  /** The dialog's name (Bricolage 600 19px), rendered as an h2. */
  title?: React.ReactNode;
  /** One or two sentences under the title; becomes aria-describedby. Say what will happen, not "Are you sure?". */
  description?: React.ReactNode;
  /** dialog (default) · alertdialog: a confirmation that needs an answer (no close button, the scrim does not dismiss). */
  role?: 'dialog' | 'alertdialog';
  /** md 520px (default) · sm 420px for confirmations. */
  size?: 'md' | 'sm';
  /** The buttons, right-aligned, primary last: Cancel then Revoke key. Mark the one to focus first with data-autofocus. */
  actions?: React.ReactNode;
  /** The close button. Default true for dialog, false for alertdialog. */
  showClose?: boolean;
  /** Accessible name of the close button. Default "Close". */
  closeLabel?: string;
  /** false: a scrim click does not close it (Escape still does). */
  dismissible?: boolean;
  /** Focus [data-autofocus], else the first control in the body, on open. Default true. */
  autoFocus?: boolean;
  /** Positioned inside the nearest positioned ancestor instead of the viewport (previews, a console pane). */
  contained?: boolean;
  /** Name the dialog without a visible title. */
  label?: string;
  'aria-labelledby'?: string;
  'aria-describedby'?: string;
  id?: string;
  lang?: string;
  className?: string;
  style?: React.CSSProperties;
  children?: React.ReactNode;
}
export declare function Dialog(props: DialogProps): React.ReactElement | null;

export interface TaskRowProps {
  /** Dot colour is meaning. red: urgent, absent · amber: queued, waiting · leaf: ready, done · saffron: VIDYA, pending · indigo: working, curriculum. Default saffron. */
  dot?: 'red' | 'amber' | 'leaf' | 'saffron' | 'indigo';
  /** What is waiting, with a real count ("4 absentees to call"). */
  label: React.ReactNode;
  /** The dot's meaning in words, read by screen readers after the label ("urgent", "ready"). Required unless `meta` already says it. */
  statusLabel?: string;
  /** A trailing status word in ink-600, 10px ("waiting"). Used on boxed rows. */
  meta?: React.ReactNode;
  /** The trailing text action, a short verb ("Open"). */
  action?: React.ReactNode;
  /** Makes only the action a button (touch area 44px). Its name reads "Open 4 absentees to call". */
  onAction?: (e: React.MouseEvent) => void;
  /** Makes the whole row one button; the action text is then part of it. */
  onClick?: (e: React.MouseEvent) => void;
  /** plain (default): a row inside a card, 10px apart. boxed: its own glass box, for queues (8px apart). */
  variant?: 'plain' | 'boxed';
  /** Render as a list item ('li') inside a consumer's <ul>. Default 'div'. */
  as?: 'div' | 'li';
  disabled?: boolean;
  lang?: string;
  id?: string;
  className?: string;
  style?: React.CSSProperties;
  children?: React.ReactNode;
}
export declare function TaskRow(props: TaskRowProps): React.ReactElement;

export interface SuggestionRowProps {
  /** The reading, as short metadata joined by middle dots ("Worksheet · 10 questions · हिन्दी"). */
  children: React.ReactNode;
  /** This reading is chosen. Keep exactly one row in a group selected (VIDYA's best guess first). */
  selected?: boolean;
  /** Called with `value` when the row is chosen by tap, Space, Enter or an arrow key. */
  onSelect?: (value: any) => void;
  /** Passed back to onSelect. */
  value?: any;
  onClick?: (e: React.MouseEvent) => void;
  onKeyDown?: (e: React.KeyboardEvent) => void;
  disabled?: boolean;
  /** Overrides the roving tab stop (selected row 0, others -1). */
  tabIndex?: number;
  lang?: string;
  id?: string;
  className?: string;
  style?: React.CSSProperties;
}
export declare function SuggestionRow(props: SuggestionRowProps): React.ReactElement;

export interface SettingsRowProps {
  /** The setting and its current value, joined by a middle dot ("Language · हिन्दी"). */
  label: React.ReactNode;
  /** A trailing text action, saffron-600 ("Change", "24 items"). Its name reads label then action. */
  action?: React.ReactNode;
  /** Runs the action (opens the picker or sheet). */
  onAction?: (e: React.MouseEvent) => void;
  /** Makes the action a link instead of a button. */
  href?: string;
  /** A status word when the row is read-only here ("On"). */
  status?: React.ReactNode;
  /** on (default): leaf-700 · off: ink-600. */
  statusTone?: 'on' | 'off';
  /** A control node (usually a Switch). If it has no name of its own it is labelled by the row's label. */
  control?: React.ReactElement;
  /** Render as a list item ('li') inside a consumer's <ul>. Default 'div'. */
  as?: 'div' | 'li';
  disabled?: boolean;
  lang?: string;
  /** Base id; the label gets `${id}-label`. */
  id?: string;
  className?: string;
  style?: React.CSSProperties;
}
export declare function SettingsRow(props: SettingsRowProps): React.ReactElement;

export interface DisclosureRowProps {
  /** "card" (default): glass row with title, subtitle and chevron. "toggle": bare text toggle for a hidden section. */
  variant?: 'card' | 'toggle';
  /** Card: the row's title ("Explore · 8 more tools"). Toggle: the label ("Show advanced options"). */
  title: React.ReactNode;
  /** Card only: one line under the title ("Field trips, visual aids, training"). */
  subtitle?: React.ReactNode;
  /** Toggle only: the label while open ("Hide advanced options"). Defaults to `title`. */
  expandedTitle?: React.ReactNode;
  /** Opens content in place: sets aria-expanded and turns the chevron. Leave undefined for a row that navigates. */
  expanded?: boolean;
  /** Id of the region `expanded` shows and hides (aria-controls). */
  controls?: string;
  onClick?: (e: React.MouseEvent) => void;
  /** Card only, without `expanded`: makes the row a link. */
  href?: string;
  disabled?: boolean;
  id?: string;
  /** Language of the text (BCP 47). */
  lang?: string;
  className?: string;
  style?: React.CSSProperties;
}
export declare function DisclosureRow(props: DisclosureRowProps): React.ReactElement;

export interface ChecklistStepProps {
  /** done: leaf check, leaf-700 text · active: breathing indigo ring, indigo text, aria-current="step" · pending (default): faint ring, ink-500 text. */
  status?: 'done' | 'active' | 'pending';
  /** The step in VIDYA's words, past tense when done ("Matched CBSE · NCERT Ganita Prakash 7, Chapter 8"), present when active ("Writing board work in हिन्दी"). */
  children: React.ReactNode;
  /** The status word for screen readers, translated. Default "done", "in progress", "not started". */
  statusLabel?: string;
  lang?: string;
  id?: string;
  className?: string;
  style?: React.CSSProperties;
}
export declare function ChecklistStep(props: ChecklistStepProps): React.ReactElement;

export type RosterStatus = 'present' | 'late' | 'absent' | 'unmarked';
export interface RosterRowProps {
  /** The roll number. */
  number: React.ReactNode;
  /** The student's name as the school writes it. */
  name: React.ReactNode;
  /** present: leaf row, white check on leaf · late: amber row, saffron-700 text, "L" on amber · absent: red row, red-700 text, cross on red · unmarked (default): glass row, empty ring. */
  status?: RosterStatus;
  /** The row being marked now: milk-50, 2px saffron edge, shadow-current, bold name and P / A buttons. One per list. */
  current?: boolean;
  /** Current row only. Called with 'present' or 'absent' when P or A is pressed, or 'unmarked' when the pressed one is pressed again. */
  onMark?: (status: RosterStatus) => void;
  /** Non-current rows: makes the whole row a button (e.g. to make it current and correct the mark). Its name reads "1, Aarav Sharma, present". */
  onClick?: (e: React.MouseEvent) => void;
  /** Translated status words for screen readers. Default present, late, absent, not marked. */
  statusLabels?: Partial<Record<RosterStatus, string>>;
  /** Translated names of the P and A buttons. Default Present, Absent. */
  markLabels?: { present?: string; absent?: string };
  /** The letter drawn on the late mark, translated. Default "L". */
  lateMark?: string;
  /** Default 'li': wrap rows in a <ul className="sk-rosterrow-list">. */
  as?: 'li' | 'div';
  disabled?: boolean;
  lang?: string;
  id?: string;
  className?: string;
  style?: React.CSSProperties;
}
export declare function RosterRow(props: RosterRowProps): React.ReactElement;

export type Tab = 'home' | 'library' | 'community' | 'profile';
export interface TabBarProps {
  /** The current destination; null shows none active. Default 'home'. */
  active?: Tab | null;
  /** fill: white icon on a saffron disc (normal). tint: saffron-600 icon on a 12% saffron disc (while the orb is dragged). */
  emphasis?: 'fill' | 'tint';
  /** light on every screen; camera on the scanner's dark ground. */
  tone?: 'light' | 'camera';
  /** Half opacity while the orb is being dragged (screen 03). */
  dimmed?: boolean;
  /** Accessible names, translated. Default Home, Library, Community, Profile. */
  labels?: Partial<Record<Tab, string>>;
  /** Render links instead of buttons. */
  hrefs?: Partial<Record<Tab, string>>;
  onChange?: (tab: Tab) => void;
  /** The nav landmark's name. Default "Main". */
  label?: string;
  className?: string;
}
export declare function TabBar(props: TabBarProps): React.ReactElement;

export type SideRailTab = 'home' | 'library' | 'community' | 'profile';
/** Every web app destination the default sidebar carries. */
export type SideRailItemId = SideRailTab
  | 'lesson-plan' | 'worksheet' | 'quiz' | 'exam-paper' | 'rubric' | 'instant-answer' | 'visual-aid'
  | 'attendance' | 'parent-calls' | 'scanner'
  | 'messages' | 'notifications'
  | 'video-storyteller' | 'virtual-field-trip' | 'teacher-training' | 'labs';
export interface SideRailItem {
  /** Stable id; `active` and `onChange` use it. A default id (e.g. 'quiz') inherits its label, short label and icon. */
  id: string;
  /** Full label, translated ("Lesson plan"). */
  label?: string;
  /** Rail label, one short word ("Lesson"). */
  short?: string;
  /** Glyph name from `SahayakAI.ICONS` or one this component adds. */
  icon?: string;
  /** Unread count, drawn as a saffron-600 badge and spoken as "3 unread". */
  count?: number;
  /** A short status word beside the label ("2 live"), on a leaf tint. Sidebar only. */
  badge?: string;
  href?: string;
}
export interface SideRailGroup {
  id: string;
  /** Visible group label ("Make", "Class"); also the list's accessible name. */
  label?: string;
  /** Keep the label for assistive tech only; a hairline separates the group instead. */
  hidden?: boolean;
  /** The label becomes a toggle (aria-expanded) and the group starts folded, unless it holds the active item. */
  collapsible?: boolean;
  /** Default ids or full items. */
  items: Array<SideRailItemId | SideRailItem>;
}
export interface SideRailProps {
  /** sidebar (default): 256px, desktop 1024px and wider · rail: 76px, tablet 768-1023px, icons over short labels. */
  mode?: 'sidebar' | 'rail';
  /** Legacy alias for mode="rail". */
  collapsed?: boolean;
  /** The current destination ('vidya' marks Talk to VIDYA); null shows none active. Default 'home'. */
  active?: SideRailItemId | 'vidya' | string | null;
  onChange?: (id: string) => void;
  /** Render links instead of buttons. */
  hrefs?: Partial<Record<SideRailItemId | string, string>>;
  /** Translated labels by item or group id ("make", "class"). A translated label is also the rail label unless shortLabels gives one. */
  labels?: Partial<Record<SideRailItemId | 'make' | 'class' | 'inbox' | 'main' | 'explore' | string, string>>;
  /** Translated rail labels. */
  shortLabels?: Partial<Record<SideRailItemId | string, string>>;
  /** Unread counts by item id, e.g. { messages: 3, notifications: 12 }. */
  counts?: Partial<Record<SideRailItemId | string, number>>;
  /** Spoken after a count. Default "{n} unread". */
  countLabel?: string;
  /** Which default groups to show: 'main' (the four destinations), 'make', 'class', 'inbox', 'explore' (Labs, folded). Default all five. ['main'] is the TabBar's set. */
  sections?: Array<'main' | 'make' | 'class' | 'inbox' | 'explore'>;
  /** Collapsible groups to start open, by id ({ explore: true }). */
  defaultOpen?: Partial<Record<string, boolean>>;
  /** Replace the default groups entirely (the school console passes its own). */
  groups?: SideRailGroup[];
  /** false hides the Talk to VIDYA entry. Default true. */
  vidya?: boolean;
  onVidya?: () => void;
  vidyaHref?: string;
  /** Default "Talk to VIDYA". */
  vidyaLabel?: string;
  /** The line under it. Default "Speak or type, any language"; false hides it. */
  vidyaHint?: string | false;
  /** The rail's word under the orb. Default "VIDYA". */
  vidyaShort?: string;
  /** The wordmark beside the orb mark. Default "SahayakAI". */
  brand?: string;
  /** Drawn under the brand (the console's school switcher). */
  top?: React.ReactNode;
  /** Pinned to the foot (the console's calling-mode card). */
  footer?: React.ReactNode;
  /** The nav landmark's name. Default "Main". */
  label?: string;
  /** BCP 47 code when the labels are in an Indic language. */
  lang?: string;
  id?: string;
  className?: string;
  /** Give it a height (e.g. calc(100vh - 24px)) so the groups scroll inside it. */
  style?: React.CSSProperties;
}
export declare function SideRail(props: SideRailProps): React.ReactElement;

export interface TopBarCrumb {
  /** Translated label ("Make", "Lesson plan"). The last crumb is the current page. */
  label: React.ReactNode;
  href?: string;
  onClick?: () => void;
}
export interface TopBarUser {
  /** The teacher's full name; gives the initials and the button's name. */
  name: string;
  initials?: string;
  /** A photo URL. */
  src?: string;
}
export interface TopBarProps {
  /** The page title (Bricolage 600 20px). Ignored when breadcrumb is given. */
  title?: React.ReactNode;
  /** Render the title as the page's h1 when the page has no other. Default 'div'. */
  titleAs?: 'div' | 'h1' | 'h2';
  /** Where the page sits ("Make / Lesson plan"). The last crumb is the page, with aria-current. */
  breadcrumb?: TopBarCrumb[];
  /** The breadcrumb landmark's name. Default "Breadcrumb". */
  breadcrumbLabel?: string;
  /** false hides search. Default shown. */
  search?: boolean;
  /** Placeholder and accessible name. Default "Search or ask VIDYA". */
  searchLabel?: string;
  /** Opens the command palette. Also bound to ⌘K / Ctrl+K while the bar is mounted. */
  onSearch?: () => void;
  /** The shortcut hint; null hides it and unbinds the key. Default "⌘K". */
  shortcut?: string | null;
  /** The teaching language in its own script ("हिन्दी"), a saffron-600 glass pill. */
  language?: string;
  /** BCP 47 code of the language label ("hi"). */
  languageLang?: string;
  /** Opens the LanguagePicker. */
  onLanguage?: () => void;
  /** Default "Language: <language>. Change". */
  languageLabel?: string;
  /** The board's short name ("CBSE", "ICSE / ISC", "KSEEB"), an indigo pill that opens BoardSwitch. Omit on the school console. */
  board?: string;
  /** The board pill's letter. Default its first letter. */
  boardMark?: string;
  onBoard?: () => void;
  /** Default "Board: <board>. Change". */
  boardLabel?: string;
  /** Unread notifications; 0 shows the bell without a count. */
  notifications?: number;
  onNotifications?: () => void;
  /** Default "Notifications". */
  notificationsLabel?: string;
  /** Spoken after the count. Default "{n} unread". */
  countLabel?: string;
  /** The signed-in teacher; a 44px button around a glass avatar. */
  user?: TopBarUser;
  onUser?: () => void;
  /** Default "Account: <name>". */
  userLabel?: string;
  /** clear (default) over the page wash · glass once content scrolls under a sticky bar. */
  surface?: 'clear' | 'glass';
  /** Extra controls, drawn after search. */
  children?: React.ReactNode;
  lang?: string;
  className?: string;
  style?: React.CSSProperties;
}
export declare function TopBar(props: TopBarProps): React.ReactElement;

export interface ScreenHeaderGreeting {
  /** The teacher's name, in the display face. */
  name: string;
  /** Today, e.g. "Tue, 18 Sept". */
  date?: string;
  /** Avatar initials. Default: from the name. */
  initials?: string;
  /** The app language, shown as a glass pill on the right ("हिन्दी"). */
  language?: string;
  /** BCP 47 code of the language label ("hi"). */
  languageLang?: string;
  /** Makes the language pill a button that opens the LanguagePicker. */
  onLanguage?: () => void;
  /** Accessible name of the language button. Default "Language: <language>. Change". */
  languageLabel?: string;
}
export interface ScreenHeaderProps {
  /** The screen's <h1>. A node, so a two-line Home title can carry a <br>. */
  title?: React.ReactNode;
  /** The subline under the title: "Spoken or typed — same result", "Tue 18 Sept · 38 students". */
  subtitle?: React.ReactNode;
  /** screen 26/700 (Home, may run two lines) · page 22/700 (default: tools, lists) · output 20/1.22 (a generated lesson, quiz or call). */
  level?: 'screen' | 'page' | 'output';
  /** Right-hand status, usually a Pill ("34 present", "On call · 1:12"). */
  trailing?: React.ReactNode;
  /** Trailing alignment: center (default) or end (on the subline's baseline). */
  align?: 'center' | 'end';
  /** The Home greeting row above the title: avatar, date, name, language pill. */
  greeting?: ScreenHeaderGreeting;
  /** Shows a 36px back disc before the title (deep screens only). */
  onBack?: () => void;
  /** Accessible name of the back disc. Default "Back". */
  backLabel?: string;
  /** BCP 47 code when the title and subline are in an Indic language. */
  lang?: string;
  className?: string;
  style?: React.CSSProperties;
}
export declare function ScreenHeader(props: ScreenHeaderProps): React.ReactElement;

export interface StatusBarProps {
  /** Clock text. Default "9:41". */
  time?: string;
  /** Network text, tracked .14em. Default "lte" followed by a drawn battery bar; "no signal" when offline (no battery). */
  network?: string;
  /** light on every wash; camera on the scanner's dark ground (milk at 70%). */
  tone?: 'light' | 'camera';
  className?: string;
  style?: React.CSSProperties;
}
export declare function StatusBar(props: StatusBarProps): React.ReactElement;

export type OrbState = 'resting' | 'dragging' | 'listening' | 'working' | 'ready' | 'offline';
export interface OrbProps {
  /** resting: parked, floats, tap to talk · dragging: lifted, snaps to six perches · listening: pulses, the page stays visible · working: indigo, keeps working off-screen · ready: leaf with a count badge, tap to deliver · offline: stone grey, voice paused while typing still works. */
  state?: OrbState;
  /** Diameter in px. 56 parked · 60 onboarding · 46 in a sheet header · 36 in the deliver tray · 48 in legends. */
  size?: number;
  /** Outputs waiting (ready only). */
  badge?: number;
  /** camera: the lifted shadow for the scanner's dark ground. */
  tone?: 'light' | 'camera';
  /** Stops the float/pulse (motion still stops under prefers-reduced-motion). */
  still?: boolean;
  /** Makes the orb a button. */
  onClick?: () => void;
  /** Accessible name; defaults to "VIDYA, <state>". */
  label?: string;
  /** Hide from assistive tech when a visible label already says the state. */
  decorative?: boolean;
  className?: string;
  style?: React.CSSProperties;
}
export declare function Orb(props: OrbProps): React.ReactElement;

export interface OrbHintProps {
  /** What a tap does here, in a few words: "Tap to speak", "Typing still works", "Turn this post into a worksheet". Translated. Default "Tap to speak". */
  label?: string;
  /** right: orb on the right, capsule to its left (default, right hand) · left: orb on the left, capsule to its right (left hand). */
  side?: 'right' | 'left';
  /** default: muted capsule · strong: ink text, raised, for an offer VIDYA makes from the page (Community). */
  tone?: 'default' | 'strong';
  /** The orb's state. Default resting. */
  state?: 'resting' | 'listening' | 'working' | 'ready' | 'offline';
  /** Outputs waiting (ready only). */
  badge?: number;
  /** Makes the orb a button; the capsule becomes its description (aria-describedby). */
  onClick?: () => void;
  /** The orb's accessible name. Default "VIDYA". */
  orbLabel?: string;
  /** Applies the park placement: true = right 16 / bottom 100 (left 18 when side is left); 'cta' = bottom 172 above a full-width CTA. */
  parked?: boolean | 'cta';
  /** BCP 47 code when the label is in an Indic language. */
  lang?: string;
  id?: string;
  className?: string;
  style?: React.CSSProperties;
}
export declare function OrbHint(props: OrbHintProps): React.ReactElement;

export interface OrbPromptAction {
  /** A short verb, translated: "Build it", "Message parents". */
  label: string;
  onClick?: () => void;
}
export interface OrbPromptProps {
  /** VIDYA's offer, first person, one sentence, from what is on the page: "I can build a remedial worksheet for the 4 weak concepts." */
  message: React.ReactNode;
  /** The offer itself (saffron, xs). */
  primary?: OrbPromptAction;
  /** The alternative (saffron outline, xs). */
  secondary?: OrbPromptAction;
  /** The orb beside the card. Default resting. */
  orbState?: 'resting' | 'working' | 'ready' | 'offline';
  /** Makes the orb a button (opens the voice sheet). */
  onOrb?: () => void;
  /** The orb's accessible name. Default "VIDYA, <state>". */
  orbLabel?: string;
  /** Shows a close control and makes Escape dismiss the offer. */
  onDismiss?: () => void;
  /** Accessible name of the close control. Default "Not now". */
  dismissLabel?: string;
  /** Static placement (docs); default is absolute, left 16 / right 16 / bottom 78 over the tab bar. */
  inline?: boolean;
  /** BCP 47 code when the message is in an Indic language. */
  lang?: string;
  id?: string;
  className?: string;
  style?: React.CSSProperties;
}
export declare function OrbPrompt(props: OrbPromptProps): React.ReactElement;

export interface SpeakCardProps {
  /** "idle" (default): the well breathes. "listening": the well stays lit and follows `level`. "offline": the mic is off and typing is offered. */
  state?: 'idle' | 'listening' | 'offline';
  /** Overrides the state's title ("Tap and speak", "Listening · हिन्दी", "Voice needs a signal"). */
  title?: React.ReactNode;
  /** What the teacher might say, without quotes ("Class 5 fractions revision sheet"); shown in curly quotes. */
  example?: string;
  /** Listening only: the live transcript, announced politely as it grows. */
  transcript?: React.ReactNode;
  /** Listening only: the language being heard, added to the title ("हिन्दी"). */
  language?: string;
  /** Listening only: live mic level, 0 to 1; swells the well. Still under reduced motion. */
  level?: number;
  /** The typed way in. Default "Or type a topic" ("Type a topic" offline). */
  typeLabel?: React.ReactNode;
  /** Accessible name of the mic when idle. Default "Tap and speak". */
  micLabel?: string;
  /** Accessible name of the mic while listening. Default "Stop listening". */
  stopLabel?: string;
  /** Offline only: the line under the title. Default "Typing works without one". */
  offlineHint?: React.ReactNode;
  /** Called when the mic (or anywhere on the card) is tapped. */
  onSpeak?: (e: React.MouseEvent) => void;
  /** Called when "Or type a topic" is tapped. */
  onType?: (e: React.MouseEvent) => void;
  id?: string;
  /** Language of the card's text (BCP 47). */
  lang?: string;
  className?: string;
  style?: React.CSSProperties;
}
export declare function SpeakCard(props: SpeakCardProps): React.ReactElement;

export interface VoiceSheetProps {
  /** listening: modal over a 14% scrim, the orb pulses in its halo, "Mic on" shows · working: non-modal with no scrim, the indigo orb, and Minimise / Stop. Default listening. */
  state?: 'listening' | 'working';
  /** Default true. */
  open?: boolean;
  /** Escape and a scrim tap (listening) call this. */
  onClose?: () => void;
  /** Default "Listening" or "Writing your lesson". Names the dialog. */
  title?: React.ReactNode;
  /** One line under the title: "हिन्दी · about the page behind me", "Keep using the app — I’ll finish in the background". */
  subtitle?: React.ReactNode;
  /** What VIDYA reads from the page behind: "Working with Fractions · Class 7 · CBSE". */
  context?: React.ReactNode;
  /** The context card's eyebrow. Default "This page". */
  contextLabel?: string;
  /** What the teacher said, shown in quotes in the display face. */
  transcript?: React.ReactNode;
  /** BCP 47 code of the transcript ("hi"). */
  transcriptLang?: string;
  /** Visible status word while listening. Default "Mic on"; false hides it. */
  micLabel?: string | false;
  /** Listening: shows a quiet "Keep talking" pill under the titles that grows ask-in-place into VIDYA Live, full screen. Holding the orb stays reserved for dragging it. */
  onKeepTalking?: () => void;
  /** Default "Keep talking". */
  keepTalkingLabel?: string;
  /** Working: tucks the sheet into the orb; the work carries on. */
  onMinimise?: () => void;
  /** Working: stops the generation. */
  onStop?: () => void;
  minimiseLabel?: string;
  stopLabel?: string;
  /** Focus the first control on open. Default true while listening, false while working (the teacher keeps their place). */
  autoFocus?: boolean;
  /** Default true: inside the nearest positioned screen. */
  contained?: boolean;
  /** BCP 47 code of the header copy. */
  lang?: string;
  id?: string;
  className?: string;
  style?: React.CSSProperties;
  /** SuggestionRows and a Composer (listening); ChecklistSteps, the draft and progress (working). */
  children?: React.ReactNode;
}
export declare function VoiceSheet(props: VoiceSheetProps): React.ReactElement | null;

export interface DeliverOption {
  id: string;
  /** "Parent group", "Print", "Save to class". */
  title: string;
  /** The fact under it: "WhatsApp · 34", "A4 · 34 copies". */
  sub?: string;
  /** The send label when this is the only choice: "Send to parent group". */
  action?: string;
}
export interface DeliverTrayProps {
  /** Default true. */
  open?: boolean;
  onClose?: () => void;
  /** Default "Deliver". Names the dialog. */
  title?: string;
  /** What is being delivered: "Lesson plan + worksheet · हिन्दी". */
  subtitle?: React.ReactNode;
  /** Default: Parent group, Print, Save to class, Post to Community, Download PDF, Read aloud. */
  options?: DeliverOption[];
  /** Controlled selection (option ids). */
  selected?: string[];
  /** Uncontrolled starting selection. Default: the first option. */
  defaultSelected?: string[];
  onChange?: (ids: string[]) => void;
  /** The send. Receives the selected ids. */
  onDeliver?: (ids: string[]) => void;
  /** The saffron pill in the header. Default "Preview"; false hides it. */
  previewLabel?: string | false;
  /** Makes the Preview pill a button. */
  onPreview?: () => void;
  /** The promise above the send. Default "Nothing leaves the phone until you tap send."; false hides it. */
  note?: string | false;
  /** Send label for several ways. Default n => "Deliver n ways". */
  manyLabel?: (n: number) => string;
  /** Disabled send label when nothing is chosen. Default "Choose a way to deliver". */
  emptyLabel?: string;
  /** Accessible name of the option group. Default "Deliver to". */
  groupLabel?: string;
  autoFocus?: boolean;
  /** Default true: inside the nearest positioned screen. */
  contained?: boolean;
  /** BCP 47 code when the copy is in an Indic language. */
  lang?: string;
  id?: string;
  className?: string;
  style?: React.CSSProperties;
}
export declare function DeliverTray(props: DeliverTrayProps): React.ReactElement | null;

export interface ReadbackBarText {
  /** Eyebrow while reading. Default "Reading back". */
  reading?: string;
  /** Eyebrow while paused. Default "Paused". */
  paused?: string;
  /** How step and total are joined. Default "{step} of {total}"; Hindi "{total} में से {step}". */
  where?: string;
  /** The disc's name while reading. Default "Pause reading". */
  pause?: string;
  /** The disc's name while paused. Default "Resume reading". */
  play?: string;
  /** The region's name. Default "Read-back". */
  region?: string;
}
export interface ReadbackBarProps {
  /** The line VIDYA is saying now, without quote marks ("Draw one loop, label four stages."). */
  quote: React.ReactNode;
  /** Which part she is reading (2). */
  step?: number;
  /** How many parts there are (4). */
  total?: number;
  /** Controlled: true while VIDYA reads. Pair with onToggle. */
  playing?: boolean;
  /** Uncontrolled: start reading (default) or paused. */
  defaultPlaying?: boolean;
  /** Called with the next state when the disc is pressed. */
  onToggle?: (playing: boolean) => void;
  /** Translated eyebrow words and control names. */
  text?: ReadbackBarText;
  disabled?: boolean;
  id?: string;
  /** The language of the quote and labels (sets lang). */
  lang?: string;
  className?: string;
  style?: React.CSSProperties;
}
export declare function ReadbackBar(props: ReadbackBarProps): React.ReactElement;

export type LiveOrbState = 'resting' | 'connecting' | 'listening' | 'working' | 'speaking' | 'paused' | 'failed' | 'offline';
export interface LiveOrbProps {
  /** connecting: indigo, slow breath · listening: 164px saffron sphere in a breathing halo that swells with the mic · working: 118px indigo sphere inside a turning 3px arc · speaking: 118px leaf sphere with two breathing rings that follow VIDYA's voice · paused: the speaking sphere, still, no rings · offline: stone, still · resting and failed: the web presence only (at rest; desaturated after a failure). Default listening. */
  state?: LiveOrbState;
  /** Live level 0-1: the teacher's mic while listening, VIDYA's output while speaking. Ignored in other states. */
  level?: number;
  /** Called once a frame while listening or speaking; returns 0-1. Eased (quick attack, soft release) and written to --sk-live-level without re-rendering; paused off-screen, in a hidden tab and under reduced motion. Overrides `level`. */
  getLevel?: () => number;
  /** live (default): the phone screen · hero: landing page, 1.25x · workspace: signed-in home, 1.1x · compact: the 64px web dock. */
  size?: 'live' | 'hero' | 'workspace' | 'compact';
  /** Makes the orb a real button (start or end the conversation), with aria-pressed. */
  onClick?: () => void;
  /** As a button: its accessible name, kept constant ("Talk to VIDYA"). As an image: overrides "VIDYA is listening" and the other state names. */
  label?: string;
  /** As a button: whether a conversation is on. Default: true in every state but resting, failed and offline. */
  pressed?: boolean;
  disabled?: boolean;
  /** Stops every motion (reduced motion already does). */
  still?: boolean;
  /** Hide from assistive tech when a visible LiveStatus beside it already names the state. */
  decorative?: boolean;
  id?: string;
  className?: string;
  style?: React.CSSProperties;
}
export declare function LiveOrb(props: LiveOrbProps): React.ReactElement;

export type LiveStatusState = 'resting' | 'connecting' | 'listening' | 'working' | 'speaking' | 'paused' | 'failed' | 'offline';
export interface LiveStatusProps {
  /** Picks the tone and the default words: resting "Tap to talk" (glass), connecting "Connecting" (indigo tint), listening "Listening" (saffron tint), working "Working" (solid indigo), speaking "Speaking" (solid leaf), paused "Paused" (leaf tint), failed "Couldn’t hear" (solid red), offline "No signal · typing works" (stone tint). Default listening. */
  state?: LiveStatusState;
  /** The words, translated and specific ("Checking CBSE source"). Defaults to the state's word. */
  label?: React.ReactNode;
  /** Same as label. */
  children?: React.ReactNode;
  /** The conversation's language, shown after a middle dot ("हिन्दी"). */
  language?: string;
  /** BCP 47 code of `language` ("hi"). */
  languageLang?: string;
  /** BCP 47 code of the label when it is not the page's language. */
  lang?: string;
  /** app (default): 11px, the phone header · web: 13px, the web presence. */
  size?: 'app' | 'web';
  id?: string;
  className?: string;
  style?: React.CSSProperties;
}
export declare function LiveStatus(props: LiveStatusProps): React.ReactElement;

export interface LiveHeaderProps {
  /** The screen's heading. Default "VIDYA". */
  title?: string;
  /** Shows the back disc: collapses Live back into the ask-in-place sheet. */
  onBack?: () => void;
  /** The back disc's accessible name. Default "Back to the sheet". */
  backLabel?: string;
  /** The LiveStatus pill at the end of the row. */
  status?: React.ReactNode;
  lang?: string;
  id?: string;
  className?: string;
  style?: React.CSSProperties;
  /** Minutes of VIDYA Live left. Pass only near the end (5 or fewer); shows a quiet amber pill. */
  minutesLeft?: number;
  /** The pill's text in the teacher's language. Default "<n> min left". */
  minutesText?: string;
}
export declare function LiveHeader(props: LiveHeaderProps): React.ReactElement;

/** A span the connection lost; drawn as the lost label in red. */
export interface LiveTranscriptLost { lost: true; /** Overrides lostLabel for this span. */ label?: string; }
export interface LiveTranscriptProps {
  /** live (default): "You are saying", with a caret until final · caught: "What I caught", quoted, lost spans in red. */
  variant?: 'live' | 'caught';
  /** The words: a string, or strings mixed with { lost: true } spans. Or pass children. */
  text?: React.ReactNode | Array<React.ReactNode | LiveTranscriptLost>;
  children?: React.ReactNode;
  /** The turn is over: the caret goes. */
  final?: boolean;
  /** Eyebrow, translated. Defaults to "You are saying" or "What I caught". */
  label?: string;
  labelLang?: string;
  /** Shown for each lost span. Default "[lost]". */
  lostLabel?: string;
  /** BCP 47 code of the words ("hi"). */
  lang?: string;
  id?: string;
  className?: string;
  style?: React.CSSProperties;
}
export declare function LiveTranscript(props: LiveTranscriptProps): React.ReactElement;

export interface LiveCaptionProps {
  /** The line VIDYA is saying now. Or pass children. */
  text?: React.ReactNode;
  children?: React.ReactNode;
  /** Builds the eyebrow "Caption · step 2 of 6". */
  step?: number;
  total?: number;
  /** Overrides the eyebrow, translated. */
  label?: string;
  labelLang?: string;
  /** Wraps the line in curly quotes. Default true. */
  quoted?: boolean;
  /** The source she said aloud first, as a leaf note under the card ("Source spoken aloud first: ‘based on CBSE · NCERT Curiosity 6, Chapter 8.’"). */
  source?: React.ReactNode;
  sourceLang?: string;
  /** BCP 47 code of the line. */
  lang?: string;
  id?: string;
  className?: string;
  style?: React.CSSProperties;
}
export declare function LiveCaption(props: LiveCaptionProps): React.ReactElement;

export interface LiveReceipt {
  /** done: leaf disc with a check · current: indigo ring, indigo words · pending: faint ring. */
  status: 'done' | 'current' | 'pending';
  /** Board-aware and specific ("Matched CBSE · NCERT Curiosity 6, Ch 8"). */
  label: React.ReactNode;
  /** Spoken after the label. Defaults to "done", "in progress", "not started". */
  statusLabel?: string;
  lang?: string;
  key?: string;
}
export interface LiveOffer {
  /** "Make a worksheet". Drawn after a plus glyph (a check once added). */
  label: React.ReactNode;
  onClick?: () => void;
  /** When set, the offer is a toggle (aria-pressed): true once the teacher has asked for it. */
  added?: boolean;
  disabled?: boolean;
  lang?: string;
  key?: string;
}
export interface LiveReceiptsProps {
  /** The receipts, in order. */
  items: LiveReceipt[];
  /** Extra work she will do only if tapped. Omit for no offers card. */
  offers?: LiveOffer[];
  /** The list's accessible name. Default "What I have done so far". */
  label?: string;
  /** Default "I’ll also do these if you tap". */
  offersLabel?: string;
  /** Default "Nothing paid runs until you tap it." */
  offersNote?: string;
  lang?: string;
  id?: string;
  className?: string;
  style?: React.CSSProperties;
}
export declare function LiveReceipts(props: LiveReceiptsProps): React.ReactElement;

export interface LiveControlsProps {
  /** listening: Type · Mute · End discs · working: one wide Stop · speaking: Pause or Resume, plus End · failed: a mic disc plus the primary action. Default listening. */
  mode?: 'listening' | 'working' | 'speaking' | 'failed';
  /** listening: switch to typing. */
  onType?: () => void;
  /** listening: toggles the mic. */
  onMute?: () => void;
  /** listening: the Mute disc's pressed state. */
  muted?: boolean;
  /** listening and speaking: end the conversation and return to the page it started from. */
  onEnd?: () => void;
  /** working: stop the work in progress. */
  onStop?: () => void;
  /** speaking: shows Resume instead of Pause. */
  paused?: boolean;
  onPause?: () => void;
  onResume?: () => void;
  /** failed: try voice again. */
  onMic?: () => void;
  micDisabled?: boolean;
  /** failed: the primary action that finishes the task typed ("Make the quiz"). */
  ctaLabel?: string;
  onCta?: () => void;
  ctaDisabled?: boolean;
  /** Translated labels. Defaults: Type, Mute, End conversation, Stop, Pause, Resume, Try voice again. */
  typeLabel?: string;
  muteLabel?: string;
  endLabel?: string;
  stopLabel?: string;
  pauseLabel?: string;
  resumeLabel?: string;
  micLabel?: string;
  /** The group's accessible name. Default "Conversation controls". */
  label?: string;
  lang?: string;
  id?: string;
  className?: string;
  style?: React.CSSProperties;
}
export declare function LiveControls(props: LiveControlsProps): React.ReactElement;

export interface LiveErrorProps {
  /** First person, what happened ("I couldn’t hear that clearly"). */
  title?: string;
  /** What she kept and what happens next. Or pass children. */
  body?: React.ReactNode;
  children?: React.ReactNode;
  /** Default "alert" (announced once). Use "note" when it is already on screen. */
  role?: string;
  /** Heading level of the title, 2-6. Default 2. */
  headingLevel?: number;
  lang?: string;
  id?: string;
  className?: string;
  style?: React.CSSProperties;
}
export declare function LiveError(props: LiveErrorProps): React.ReactElement;

export type VidyaPresenceState = 'resting' | 'connecting' | 'listening' | 'working' | 'speaking' | 'paused' | 'failed' | 'offline';
export interface VidyaPresenceStarter { label: string; lang?: string; onClick?: () => void; key?: string; }
export interface VidyaPresenceProps {
  /** hero: the landing page · workspace: the signed-in home · compact: the dock on tool pages. Default hero. */
  size?: 'hero' | 'workspace' | 'compact';
  /** The live session's state. Map the session's own: idle and ended to resting, interrupted to listening, thinking to working, error to failed. Default resting. */
  state?: VidyaPresenceState;
  /** Called once a frame while listening or speaking; returns the real mic or output level, 0-1. */
  getLevel?: () => number;
  /** A fixed level instead of getLevel. */
  level?: number;
  /** The orb is the button: start the conversation at rest, end it while live, retry after a failure. */
  onActivate?: () => void;
  /** Shows End beside the pill (an × disc in compact) while a conversation is on. */
  onEnd?: () => void;
  /** The orb button's constant name. Default "Talk to VIDYA". */
  label?: string;
  /** Overrides the pill's words. At rest: "Meet VIDYA, tap and talk" (hero), "Tap to talk" (workspace). */
  statusLabel?: string;
  /** Default "End". */
  endLabel?: string;
  /** The End control's full accessible name. Default "End conversation" in compact. */
  endConversationLabel?: string;
  /** The conversation's language in the pill ("हिन्दी"). */
  language?: string;
  languageLang?: string;
  /** The latest line of the conversation; pass the tail of a long turn. */
  caption?: string;
  /** Whose line it is. teacher lines are quoted; in compact they read "You:", VIDYA's read "VIDYA:". Default vidya. */
  captionRole?: 'vidya' | 'teacher';
  captionLang?: string;
  /** Translated "You". */
  youLabel?: string;
  /** workspace: quiet starters, spoken into the same conversation. */
  starters?: Array<string | VidyaPresenceStarter>;
  onStarter?: (label: string, starter: VidyaPresenceStarter) => void;
  /** The starters list's name. Default "Things to ask VIDYA". */
  startersLabel?: string;
  /** hero: up to four capability words floating round the orb (decoration, hidden from assistive tech). */
  words?: string[];
  disabled?: boolean;
  id?: string;
  className?: string;
  style?: React.CSSProperties;
}
export declare function VidyaPresence(props: VidyaPresenceProps): React.ReactElement;

export interface ChatHeaderProps {
  /** The screen's <h1>, centred. Default "VIDYA". */
  title?: React.ReactNode;
  /** Shows the back disc (the back glyph). */
  onBack?: () => void;
  /** Accessible name of the back disc. Default "Back". */
  backLabel?: string;
  /** Shows the settings disc (the settings glyph): language, voice, what VIDYA may read. */
  onSettings?: () => void;
  /** Accessible name of the settings disc. Default "Conversation settings". */
  settingsLabel?: string;
  /** Replaces the settings disc, e.g. a status Pill. Keep it 40px wide or the title shifts. */
  trailing?: React.ReactNode;
  /** Language of the title (BCP 47). */
  lang?: string;
  id?: string;
  className?: string;
  style?: React.CSSProperties;
}
export declare function ChatHeader(props: ChatHeaderProps): React.ReactElement;

export interface ChatBubbleProps {
  /** Who spoke. teacher: saffron bubble on the right · vidya: glass bubble on the left beside VIDYA's orb. */
  from: 'teacher' | 'vidya';
  /** The message, as typed or as transcribed from voice. */
  children: React.ReactNode;
  /** Teacher only: initials for the 28px glass disc ("MK"). Default: from `name`. */
  initials?: string;
  /** Teacher only: the teacher's name, for the initials. */
  name?: string;
  /** Show the 28px mark. Default: always for VIDYA; for the teacher only when `initials` or `name` is given. In a run of VIDYA turns, pass false on all but the last: her column keeps its indent. */
  avatar?: boolean;
  /** Hidden sender prefix read before the text. Default "You" or "VIDYA" (translate it). */
  senderLabel?: string;
  /** Language of the message (BCP 47): "hi", or "hi-Latn" for Hindi typed in Latin letters. */
  lang?: string;
  id?: string;
  className?: string;
  style?: React.CSSProperties;
}
export declare function ChatBubble(props: ChatBubbleProps): React.ReactElement;

export interface AnswerCardProps {
  /** VIDYA's reply, in the first person, one to three sentences: what is ready and what is in it. */
  children: React.ReactNode;
  /** Provenance, board-aware: "CBSE · NCERT Curiosity 6, Ch 8", "Karnataka State Board (KSEEB) · Class 7, Ch 8", or "Source stated aloud" after a voice turn. Shown as a leaf chip with a dot. Omit when nothing was grounded. */
  source?: string;
  /** What the result is ("Water cycle lesson plan · Class 6"). Names the action group and the Open and Again buttons for assistive tech. */
  resultName?: string;
  /** Shows "Open", the one small saffron pill: open the result on its own screen. */
  onOpen?: () => void;
  /** Shows "Read aloud", a quiet toggle pill. */
  onReadAloud?: () => void;
  /** VIDYA is reading this answer aloud: Read aloud turns leaf and is pressed. */
  reading?: boolean;
  /** Shows "Again", a quiet pill: make it again with the same request. */
  onAgain?: () => void;
  /** Translated labels. Defaults "Open", "Read aloud", "Again". */
  openLabel?: string;
  readAloudLabel?: string;
  againLabel?: string;
  /** Accessible name of the action group. Default "<resultName>, actions". */
  actionsLabel?: string;
  /** Show VIDYA's 28px orb. Default true. */
  avatar?: boolean;
  /** Hidden sender prefix. Default "VIDYA". */
  senderLabel?: string;
  /** Language of the reply (BCP 47). */
  lang?: string;
  /** Language of the source line when it differs. */
  sourceLang?: string;
  id?: string;
  className?: string;
  style?: React.CSSProperties;
}
export declare function AnswerCard(props: AnswerCardProps): React.ReactElement;

export interface TypingIndicatorProps {
  /** The status read to assistive tech. Default "VIDYA is writing" (translate it; name the job when known: "VIDYA is writing the worksheet"). */
  label?: string;
  /** Show VIDYA's 28px orb. Default true. false keeps the indent (the orb already shows on the turn below). */
  avatar?: boolean;
  id?: string;
  className?: string;
  style?: React.CSSProperties;
}
export declare function TypingIndicator(props: TypingIndicatorProps): React.ReactElement;

export interface ChatThreadRefineItem {
  /** One to three words, translated: "Make it easier", "In Marathi", "Add a diagram". */
  label: string;
  /** Passed to onRefine instead of the label. */
  value?: any;
  /** Language of the label when it differs from the page. */
  lang?: string;
}
export interface ChatThreadProps {
  /** The turns, oldest first: ChatBubble, AnswerCard and, while VIDYA writes, one TypingIndicator last. */
  children?: React.ReactNode;
  /** The day chip at the top of the thread ("Today", "Yesterday", "Mon, 21 Oct"). */
  day?: string;
  dayLang?: string;
  /** Refine chips under the last turn, as labels or items. They act on VIDYA's last answer. */
  refine?: Array<string | ChatThreadRefineItem>;
  /** Called with the chip's value (or label). Usually sends it as the teacher's next turn. */
  onRefine?: (value: any) => void;
  /** Accessible name of the chip row. Default "Change the last answer". */
  refineLabel?: string;
  /** Accessible name of the log. Default "Conversation with VIDYA". */
  label?: string;
  /** Keep the newest turn in view as turns are added. Default true. */
  autoScroll?: boolean;
  id?: string;
  className?: string;
  style?: React.CSSProperties;
}
export declare function ChatThread(props: ChatThreadProps): React.ReactElement;

export interface ArtifactFact {
  /** The pill text ("Class 7", "40 min", "CBSE · NCERT Ch 8", "हिन्दी"). */
  label: React.ReactNode;
  /** leaf: class facts (class, length) · indigo: curriculum and board · amber: language · saffron: preview or pending. */
  tone?: 'leaf' | 'indigo' | 'amber' | 'saffron';
  lang?: string;
  key?: string;
}
export interface ArtifactSection {
  /** "Hook · 5 min". Translated. */
  title: React.ReactNode;
  /** The section's reading text (or a node: a list, a table). */
  body: React.ReactNode;
  lang?: string;
  key?: string;
}
export interface ArtifactFrameProps {
  /** The artifact's name, rendered as the page's <h1> ("Fractions in everyday cooking"). */
  title: React.ReactNode;
  /** Fact pills under the title: class, length, board-aware curriculum, language. */
  meta?: ArtifactFact[];
  /** Accessible name of the pill list. Default "About this lesson". */
  metaLabel?: string;
  /** The section tiles, in teaching order. */
  sections?: ArtifactSection[];
  /** While VIDYA is still writing: the sections announce politely, a pending tile shows, and Deliver is disabled. */
  streaming?: boolean;
  /** The pending tile's words. Default "Writing the next section…". */
  streamingLabel?: string;
  /** What the artifact is grounded in ("Grounded in CBSE · NCERT Ganita Prakash 7, Chapter 8."). Shown before the disclosure, never instead of it. */
  provenance?: React.ReactNode;
  /** The AI disclosure. Always shown. Default "VIDYA drafts; you check it before you teach." Pass a translation, never an empty string. */
  disclosure?: React.ReactNode;
  /** Primary button text. Default "Deliver". */
  deliverLabel?: React.ReactNode;
  onDeliver?: () => void;
  /** Secondary button text, default "Edit"; false hides it. */
  editLabel?: React.ReactNode | false;
  onEdit?: () => void;
  /** Replaces the Deliver / Edit pair (for example "Deliver" + "Answer key"). null renders no footer. */
  footer?: React.ReactNode;
  /** Fill a phone screen: the sections scroll and the last tile stretches to the footer. */
  fill?: boolean;
  id?: string;
  lang?: string;
  className?: string;
  style?: React.CSSProperties;
}
export declare function ArtifactFrame(props: ArtifactFrameProps): React.ReactElement;

export type ActionBarKey = 'copy' | 'save' | 'pdf' | 'edit' | 'share' | 'regenerate' | 'download' | 'print';
export interface ActionBarAction {
  /** Identifies the action in onAction; a preset key also supplies the glyph and English word. */
  key: string;
  /** The word on the pill ("Regenerate"). Defaults to the preset's word. */
  label?: React.ReactNode;
  /** A glyph name from SK.ICONS. Defaults to the preset's glyph. */
  icon?: string;
  /** Makes the pill a toggle (aria-pressed), solid indigo while true: "Answer key". */
  pressed?: boolean;
  disabled?: boolean;
  onClick?: (event: React.MouseEvent<HTMLButtonElement>) => void;
  lang?: string;
}
export interface ActionBarProps {
  /** A preset row. save: Copy · Save · PDF · Edit · Share (tool outputs). revise: Edit · Regenerate · Download · Share (the output chrome). Default "save". */
  set?: 'save' | 'revise';
  /** Replaces the preset: preset keys and/or action objects, in order. */
  actions?: Array<ActionBarKey | ActionBarAction>;
  /** Translated words for preset keys, e.g. { edit: 'बदलें' }. */
  labels?: Partial<Record<ActionBarKey, string>>;
  /** Called with the action's key on every press. */
  onAction?: (key: string, event: React.MouseEvent<HTMLButtonElement>) => void;
  /** sm: 11px pills, 32px tall (tool outputs). md: 12px pills, 35px tall with a soft lift (lesson plan, exam paper, visual aid). Default "sm". */
  size?: 'sm' | 'md';
  /** Wrap onto a second line instead of scrolling sideways. */
  wrap?: boolean;
  /** Let the scrolling row run under the screen's 20px gutters to the screen edges. */
  bleed?: boolean;
  /** The toolbar's accessible name. Default "Actions"; name the output: "Lesson plan actions". */
  label?: string;
  id?: string;
  lang?: string;
  className?: string;
  style?: React.CSSProperties;
}
export declare function ActionBar(props: ActionBarProps): React.ReactElement;

export interface AccordionTimedItem {
  /** The activity's name ("The Mystery of Plant Food"). */
  title: React.ReactNode;
  /** Its length in minutes; shown as "7 min". */
  minutes?: number;
  /** Or a ready-made length ("05–18"). Wins over minutes. */
  duration?: string;
  /** What happens in it. */
  description?: React.ReactNode;
  /** Start this item folded to one line with a chevron; tapping it opens it. */
  collapsed?: boolean;
  lang?: string;
  key?: string;
}
export interface AccordionProps {
  /** The section's name ("Objectives", "Warm-up"). */
  title: React.ReactNode;
  /** How many things it holds; shown after the title as "Objectives · 3". */
  count?: number | string;
  /** A time span before the title, comfortable density: "00–05" gives "00–05 · Warm-up". */
  time?: string;
  /** One line shown under the title while closed ("SWBAT define photosynthesis in simple terms…"). It toggles too. */
  summary?: React.ReactNode;
  /** Timed items (Activities · 4): a saffron rule, the name and minutes, the description. */
  items?: AccordionTimedItem[];
  /** The region's content. A string is set as one paragraph. */
  children?: React.ReactNode;
  /** Controlled open state. Pair with onToggle. */
  expanded?: boolean;
  /** Uncontrolled: start open. */
  defaultExpanded?: boolean;
  /** Called with the next open state. */
  onToggle?: (expanded: boolean) => void;
  /** compact: tool outputs, 12px display title and a chevron (default). comfortable: lesson plan sections, 11px label, 14px body, "Open" while closed. */
  density?: 'compact' | 'comfortable';
  /** Marks the section VIDYA is reading back: a leaf edge and leaf label, and a hidden "now reading". */
  current?: boolean;
  /** The hidden word for current. Default "now reading". */
  currentLabel?: string;
  /** The word shown on a closed comfortable section. Default "Open". */
  openLabel?: string;
  /** The word after item minutes. Default "min". */
  minLabel?: string;
  /** Heading level of the header. Default 3. */
  headingLevel?: 2 | 3 | 4 | 5 | 6;
  id?: string;
  lang?: string;
  className?: string;
  style?: React.CSSProperties;
}
export declare function Accordion(props: AccordionProps): React.ReactElement;

export interface FeedbackRowText {
  /** The question and the group's name. Default "Was this helpful?". */
  question?: string;
  /** VIDYA's thanks after a thumb up. */
  up?: string;
  /** VIDYA's thanks after a thumb down. */
  down?: string;
  /** The thumb up's accessible name. Default "Helpful". */
  upLabel?: string;
  /** The thumb down's accessible name. Default "Not helpful". */
  downLabel?: string;
}
export interface FeedbackRowProps {
  /** Controlled: the chosen thumb, or null. Pair with onChange. */
  value?: 'up' | 'down' | null;
  /** Uncontrolled: the starting choice. */
  defaultValue?: 'up' | 'down' | null;
  /** Called with the new choice; pressing the chosen thumb again sends null. */
  onChange?: (value: 'up' | 'down' | null) => void;
  /** Translated question, thanks and thumb names. */
  text?: FeedbackRowText;
  /** spread: question left, thumbs right (default) · start: thumbs right after the question · end: both at the right, clear of an orb parked left. */
  align?: 'spread' | 'start' | 'end';
  disabled?: boolean;
  id?: string;
  lang?: string;
  className?: string;
  style?: React.CSSProperties;
}
export declare function FeedbackRow(props: FeedbackRowProps): React.ReactElement;

export interface QuizOption {
  /** The option text ("Evaporation"). */
  label: React.ReactNode;
  /** Marks the right answer (or pass the index as QuizQuestionProps.correct). */
  correct?: boolean;
  lang?: string;
}
export interface QuizQuestionProps {
  /** The question ("What happens to water when the sun heats it?"). */
  question: React.ReactNode;
  /** mcq: options under the question · short: no options (short answer). */
  type?: 'mcq' | 'short';
  /** quiz: the quiz tile (default) · exam: the exam paper's question card, headed "Q31" with its marks or a PYQ tag. */
  variant?: 'quiz' | 'exam';
  /** list: stacked rows (default for quiz) · grid: a 2×2 of options lettered A–D · inline: (a)–(d) chips that wrap (default for exam). */
  layout?: 'list' | 'grid' | 'inline';
  /** Show the letters. Default on for grid and inline, off for list. */
  lettered?: boolean;
  /** Builds the default eyebrow "Question 1 · multiple choice", or the exam label "Q1". */
  number?: number;
  /** Replaces the quiz eyebrow (pass a translation). Latin text is uppercased and tracked; Indic is not. */
  eyebrow?: React.ReactNode;
  /** Exam: replaces the "Q1" label. */
  label?: React.ReactNode;
  /** Exam: the marks at the right of the header ("6 marks"). */
  marks?: React.ReactNode;
  /** Exam: an indigo past-paper tag that replaces the marks ("Past paper · 1 mark"). */
  pyq?: React.ReactNode;
  /** An internal-choice alternative, joined to the question by a saffron "OR". */
  or?: React.ReactNode;
  /** The word that joins the alternative. Default "OR". */
  orLabel?: string;
  /** The marking-scheme line under the question ("Marking scheme · 1 + 1 + 1"). */
  scheme?: React.ReactNode;
  /** Options as strings or objects. Ignored for type "short". */
  options?: Array<React.ReactNode | QuizOption>;
  /** Index of the correct option, if the options don't carry correct: true. */
  correct?: number;
  /** review: the answer key, the correct option tinted leaf with a check and the word "correct" · answer: the options become radio buttons with 44px rows. */
  mode?: 'review' | 'answer';
  /** Review: false hides the answer key (the student's view of the same paper). Default true. */
  reveal?: boolean;
  /** Answer mode, controlled: the chosen index (null for none). Pair with onSelect. */
  selected?: number | null;
  /** Answer mode, uncontrolled: the starting choice. */
  defaultSelected?: number | null;
  onSelect?: (index: number) => void;
  /** Answer mode: locks the options. */
  disabled?: boolean;
  /** Short answer: show an answer area. A string labels the dashed box (review) or is the placeholder (answer). true gives "Student answer area". */
  answerArea?: boolean | string;
  /** Answer mode, short answer: the written answer, controlled. Pair with onAnswerChange. */
  answerValue?: string;
  /** Answer mode, short answer: the starting text. */
  defaultAnswerValue?: string;
  onAnswerChange?: (event: React.ChangeEvent<HTMLTextAreaElement>) => void;
  /** Review mode, short answer: the model answer, shown in a leaf row. */
  answer?: React.ReactNode;
  /** The model answer's lead word. Default "Answer". */
  answerLabel?: string;
  /** The visually hidden word after the correct option. Default "correct". */
  correctLabel?: string;
  /** Quiz: adds a chevron that folds the question to its header. */
  collapsible?: boolean;
  /** Controlled fold state. Pair with onToggle. */
  collapsed?: boolean;
  /** Uncontrolled: start folded. */
  defaultCollapsed?: boolean;
  /** Called with the next fold state. */
  onToggle?: (collapsed: boolean) => void;
  /** The fold button's verbs, spoken before "question 1". Defaults "Hide" and "Show". */
  collapseLabel?: string;
  expandLabel?: string;
  id?: string;
  lang?: string;
  className?: string;
  style?: React.CSSProperties;
}
export declare function QuizQuestion(props: QuizQuestionProps): React.ReactElement;

export interface RubricLevel {
  /** The level number shown in the badge (4 is best). */
  score: number;
  /** The level's name, set above the descriptor ("Exemplary"). */
  label?: React.ReactNode;
  /** What work at this level looks like ("All planets present, sizes scaled, no factual errors"). */
  descriptor: React.ReactNode;
  /** Overrides the badge colour picked from the score: top leaf-500 · mid saffron-700 · low amber-500 · floor red-500. */
  tone?: 'top' | 'mid' | 'low' | 'floor';
  lang?: string;
  key?: string;
}
export interface RubricCriterionProps {
  /** The criterion ("Scientific accuracy"). */
  name: React.ReactNode;
  /** What the criterion covers, under its name ("Planet representation, orbital paths, facts"). */
  description?: React.ReactNode;
  /** Its share of the grade ("40%"). */
  weight?: React.ReactNode;
  /** Levels, best first. A 4-level scale reads leaf, saffron, amber, red; other scales spread over the same four. */
  levels?: RubricLevel[];
  /** Shows the name and weight only. */
  collapsed?: boolean;
  /** Makes the header a disclosure button (aria-expanded) with a chevron; the consumer flips collapsed. */
  onToggle?: () => void;
  /** Heading level of the criterion name. Default 3. */
  headingLevel?: 2 | 3 | 4 | 5 | 6;
  /** Visually hidden word before each badge number. Default "Level". */
  levelLabel?: string;
  /** Visually hidden word before the weight. Default "weight". */
  weightLabel?: string;
  id?: string;
  lang?: string;
  className?: string;
  style?: React.CSSProperties;
}
export declare function RubricCriterion(props: RubricCriterionProps): React.ReactElement;

export interface RubricTableLevel {
  /** The level's name ("Exemplary"). */
  label: React.ReactNode;
  /** Its score; the header reads "Exemplary · 4". */
  score?: number;
  lang?: string;
}
export interface RubricTableCriterion {
  /** The criterion ("Scientific accuracy"). */
  name: React.ReactNode;
  /** What it covers ("Planet representation, orbital paths, facts"). */
  description?: React.ReactNode;
  /** Its share of the grade ("40%"), shown under the name in saffron. */
  weight?: React.ReactNode;
  /** One descriptor per level, in the same order as levels. */
  cells: React.ReactNode[];
  lang?: string;
  key?: string;
}
export interface RubricTableProps {
  /** The rows. */
  criteria: RubricTableCriterion[];
  /** The columns, best first. Default Exemplary · 4, Proficient · 3, Developing · 2, Beginning · 1. */
  levels?: RubricTableLevel[];
  /** The table's caption (visually hidden; the screen title shows it). Name the rubric: "Solar system model rubric". */
  caption?: string;
  /** The first column's header. Default "Criteria". */
  criteriaLabel?: string;
  /** The hint above the table while it scrolls sideways. Default "Swipe the table sideways"; false hides it. */
  hint?: string | false;
  /** Fill the remaining height of a flex column (the table sits at the top of its card). */
  fill?: boolean;
  /** Level column width in px. Default 130. */
  columnWidth?: number;
  /** Criteria column width in px. Default 112. */
  criteriaWidth?: number;
  id?: string;
  lang?: string;
  className?: string;
  style?: React.CSSProperties;
}
export declare function RubricTable(props: RubricTableProps): React.ReactElement;

export interface MediaRowProps {
  /** Names the platform in words, never with a logo: "Watch on YouTube", "Listen on DIKSHA". */
  title: React.ReactNode;
  /** One line: what it is and for whom ("Photosynthesis for Class 6"). */
  meta?: React.ReactNode;
  /** video: a filled play glyph (default) · audio: speaker · document: book. */
  kind?: 'video' | 'audio' | 'document';
  /** Override the tile's glyph (a name from SK.ICONS). */
  glyph?: string;
  /** Renders the row as a link. External by default: it opens in a new tab and says so to assistive tech. */
  href?: string;
  /** false when href stays inside SahayakAI. */
  external?: boolean;
  /** Hidden suffix for external links. Default ", opens in a new tab". */
  newTabLabel?: string;
  /** Without href the row is a button. */
  onClick?: (e: React.MouseEvent) => void;
  /** Wraps the row in its own soft glass card under a muted eyebrow ("Recommended video") that names the section. */
  eyebrow?: React.ReactNode;
  /** Language of the title and meta (BCP 47). */
  lang?: string;
  id?: string;
  className?: string;
  style?: React.CSSProperties;
}
export declare function MediaRow(props: MediaRowProps): React.ReactElement;

export interface MarksBand {
  /** The band's range, as printed under the bar: "0–4", "20–25". Use an en dash. */
  label: string;
  /** How many sheets scored in this band. */
  count: number;
  /** Overrides the colour. Default ramps by position: red (lowest) · amber · saffron · leaf (highest). */
  tone?: 'red' | 'amber' | 'saffron' | 'leaf';
}
export interface MarksChartProps {
  /** The eyebrow and figure caption. Default "Marks distribution". */
  title?: string;
  /** One entry per band, lowest marks first. The counts should add up to the sheets read. */
  bands: MarksBand[];
  /** What a count counts, for the table: default "sheets". */
  unit?: string;
  /** The table's column heading for the ranges. Default "Marks". */
  rangeLabel?: string;
  /** The y-scale top. Default: the largest count. */
  max?: number;
  /** The hidden table's caption. Default "<title>, <total> <unit>". */
  caption?: string;
  /** Prints each count above its bar. */
  showCounts?: boolean;
  /** Bar area height in px. Default 62. */
  height?: number;
  /** BCP 47 code when the labels are in an Indic language. */
  lang?: string;
  id?: string;
  className?: string;
  style?: React.CSSProperties;
  children?: React.ReactNode;
}
export declare function MarksChart(props: MarksChartProps): React.ReactElement;

export interface ReviewRowProps {
  /** The student's name as on the register: "Divya Rane". */
  name: string;
  /** Roll number as written on the sheet: "04". Shown as "<name> · roll 04". */
  roll?: string;
  /** Translated "roll". */
  rollLabel?: string;
  /** Why the scanner needs the teacher: "Q4 handwriting unclear", "Photographed at an angle". */
  reason?: React.ReactNode;
  /** red: the sheet could not be read · amber: it was read but needs a retake or a check. Sets the thumbnail edge and the reason's colour; the reason says it in words. */
  tone?: 'red' | 'amber';
  /** The one action: "Review" (open the sheet and type the mark) or "Rescan". */
  action?: string;
  onAction?: (e: React.MouseEvent) => void;
  /** A photo of the sheet for the thumbnail. Default: a drawn paper sheet. */
  src?: string;
  /** 'li' renders the row as a list item (put rows in a <ul>). */
  as?: 'li' | 'div';
  disabled?: boolean;
  /** BCP 47 code when the reason and action are in an Indic language. */
  lang?: string;
  id?: string;
  className?: string;
  style?: React.CSSProperties;
  children?: React.ReactNode;
}
export declare function ReviewRow(props: ReviewRowProps): React.ReactElement;

export interface CaptureSheet {
  /** read: marked cleanly (leaf edge, check badge) · check: captured but needs the teacher's look (saffron edge, alert badge). */
  status?: 'read' | 'check';
  /** Spoken name, e.g. "Roll 12". Default "Sheet <n>". */
  label?: string;
  /** A photo of the captured sheet. Default: a drawn paper sheet. */
  src?: string;
}
export interface CaptureStripProps {
  /** Sheets captured so far. Default: sheets.length. Announced politely as it changes. */
  count?: number;
  /** Translated "Sheets captured". */
  title?: string;
  /** How to hold the next sheet. Default "Hold each sheet flat; the roll number must be visible". false hides it. */
  hint?: string | false;
  /** The latest sheets, oldest first. Show only as many as fit beside the parked orb (three on the scanner screen). */
  sheets?: CaptureSheet[];
  /** Opens a captured sheet; makes each thumbnail a button. */
  onOpen?: (index: number) => void;
  /** Shows the dashed add tile (pick a photo instead of the camera). */
  onAdd?: () => void;
  /** Translated "Add a sheet". */
  addLabel?: string;
  /** The strip's accessible name. Default "Captured sheets". */
  stripLabel?: string;
  /** Translated status words: { read: 'read', check: 'needs a look' }. */
  statusLabels?: { read?: string; check?: string };
  /** camera (default): on camera-ground · light: on a screen wash. */
  tone?: 'camera' | 'light';
  /** BCP 47 code when the text is in an Indic language. */
  lang?: string;
  id?: string;
  className?: string;
  style?: React.CSSProperties;
  children?: React.ReactNode;
}
export declare function CaptureStrip(props: CaptureStripProps): React.ReactElement;

export interface PostCardProps {
  /** Who posted ("Suresh Reddy", "Daily Briefing"). */
  author: React.ReactNode;
  /** One line under the name: subject, class and age, or the date ("Maths · Class 7 · 11 hours ago"). */
  meta?: React.ReactNode;
  /** The post's words. children also works. */
  body?: React.ReactNode;
  children?: React.ReactNode;
  /** The kind tag: resource saffron · tried amber · celebrate leaf · help indigo. Omit for no tag. */
  type?: 'resource' | 'tried' | 'celebrate' | 'help';
  /** Translated tag text. Latin is uppercased; Indic is not. */
  typeLabel?: string;
  typeLang?: string;
  /** Avatar initials; defaults to the first and last initials of author. */
  initials?: string;
  /** The tint of the initials disc. Default amber. */
  avatarTone?: 'amber' | 'leaf' | 'indigo' | 'saffron';
  /** A post the app made (the Daily Briefing): saffron edge, soft shadow, and a square saffron mark instead of a face. */
  automated?: boolean;
  /** The automated mark's character. Default "स". */
  mark?: string;
  /** Like count; shows the like button. At 0 the word shows too ("0 likes"). */
  likes?: number;
  /** The teacher has liked it (aria-pressed). */
  liked?: boolean;
  onLike?: () => void;
  /** Comment count; shows the comments button. */
  comments?: number;
  /** Translated comments text. Default "12 comments". */
  commentsLabel?: string;
  onComments?: () => void;
  /** Visually hidden action word on the like button. Default "Like". */
  likeLabel?: string;
  /** Noun after the count: visually hidden, shown at 0. Default "likes". */
  likesLabel?: string;
  /** feed (default): the Community feed card. room: the Staff room's reading card (30px avatar, 14px text, 12px actions). */
  size?: 'feed' | 'room';
  /** Shows an inline "Read more" after a cut post. */
  onReadMore?: () => void;
  /** Translated "Read more". */
  readMoreLabel?: string;
  /** The board-aware source line under the post: board, then what it is ("CBSE" · "Capacity building for Office Procedures"). With href or onClick it opens the circular. */
  source?: { board?: string; title?: string; label?: string; href?: string; onClick?: () => void; lang?: string };
  /** A file shared in the post: title, one line, and a Save toggle. */
  attachment?: { title: React.ReactNode; meta?: React.ReactNode; saved?: boolean; onSave?: () => void; saveLabel?: string; savedLabel?: string; lang?: string };
  /** Shows the Connect pill on a post by a teacher the reader is not connected to. */
  onConnect?: () => void;
  /** The connect pill's state. Default connect; pending and connected are quiet. */
  connect?: 'connect' | 'pending' | 'connected';
  /** Translated pill word. */
  connectLabel?: string;
  /** Plain-text author for accessible names when author is not a string. */
  authorLabel?: string;
  /** Shows the Translate text action (Staff room). */
  onTranslate?: () => void;
  /** The post is showing its translation: the action reads "Show original". */
  translated?: boolean;
  /** Translated "Translate" and "Show original". */
  translateLabel?: string;
  originalLabel?: string;
  translateLang?: string;
  id?: string;
  lang?: string;
  className?: string;
  style?: React.CSSProperties;
}
export declare function PostCard(props: PostCardProps): React.ReactElement;

export type PersonActionKind = 'connect' | 'join' | 'accept' | 'pending' | 'connected' | 'joined';
export interface PersonActionProps {
  /** connect · join · accept (leaf solid) · pending, connected and joined (quiet; inert unless onClick is given). */
  action?: PersonActionKind;
  /** connect and join only: solid (saffron-600, the one suggestion to act on first) or outline (default). accept is always solid leaf. */
  emphasis?: 'solid' | 'outline';
  /** The person or group the action is about; it completes the accessible name ("Connect with Rakesh Singh", "Join 9 Mathematics · CBSE"). */
  person?: string;
  /** Translated visible word. Default Connect, Join, Accept, Pending, Connected, Joined. */
  label?: string;
  /** Translated full accessible name; it must contain the visible word. */
  a11yLabel?: string;
  onClick?: () => void;
  lang?: string;
  id?: string;
  className?: string;
  style?: React.CSSProperties;
}
export declare function PersonAction(props: PersonActionProps): React.ReactElement;

export interface PersonRowProps {
  /** The person ("Rakesh Singh") or, with avatar={false}, the group ("9 Mathematics · CBSE"). */
  name: React.ReactNode;
  /** One line of context: subject, class and how you know them ("Science · Class 8 · same school"), or "4 members". */
  meta?: React.ReactNode;
  /** Initials; default the first letters of the first and last words of name. */
  initials?: string;
  /** 28px initials disc tint. Default saffron. */
  avatarTone?: 'saffron' | 'amber' | 'leaf' | 'indigo';
  /** false hides the disc (a suggested group). */
  avatar?: boolean;
  /** The pill. none or omitted for no action. */
  action?: PersonActionKind | 'none';
  /** connect and join: solid or outline (default). */
  emphasis?: 'solid' | 'outline';
  onAction?: () => void;
  /** Translated pill word and full accessible name (see PersonAction). */
  actionLabel?: string;
  actionA11yLabel?: string;
  actionLang?: string;
  /** Plain-text name for the pill's accessible name when name is not a string. */
  personLabel?: string;
  /** Render as an <li> inside a list. Default div. */
  as?: 'div' | 'li';
  id?: string;
  lang?: string;
  className?: string;
  style?: React.CSSProperties;
}
export declare function PersonRow(props: PersonRowProps): React.ReactElement;

export interface GroupRowProps {
  /** The group's name, board-aware where it is a class group ("Karnataka Teachers", "8 Science · KSEEB", "9 Mathematics · CBSE"). */
  name: React.ReactNode;
  /** One line under the name: "44 members". */
  meta?: React.ReactNode;
  /** The dot's colour: saffron (the app's own Daily Briefing) · leaf (state and school groups) · indigo (class and board groups) · amber. Default saffron. */
  tone?: 'saffron' | 'leaf' | 'indigo' | 'amber';
  /** Posts since the last visit; shows "2 new" in saffron-600. 0 or omitted shows nothing. */
  newCount?: number;
  /** Translated "2 new" text; overrides newCount. */
  newLabel?: string;
  /** Opens the group. */
  onClick?: (e: React.MouseEvent) => void;
  /** Renders an <a> instead of a <button>. */
  href?: string;
  id?: string;
  lang?: string;
  className?: string;
  style?: React.CSSProperties;
}
export declare function GroupRow(props: GroupRowProps): React.ReactElement;

export interface GroupTileProps {
  /** The group, short: "Science · 7", "Maharashtra", "9 Maths · ICSE". */
  name: React.ReactNode;
  /** The member count: "1,204 members". */
  meta?: React.ReactNode;
  /** The tile's solid colour: saffron (subject groups) · leaf (state groups) · indigo (board and class groups). Default saffron. */
  tone?: 'saffron' | 'leaf' | 'indigo';
  /** Opens the group. */
  onClick?: (e: React.MouseEvent) => void;
  /** Renders an <a> instead of a <button>. */
  href?: string;
  id?: string;
  lang?: string;
  className?: string;
  style?: React.CSSProperties;
}
export declare function GroupTile(props: GroupTileProps): React.ReactElement;

export interface ResourceCardChip {
  /** "Class 6", "Science", "हिन्दी", "CBSE". */
  label: string;
  kind?: 'class' | 'subject' | 'language';
  /** BCP 47 code when the label is in another script ("hi" for हिन्दी). */
  lang?: string;
}
export interface ResourceCardProps {
  /** The kind of material; it sets the eyebrow word and colour: lesson saffron · worksheet leaf · quiz indigo · visual (aid) amber · rubric amber · paper indigo. Default lesson. */
  type?: 'lesson' | 'worksheet' | 'quiz' | 'visual' | 'rubric' | 'paper';
  /** Translated eyebrow word. Latin is uppercased; Indic is not. */
  typeLabel?: string;
  typeLang?: string;
  /** The material's title: "Water cycle". */
  title: React.ReactNode;
  /** Plain-text title for Save's accessible name when title is not a string. */
  titleLabel?: string;
  /** The board the material follows ("CBSE", "KSEEB", "ICSE"): a small indigo tag at the top right, beside the type. Omit for board-neutral material. */
  board?: string;
  /** Translated "Board" for assistive tech. */
  boardLabel?: string;
  /** Class, subject and language chips, in that order. Strings or objects. */
  chips?: Array<string | ResourceCardChip>;
  /** Accessible name of the chip list. Default "Details". */
  chipsLabel?: string;
  /** How many teachers saved it: "214 saves". */
  saves?: number;
  /** Translated saves text; overrides saves. */
  savesLabel?: string;
  /** The teacher saved it: a leaf tick and "Saved", aria-pressed. */
  saved?: boolean;
  /** Shows Save (a toggle). */
  onSave?: () => void;
  /** Translated "Save" and "Saved". */
  saveLabel?: string;
  savedLabel?: string;
  /** Makes the title a button that opens the material. */
  onOpen?: () => void;
  /** Heading level of the title. Default 3. */
  headingLevel?: 2 | 3 | 4;
  /** Render as an <li> inside .sk-resourcecard-grid. Default article. */
  as?: 'article' | 'li';
  id?: string;
  lang?: string;
  className?: string;
  style?: React.CSSProperties;
}
export declare function ResourceCard(props: ResourceCardProps): React.ReactElement;

export interface MessageRowProps {
  /** The other teacher ("Aisha Khan"). */
  name: React.ReactNode;
  /** Plain-text name for accessible names when name is not a string. */
  personLabel?: string;
  /** The last line of the chat ("Sent you the photosynthesis sheet"). For a request it defaults to "Wants to connect". */
  preview?: React.ReactNode;
  /** Initials; default from name. */
  initials?: string;
  /** 30px initials disc tint. Default saffron. */
  avatarTone?: 'saffron' | 'amber' | 'leaf' | 'indigo';
  /** When the last message came ("9:12", "Yesterday"). Hidden while there are unread messages. */
  time?: string;
  /** Unread messages: a saffron-600 count badge instead of the time. */
  unread?: number;
  /** Translated "2 unread messages" for assistive tech. */
  unreadLabel?: string;
  /** Opens the conversation (conversation rows). */
  onOpen?: () => void;
  /** Renders the conversation row as an <a>. */
  href?: string;
  /** A connection request: "Wants to connect" and Accept. The row does not open a chat. */
  request?: boolean;
  /** Translated "Wants to connect". */
  requestLabel?: string;
  onAccept?: () => void;
  /** The request was accepted: the pill turns to the quiet "Connected". */
  accepted?: boolean;
  /** Translated "Accept" and "Connected". */
  acceptLabel?: string;
  acceptedLabel?: string;
  actionLang?: string;
  /** Shows a quiet cross to decline the request. */
  onDecline?: () => void;
  /** Accessible name of the cross. Default "Decline request from <name>". */
  declineLabel?: string;
  /** Render inside a list as an <li>. Default div. */
  as?: 'div' | 'li';
  id?: string;
  lang?: string;
  className?: string;
  style?: React.CSSProperties;
}
export declare function MessageRow(props: MessageRowProps): React.ReactElement;

export type ClassTabStatus = 'outreach' | 'clear' | 'pending';
export interface ClassTab {
  /** Stable id of the class ("6A"). */
  value: string;
  /** What the chip shows; defaults to value. */
  label?: React.ReactNode;
  /** Students in the class; drawn as "6A · 40" and read as "40 students". */
  count?: number;
  /** outreach: saffron tint, amber dot (parents to contact today) · clear: leaf tint and dot · pending (default): grey, register not taken. */
  status?: ClassTabStatus;
  /** Translated status words for this tab only (overrides statusLabels). */
  statusLabel?: string;
  disabled?: boolean;
  lang?: string;
  id?: string;
}
export interface ClassTabsProps {
  /** The teacher's classes, in timetable order. */
  classes: ClassTab[];
  /** Controlled selected class (value). Pass value + onChange, or defaultValue. */
  value?: string;
  defaultValue?: string;
  /** Called with the class value on tap or arrow key (automatic activation). */
  onChange?: (value: string) => void;
  /** Name of the tablist. Default "Classes". */
  label?: string;
  /** Id of the tabpanel the selected tab controls (the register below). */
  controls?: string;
  /** Translated status words read in each tab's name. Default needs outreach, all clear, register not taken. */
  statusLabels?: Partial<Record<ClassTabStatus, string>>;
  /** Translated count words. Default n => "40 students". */
  countText?: (n: number) => string;
  /** Run edge to edge inside a 20px-gutter screen so the row scrolls under the screen's edges. */
  bleed?: boolean;
  id?: string;
  className?: string;
  style?: React.CSSProperties;
}
export declare function ClassTabs(props: ClassTabsProps): React.ReactElement;

export interface TriageItem {
  /** The student's first name as the class knows it. */
  name: string;
  /** The facts that justify the call, drawn with " · " between them: ["6 days", "Malayalam"], ["28%", "English"]. */
  facts?: string[];
  lang?: string;
}
export interface TriageSection {
  /** red: consecutive absences · amber: at risk academically · leaf: something to celebrate. */
  tone?: 'red' | 'amber' | 'leaf';
  /** The reason in words ("Consecutive absences"). Drawn uppercase and tracked unless Indic. */
  label: string;
  /** Students in this group. When larger than items, a neutral "+3 more" tag ends the list. */
  count?: number;
  /** The students to name, most urgent first. Three per section fit two lines on a phone. */
  items: Array<TriageItem | string>;
  /** false hides the "+N more" tag. */
  showMore?: boolean;
  lang?: string;
}
export interface TriageCardProps {
  /** The card's heading, an h2 eyebrow ("Needs outreach today"). */
  title: React.ReactNode;
  /** Total parents to contact; drawn after the title (" · 20"). */
  count?: number;
  sections: TriageSection[];
  /** Optional control at the head's right, e.g. a small Button that opens the outreach list. */
  action?: React.ReactNode;
  /** Translated remainder words. Default n => "+n more". */
  moreText?: (n: number) => string;
  id?: string;
  className?: string;
  style?: React.CSSProperties;
}
export declare function TriageCard(props: TriageCardProps): React.ReactElement;

export interface ContactRowProps {
  /** The student's full name; truncates with an ellipsis (Latin) or wraps (Indic). */
  name: React.ReactNode;
  /** One line of facts in the reason's tone: "67% this month · 6 absent in a row". Also the button's description. */
  meta?: React.ReactNode;
  /** red: absences · amber: at risk academically · leaf: celebrate · neutral (default). Colours the meta line only. */
  tone?: 'red' | 'amber' | 'leaf' | 'neutral';
  /** The parent being contacted now (its sheet is open) or VIDYA's suggested first call: saffron edge and a solid Contact. One per list. */
  highlighted?: boolean;
  /** Opens the reason sheet for this student's parent. */
  onContact?: (e: React.MouseEvent) => void;
  /** Visible button text, translated. Default "Contact". */
  actionLabel?: string;
  /** The button's full name, translated. Default "Contact Omkar Naik’s parent". */
  contactLabel?: string;
  /** Once the parent is reached, a worded leaf status replaces the button: "Called · 10:40", "Message sent". */
  done?: React.ReactNode;
  disabled?: boolean;
  /** Default 'div'. Use 'li' inside <ul className="sk-contactrow-list">. */
  as?: 'div' | 'li';
  lang?: string;
  id?: string;
  className?: string;
  style?: React.CSSProperties;
}
export declare function ContactRow(props: ContactRowProps): React.ReactElement;

export type ReasonKind = 'absence' | 'academic' | 'behaviour' | 'positive';
export interface ReasonOptionProps {
  /** Shared by every option in the group; the browser makes them one radio group. */
  name: string;
  value: string;
  /** Controlled: the chosen option. Or pass defaultChecked. */
  checked?: boolean;
  defaultChecked?: boolean;
  /** Called with this option's value when it is chosen (tap, Space, or an arrow key from a sibling). */
  onChange?: (value: string, e: React.ChangeEvent<HTMLInputElement>) => void;
  /** Sets the default icon and tone: absence (calendar with a cross, red) · academic (trend-down, saffron) · behaviour (alert, amber) · positive (star, leaf). */
  kind?: ReasonKind;
  /** Any SK.ICONS name, or 'calendar-x'. Overrides kind. */
  icon?: string;
  /** The tile's tint at rest. Overrides kind. Checked tiles are always solid saffron. */
  tone?: 'red' | 'saffron' | 'amber' | 'leaf';
  /** The reason ("Academic concern"). Names the radio. */
  title: React.ReactNode;
  /** What it means ("Grades or performance declined"). Describes the radio. */
  description?: React.ReactNode;
  disabled?: boolean;
  lang?: string;
  id?: string;
  className?: string;
  style?: React.CSSProperties;
}
export declare function ReasonOption(props: ReasonOptionProps): React.ReactElement;

export interface EvidenceRow {
  /** The record: "Science · Unit Test 1", "Mon 13 Oct". */
  label: React.ReactNode;
  /** Its value as the school wrote it: "6/25 · 24%", "Absent". */
  value: React.ReactNode;
  /** What a screen reader says instead of the drawn value: "6 out of 25, 24 percent". */
  valueLabel?: string;
  /** Draw the value in ink-600 (a record VIDYA will not cite). */
  muted?: boolean;
  lang?: string;
}
export interface EvidenceCardProps {
  /** Says what the rows are and how VIDYA uses them: "Recent marks · VIDYA cites the lowest". An h3. */
  title: React.ReactNode;
  /** The worded status, drawn as a solid pill: "At risk", "Improving", "6 days absent". */
  flag?: React.ReactNode;
  /** red (default): at risk or absent · amber: slipping · leaf: improving or praise. */
  tone?: 'red' | 'amber' | 'leaf';
  /** The real records, newest first. Never generated. */
  rows: EvidenceRow[];
  /** Optional line under the rows: where the records come from. */
  footnote?: React.ReactNode;
  id?: string;
  className?: string;
  style?: React.CSSProperties;
}
export declare function EvidenceCard(props: EvidenceCardProps): React.ReactElement;

export type ConceptLevel = 'low' | 'mid' | 'high';
export interface ConceptRowProps {
  /** The concept as the chapter names it ("Condensation"). Also the bar's accessible name. */
  concept: React.ReactNode;
  /** Questions or checks right so far. */
  value: number;
  /** Out of how many. Default 5. */
  max?: number;
  /** Overrides the level the score implies: low under 50% (red), mid 50 to 79% (saffron), high 80% and over (leaf). */
  level?: ConceptLevel;
  /** Translated level words. Default Needs practice, Getting there, Secure. */
  levelLabels?: Partial<Record<ConceptLevel, string>>;
  /** Translated score words. Default (v, max) => "2 of 5". */
  scoreText?: (value: number, max: number) => string;
  /** Default 'div'. Use 'li' inside <ul className="sk-conceptrow-list">. */
  as?: 'div' | 'li';
  lang?: string;
  id?: string;
  className?: string;
  style?: React.CSSProperties;
}
export declare function ConceptRow(props: ConceptRowProps): React.ReactElement;

export interface MessagePreviewProps {
  /** glass: the reading card on a screen wash (22px corners, default) · inset: the milk card inside the review sheet (18px corners, 14px text). */
  tone?: 'glass' | 'inset';
  /** A small label above the message ("What they'll read"). It also names the figure for assistive tech. */
  eyebrow?: React.ReactNode;
  /** The greeting line, in the parent's language ("প্রিয় হিরেন পারমারের অভিভাবক,"). A blank line follows it. */
  salutation?: React.ReactNode;
  /** The message body, in the parent's language. */
  children?: React.ReactNode;
  /** The text the message cites from the teacher's own records, highlighted in the body when it appears there verbatim ("৫০ এর মধ্যে ১৬"). */
  cite?: string;
  /** The leaf line under the card that says what the message cites ("Cites 16/50, the mark you entered. Nothing invented."). */
  citation?: React.ReactNode;
  /** BCP 47 language of the message ("bn", "mr"). */
  lang?: string;
  /** Accessible name when there is no eyebrow. Default "Message preview". */
  label?: string;
  id?: string;
  className?: string;
  style?: React.CSSProperties;
}
export declare function MessagePreview(props: MessagePreviewProps): React.ReactElement;

export interface ChannelOptionProps {
  /** The channel, named in words: "WhatsApp", "Voice call", "SMS". Never a logo. */
  channel: React.ReactNode;
  /** The number on the student's record. Shown masked to its last four digits only ("••••••4412"); an already-masked number passes through. Read aloud as "number ending 4412". */
  number?: string;
  /** Who answers it: "Mother", "Father", "Guardian". */
  who?: React.ReactNode;
  /** When or why: "preferred", "after 6 pm". Joined to `who` with a middle dot. */
  when?: React.ReactNode;
  /** A line under the meta, e.g. when the school's calling hours delay the call ("Goes out at 18:00, inside calling hours"). */
  reason?: React.ReactNode;
  /** amber (default): queued or delayed, with a clock · muted: why the option is unavailable, with a lock. */
  reasonTone?: 'amber' | 'muted';
  /** Controlled state. */
  checked?: boolean;
  /** Uncontrolled initial state. */
  defaultChecked?: boolean;
  /** Called with the new checked state. */
  onChange?: (checked: boolean, event: React.ChangeEvent<HTMLInputElement>) => void;
  /** No number on record, or the channel is switched off for the school. Say why in `reason`. */
  disabled?: boolean;
  name?: string;
  value?: string;
  /** Translated "number ending" for the read-out of the masked number. */
  numberLabel?: string;
  lang?: string;
  id?: string;
  className?: string;
  style?: React.CSSProperties;
}
export declare function ChannelOption(props: ChannelOptionProps): React.ReactElement;

export interface VoiceNoteCardProps {
  /** Length of the note in seconds. Default 20. */
  duration?: number;
  /** Seconds played so far. Above 0 (or while playing) the card shows "0:07 / 0:20" and a progress line. */
  elapsed?: number;
  /** Controlled play state. Omit to let the disc toggle on its own. */
  playing?: boolean;
  /** Called with the next play state when the disc is pressed. */
  onToggle?: (playing: boolean) => void;
  /** The small label. Default "If they can't read". */
  eyebrow?: React.ReactNode;
  /** What the note is. Default "A 20-second voice note in the same words". */
  title?: React.ReactNode;
  /** Accessible names of the disc, translated. Defaults "Play voice note, 20 seconds" / "Pause voice note". */
  playLabel?: string;
  pauseLabel?: string;
  /** While the note is still being recorded by VIDYA. */
  disabled?: boolean;
  lang?: string;
  id?: string;
  className?: string;
  style?: React.CSSProperties;
}
export declare function VoiceNoteCard(props: VoiceNoteCardProps): React.ReactElement;

export interface CallStageProps {
  /** connecting: ringing the number on record (indigo sphere, slow breathe) · live: VIDYA is speaking on the line (leaf sphere, two rings that follow her voice; default) · ended: the sphere settles, no rings. */
  state?: 'connecting' | 'live' | 'ended';
  /** The tracked status line: "Call in progress", "Calling", "Call ended". */
  status?: React.ReactNode;
  /** The call clock, "1:12". Exposed as a timer, so it is not announced every second. */
  time?: string;
  /** Who is on the line, as the teacher knows them: "Hiren's mother". The screen's heading. */
  name: React.ReactNode;
  /** How it is going: "Speaking Bengali · 3 exchanges so far". */
  detail?: React.ReactNode;
  /** VIDYA's output level, 0-1, while live. Swells the leaf rings. */
  level?: number;
  /** Or a function read once a frame for the level, without re-rendering. */
  getLevel?: () => number;
  /** Heading tag for the name. Default h1. */
  titleAs?: 'h1' | 'h2' | 'h3';
  /** What assistive tech hears when the state changes. Default "On the call with Hiren's mother. VIDYA is speaking." */
  announce?: string;
  lang?: string;
  className?: string;
  style?: React.CSSProperties;
}
export declare function CallStage(props: CallStageProps): React.ReactElement;

export interface CallTranscriptLine {
  /** vidya: VIDYA speaking for the school (marked with a small leaf orb) · parent: the parent (their initials disc). */
  who: 'vidya' | 'parent';
  /** What was said, as shown to the teacher. */
  text: React.ReactNode;
  /** BCP 47 language of this line when it is shown untranslated. */
  lang?: string;
  key?: string | number;
}
export interface CallTranscriptProps {
  /** The lines so far, oldest first. New lines are announced politely and scrolled into view. */
  lines: CallTranscriptLine[];
  /** Panel label. Default "Live transcript". */
  label?: React.ReactNode;
  /** Who the parent is, for assistive tech ("Hiren's mother"). */
  parentName?: string;
  /** Letters in the parent's disc. Default "P". */
  parentInitials?: string;
  /** Right of the label when the lines are translated for the teacher: "Translated from Bengali". */
  translatedFrom?: React.ReactNode;
  /** The line under the panel. Default "You needn't stay on the line. A summary follows."; null hides it. */
  note?: React.ReactNode | null;
  /** Heading tag for the label. Default h2. */
  headingAs?: 'h2' | 'h3';
  /** Name read out before VIDYA's lines. Default "VIDYA". */
  vidyaName?: string;
  /** false for a finished transcript: no live announcements. Default true. */
  live?: boolean;
  id?: string;
  className?: string;
  style?: React.CSSProperties;
}
export declare function CallTranscript(props: CallTranscriptProps): React.ReactElement;

export interface SummaryCardProps {
  /** done: the call finished (leaf, check disc, title + meta) · neutral: what the parent said · amber: concerns raised · indigo: the parent's commitments (check items) · action: the teacher's next steps (saffron edge, arrow items) · red: a follow-up is due · link: a row that opens the full transcript. Default neutral. */
  tone?: 'done' | 'neutral' | 'amber' | 'indigo' | 'action' | 'red' | 'link';
  /** The block's heading ("Parent commitments"); on done, the title ("Call completed"); on link, the row label ("Conversation transcript"). */
  title: React.ReactNode;
  /** done: the line under the title ("2 min · 5 exchanges · parent was concerned") · link: the right-hand count ("5 messages"). */
  meta?: React.ReactNode;
  /** List items. indigo items get a check glyph, action items an arrow. */
  items?: React.ReactNode[];
  /** Override the item glyph (any Icon name); null for none. */
  glyph?: string | null;
  /** A paragraph instead of (or after) the items. */
  children?: React.ReactNode;
  /** Heading tag. Default h2; pass h1 for the done block when it heads the screen. */
  headingAs?: 'h1' | 'h2' | 'h3';
  /** link: makes it a link instead of a button. */
  href?: string;
  /** link: opens the transcript. */
  onClick?: () => void;
  lang?: string;
  id?: string;
  className?: string;
  style?: React.CSSProperties;
}
export declare function SummaryCard(props: SummaryCardProps): React.ReactElement;

export interface LibraryRowProps {
  /** The Generation's type: LP lesson plan · WS worksheet · QZ quiz · VA visual aid · RB rubric · EP exam paper. Sets the badge letters and tint. Default LP. */
  type?: 'LP' | 'WS' | 'QZ' | 'VA' | 'RB' | 'EP' | string;
  /** Overrides the badge letters (e.g. "AT" attendance, "MSG" parent message in the offline queue). Two or three letters. */
  badge?: string;
  /** Overrides the badge tint. Defaults by type: LP saffron, WS ink, QZ leaf, VA indigo, RB amber, EP ink. */
  tone?: 'saffron' | 'ink' | 'leaf' | 'indigo' | 'amber';
  /** The title, e.g. "Water cycle · Class 6". One line; Indic titles wrap instead of truncating. */
  title: React.ReactNode;
  /** The meta line: type and when, e.g. "Lesson plan · today". */
  meta?: React.ReactNode;
  /** Optional board-aware source line in indigo, e.g. "CBSE · NCERT Curiosity 6, Ch 8". Never NCERT alone. */
  source?: React.ReactNode;
  /** synced (leaf) · waiting (amber, queued for signal) · local (saved on this phone only) · making (indigo, still being generated). */
  status?: 'synced' | 'waiting' | 'local' | 'making';
  /** Translated status word. Defaults: Synced, Waiting, Saved on this phone, Making. */
  statusLabel?: string;
  /** Makes the whole row a button that opens the item. */
  onClick?: (e: React.MouseEvent) => void;
  /** Makes the whole row a link instead. */
  href?: string;
  /** 'li' wraps the row in a list item (put rows in a <ul>). */
  as?: 'li';
  disabled?: boolean;
  /** BCP 47 code when the title is in an Indic language. */
  lang?: string;
  id?: string;
  className?: string;
  style?: React.CSSProperties;
}
export declare function LibraryRow(props: LibraryRowProps): React.ReactElement;

export interface ConversationRowProps {
  /** The first line of the teacher's ask, in her words: "Why does a cold glass get wet outside?". One line; Indic asks wrap instead of truncating. */
  ask: React.ReactNode;
  /** Number of messages in the chat ("12 messages"). */
  messages?: number;
  /** How the chat happened: typed · voice (turn by turn) · live (VIDYA Live, kept as a transcript). */
  mode?: 'typed' | 'voice' | 'live';
  /** Translated mode word. Defaults: Typed, Voice, Live voice. */
  modeLabel?: string;
  /** When, already formatted: "today", "yesterday", "16 Sept". */
  when?: string;
  /** Replaces the built meta line entirely (pass it translated). */
  meta?: React.ReactNode;
  /** Kept: held for good instead of rolling over with the 10 most recent. Adds the word "Kept" to the meta line. */
  kept?: boolean;
  /** Translated "Kept". */
  keptLabel?: string;
  /** Opens the transcript. Makes the row a button. */
  onClick?: (e: React.MouseEvent) => void;
  /** Shows the keep toggle (aria-pressed); called with the new value. */
  onKeep?: (kept: boolean) => void;
  /** Translated "Keep"; the toggle's name is this word plus the ask. */
  keepLabel?: string;
  /** 'li' renders the row as a list item (put rows in a <ul>). */
  as?: 'li' | 'div';
  disabled?: boolean;
  /** BCP 47 code when the ask is in an Indic language. */
  lang?: string;
  id?: string;
  className?: string;
  style?: React.CSSProperties;
}
export declare function ConversationRow(props: ConversationRowProps): React.ReactElement;

export interface UsageMeterStat {
  /** The number, as shown: "31", "14h", "3". */
  value: React.ReactNode;
  /** What it counts: "made", "saved", "classes". */
  label: string;
}
export interface UsageMeterLive {
  /** VIDYA Live minutes left this month. */
  left: number;
  /** The month's allowance in minutes. */
  total: number;
  /** At or below this many minutes the left count turns saffron. Default 5. */
  lowAt?: number;
  /** The row's name. Default "VIDYA Live". */
  label?: string;
  /** The visible count. Default "<left> min left". */
  leftText?: string;
  /** The bar's accessible name. Default "VIDYA Live minutes used this month". */
  barLabel?: string;
  /** Spoken value. Default "<used> of <total> minutes used, <left> left". */
  valueText?: string;
}
export interface UsageMeterProps {
  /** The eyebrow, also the section's name. Default "This month". */
  title?: string;
  /** The plan pill: "Free plan", "School plan". */
  plan?: string;
  /** Pill tone. saffron (default) for a free or trial plan, leaf for a paid school plan. */
  planTone?: 'saffron' | 'leaf';
  /** Up to three counts, read as label then value. */
  stats?: UsageMeterStat[];
  /** Quota used, 0-100. Omit to hide the bar. */
  used?: number;
  /** The bar's accessible name. Default "Quota used this month". */
  quotaLabel?: string;
  /** Spoken value, e.g. "62% used, resets 1 Nov". */
  quotaText?: string;
  /** The line under the bar: "Quota is per conversation; refining never locks you out mid-task." */
  note?: React.ReactNode;
  /** false hides the quota bar (e.g. unlimited school plans). */
  showQuota?: boolean;
  /** VIDYA Live minutes. Shown on every plan, since Live is metered. */
  live?: UsageMeterLive;
  /** BCP 47 code when the labels are in an Indic language. */
  lang?: string;
  id?: string;
  className?: string;
  style?: React.CSSProperties;
  children?: React.ReactNode;
}
export declare function UsageMeter(props: UsageMeterProps): React.ReactElement;

export type LibraryItemType = 'lesson-plan' | 'worksheet' | 'quiz' | 'exam-paper' | 'rubric' | 'visual-aid' | 'instant-answer';
export interface LibraryFact {
  /** "Class 6", "CBSE · NCERT Curiosity 6, Ch 8", "हिन्दी". */
  label: React.ReactNode;
  /** leaf: class facts · indigo: board and book · amber: language. */
  tone?: 'leaf' | 'indigo' | 'amber' | 'saffron';
  lang?: string;
  key?: string;
}
export interface LibraryCardProps {
  /** generation (default): a grid card for one artifact · conversation: a list row for one chat with VIDYA. */
  variant?: 'generation' | 'conversation';
  /** The artifact's name or the conversation's title. The card's heading and its open link. */
  title: React.ReactNode;
  /** Heading level. Default 3 (under the page h1 and a section h2). */
  headingLevel?: 2 | 3 | 4;
  /** Opens the artifact or conversation. The whole card is the target; the action buttons sit above it. */
  href?: string;
  onOpen?: () => void;
  /** generation: the artifact type; sets the badge letters, tint and the type word. */
  type?: LibraryItemType;
  /** Translated type word. Default "Lesson plan", "Worksheet", … */
  typeLabel?: string;
  /** Override the badge letters ("LP"). */
  abbr?: string;
  /** generation: board-aware facts as pills, in order: class (leaf), board and book (indigo), language (amber). */
  facts?: LibraryFact[];
  /** Accessible name of the facts list. Default "About it". */
  factsLabel?: string;
  /** When it was last edited, in words ("Edited today, 10:20"). */
  date?: React.ReactNode;
  /** generation: ready (default, nothing shown) · synced: a quiet leaf "Synced" where sync matters (an offline-capable device) · writing: VIDYA is still writing it (saffron, announced, no download or share yet) · waiting: made offline, not synced (amber). */
  status?: 'ready' | 'synced' | 'writing' | 'waiting';
  /** Translated status word. Default "Synced", "Writing…" or "Waiting to sync". */
  statusLabel?: string;
  onDownload?: () => void;
  onShare?: () => void;
  /** Ask first: open a Dialog (alertdialog) before deleting. */
  onDelete?: () => void;
  /** Translated icon-button names: { download, share, delete }. */
  actionLabels?: { download?: string; share?: string; delete?: string };
  /** conversation: live (a Live voice conversation, the orb mark) or typed (the message mark). */
  mode?: 'live' | 'typed';
  /** Override "Live voice" / "Typed". */
  modeLabel?: string;
  /** conversation: its length ("6 min", "14 messages"). */
  detail?: React.ReactNode;
  /** conversation: the language spoken, in its own script ("हिन्दी"). */
  language?: string;
  /** conversation: kept (bookmarked), so it is never pruned. */
  saved?: boolean;
  onToggleSaved?: () => void;
  /** Default "Keep this conversation" and "Kept". */
  keepLabel?: string;
  keptLabel?: string;
  /** Default "Open". */
  openLabel?: string;
  id?: string;
  lang?: string;
  className?: string;
  style?: React.CSSProperties;
}
export declare function LibraryCard(props: LibraryCardProps): React.ReactElement;

export type DataTableOutcome = 'confirmed' | 'completed' | 'heard' | 'cannot' | 'busy' | 'progress' | 'calling' | 'noanswer' | 'waiting' | 'unknown' | 'failed';
export interface DataTableColumn<Row = any> {
  /** The row field this column shows; also the sort key. */
  key: string;
  /** The header, translated. A string, or a node with `label` for the stacked view. */
  header: React.ReactNode;
  /** Plain-text header for the stacked card's labels when header is a node. */
  label?: string;
  /** text (default) · phone: masked as ••••••4412, spoken "Phone ending 4412" · outcome: a pill with a dot and a word (value: a DataTableOutcome or { kind, label }) · duration: seconds as "1 min 12 s" · time: a string, or a Date shown as "4:18 pm" · number: tabular. Empty values show a dash, spoken "None". */
  type?: 'text' | 'phone' | 'outcome' | 'duration' | 'time' | 'number';
  /** Custom cell. Put a secondary line in <span class="sk-dt__sub">. */
  render?: (row: Row) => React.ReactNode;
  /** A sort button in the header; the th carries aria-sort. */
  sortable?: boolean;
  /** The first direction when this column is chosen. Default 'ascending'. */
  defaultDirection?: 'ascending' | 'descending';
  /** The value to sort by when it differs from row[key] (e.g. an ISO time behind "4:18 pm"). */
  sortValue?: (row: Row) => string | number | Date | null;
  /** end: right-aligned numbers. */
  align?: 'start' | 'end';
  /** The stacked card's title (full width, 600). Usually the family or name column. */
  primary?: boolean;
  /** Render as a row header (th scope="row"). */
  rowHeader?: boolean;
  /** Leave out of the stacked card (the primary column already says it). */
  hideStacked?: boolean;
  width?: number | string;
}
export interface DataTableSort { key: string; direction: 'ascending' | 'descending'; }
export interface DataTableProps<Row = any> {
  columns: DataTableColumn<Row>[];
  rows: Row[];
  /** The table's name, read first by screen readers ("Calls today, newest first"). Visually hidden unless captionVisible. */
  caption: string;
  captionVisible?: boolean;
  /** Field or function giving each row a stable key. Default 'id'. */
  rowKey?: string | ((row: Row) => string);
  /** Controlled sort. Pass sort + onSort, or defaultSort. The table sorts the rows itself unless manualSort. */
  sort?: DataTableSort | null;
  defaultSort?: DataTableSort;
  onSort?: (sort: DataTableSort) => void;
  /** The rows arrive already sorted (server-side); the header still shows the sort and onSort asks for the next order. */
  manualSort?: boolean;
  /** Skeleton rows while the first page loads; the table is aria-busy and "Loading" is announced. */
  loading?: boolean;
  loadingRows?: number;
  /** Shown when there are no rows: { title, body, action: { label, onClick | href } }, or any node. */
  empty?: { title?: React.ReactNode; body?: React.ReactNode; action?: { label: string; onClick?: () => void; href?: string } } | React.ReactElement;
  /** comfortable (default) 56px rows · compact 48px. */
  density?: 'comfortable' | 'compact';
  /** Translated words: { phone: 'Phone ending {last4}', none: 'None', loading: 'Loading', outcomes: { confirmed: 'पक्का', … } }. */
  labels?: { phone?: string; none?: string; loading?: string; outcomes?: Partial<Record<DataTableOutcome, string>> };
  id?: string;
  lang?: string;
  className?: string;
  style?: React.CSSProperties;
}
export declare function DataTable<Row = any>(props: DataTableProps<Row>): React.ReactElement;
export declare namespace DataTable {
  /** "9845014412" -> "••••••4412". */
  function mask(phone: string): string;
  /** 72 -> "1 min 12 s". */
  function duration(seconds: number): string;
}

export interface SourceLabelProps {
  /** campaign: a call from a campaign the school ran (saffron tint, megaphone) · teacher: a teacher's own call from Attendance (neutral, person) · integration: asked for by the school's own system through an API key (outlined, plug). */
  source: 'campaign' | 'teacher' | 'integration';
  /** Translated word. Default "Campaign", "Teacher", "Integration". */
  label?: string;
  /** What it was, beside the pill: "PTM invitation", "Class 6 A", "School ERP". */
  detail?: React.ReactNode;
  /** Words read before the label, e.g. "Source:" in a table without a Source column. */
  srPrefix?: string;
  id?: string;
  lang?: string;
  className?: string;
  style?: React.CSSProperties;
}
export declare function SourceLabel(props: SourceLabelProps): React.ReactElement;

export type ApiKeyScope = 'lesson-planner' | 'exam-paper' | 'quiz';
export interface ApiKeyRowProps {
  /** The name the administrator gave it ("School LMS"). */
  label: React.ReactNode;
  /** The masked key as the server returns it ("sk_sahayak_k7f3a9_…"). The secret is never shown again after KeyReveal. */
  displayKey?: string;
  /** What the key may use. Calling parents is never a scope. */
  scopes: ApiKeyScope[];
  /** Translated scope words. Default "Lesson planner", "Exam paper", "Quiz". */
  scopeLabels?: Partial<Record<ApiKeyScope, string>>;
  /** 'you' when the signed-in administrator made it, 'admin' for anyone else ("A school administrator"), or a name. */
  createdBy?: 'you' | 'admin' | string;
  /** When it was made ("12 Oct 2026"). */
  created?: React.ReactNode;
  /** In words ("2 hours ago"); omit for "Never used". */
  lastUsed?: React.ReactNode;
  /** active (leaf, with Revoke) · revoked (stone, no action). */
  status?: 'active' | 'revoked';
  /** When it was revoked ("3 Oct 2026"). */
  revokedOn?: React.ReactNode;
  /** Called after the administrator confirms in the Dialog. */
  onRevoke?: () => void;
  /** Disables Revoke and shows "Revoking…" while the request runs. */
  revoking?: boolean;
  /** false skips the confirmation (only when the consumer confirms elsewhere). Default true. */
  confirm?: boolean;
  /** Keep the confirmation Dialog inside the nearest positioned ancestor (previews). */
  confirmContained?: boolean;
  /** Render as an li inside the consumer's ul. Default 'div'. */
  as?: 'div' | 'li';
  /** Heading level of the name. Default 'h3'. */
  headingAs?: 'h3' | 'h4' | 'div';
  /** Translations: you, admin, active, revoked, scopes, createdBy, lastUsed, revokedOn, never, revoke, revoking, confirmTitle ("Revoke {label}?"), confirmBody, cancel, revokeKey. */
  labels?: Partial<Record<'you' | 'admin' | 'active' | 'revoked' | 'scopes' | 'createdBy' | 'lastUsed' | 'revokedOn' | 'never' | 'revoke' | 'revoking' | 'confirmTitle' | 'confirmBody' | 'cancel' | 'revokeKey', string>>;
  id?: string;
  lang?: string;
  className?: string;
  style?: React.CSSProperties;
}
export declare function ApiKeyRow(props: ApiKeyRowProps): React.ReactElement;

export interface KeyRevealProps {
  /** The full key, exactly as the server returned it once ("sk_sahayak_k7f3a9_…"). Drop it from state when this closes. */
  apiKey: string;
  /** The key's name ("School LMS"), used in the title. */
  label?: string;
  /** Override the title. Default "Key created: <label>". */
  title?: string;
  /** card (default): a standalone card with its title and Done · plain: the body of a Dialog that carries the title and Done. */
  surface?: 'card' | 'plain';
  /** Called after a successful copy. */
  onCopy?: () => void;
  /** The card's Done button; the consumer forgets the key here. */
  onDone?: () => void;
  /** Heading level of the title. Default 'h3'. */
  headingAs?: 'h2' | 'h3' | 'h4';
  /** Translations: eyebrow, title ("Key created: {label}"), warning, keyLabel, copy, copied, copiedButton, failed, help, done. */
  labels?: Partial<Record<'eyebrow' | 'title' | 'warning' | 'keyLabel' | 'copy' | 'copied' | 'copiedButton' | 'failed' | 'help' | 'done', string>>;
  id?: string;
  lang?: string;
  className?: string;
  style?: React.CSSProperties;
}
export declare function KeyReveal(props: KeyRevealProps): React.ReactElement;

export type OutcomeKind = 'confirmed' | 'heard' | 'cannot' | 'progress' | 'noanswer' | 'waiting';
export interface OutcomeSegment {
  /** confirmed leaf-500 solid · heard indigo-500 solid · cannot amber-500 hatch · progress saffron-500 dotted · noanswer ink-600 · waiting border-control (not yet called). */
  kind: OutcomeKind;
  /** Families with this outcome. Zero shows in the legend and table, not the bar. */
  count: number;
  /** The word; a string or a node. Defaults to "Confirmed", "Heard", "Cannot come", "In progress", "No answer", "Waiting". */
  label?: React.ReactNode;
  lang?: string;
}
export interface OutcomeBarProps {
  /** "Parent calls today". Also the hidden table's caption. */
  title?: React.ReactNode;
  /** "Class 7 · 38 families". */
  context?: React.ReactNode;
  /** The outcomes in order: confirmed, heard, cannot come, in progress, no answer, waiting. */
  segments: OutcomeSegment[];
  /** The bar's spoken summary. Built from title and segments when omitted; pass a translation for non-English consoles. */
  ariaLabel?: string;
  /** The summary's closing words after the total. Default "in all". */
  totalLabel?: string;
  /** Hidden table headers. Default "Outcome" and "Families". */
  outcomeHeader?: string;
  countHeader?: string;
  /** Hidden table caption when there is no title. */
  tableCaption?: string;
  id?: string;
  lang?: string;
  className?: string;
  style?: React.CSSProperties;
}
export declare function OutcomeBar(props: OutcomeBarProps): React.ReactElement;

export interface DocumentFact {
  /** "Class", "Subject", "Board", "Textbook", "Chapter", "Duration", "Date". Latin is uppercased and tracked; Indic is not. */
  label: React.ReactNode;
  /** "7", "Mathematics", "CBSE", "NCERT Ganita Prakash 7", "8 · Working with Fractions". */
  value: React.ReactNode;
  lang?: string;
  key?: string;
}
export interface DocumentSection {
  /** "Hook · 5 min". */
  title: React.ReactNode;
  /** The text, or a node (a list, steps). */
  body: React.ReactNode;
  lang?: string;
  key?: string;
}
export interface DocumentSheetProps {
  /** The school's header: name, place, and a logo (an image URL or a node; defaults to the name's initials in a 40px square). Omit to print without a header. */
  school?: { name: React.ReactNode; place?: React.ReactNode; logo?: string | React.ReactNode };
  /** The document's title, its <h1> ("Fractions in everyday cooking"). */
  title: React.ReactNode;
  /** The facts grid, four across. Name the board and textbook, never assume NCERT. */
  meta?: DocumentFact[];
  /** The body sections, in order. */
  sections?: DocumentSection[];
  /** Builds the default footer "Prepared with SahayakAI · Page 1 of 2". */
  page?: number;
  pages?: number;
  /** Replaces the footer line (pass a translation). */
  footer?: React.ReactNode;
  id?: string;
  lang?: string;
  className?: string;
  style?: React.CSSProperties;
}
export declare function DocumentSheet(props: DocumentSheetProps): React.ReactElement;

export interface PhoneScreenProps {
  /** The ground. screen: the warm wash (default) · working: the indigo wash while VIDYA writes · call: the leaf wash on a parent call · camera: the scanner's dark ground with milk text and no glow · live-*: VIDYA Live, where the whole screen takes the colour of her state and is lit from behind the orb (no corner glow). */
  wash?: 'screen' | 'working' | 'call' | 'camera' | 'live-listening' | 'live-working' | 'live-speaking' | 'live-failed';
  /** The saffron glow top-right. Default true (false on camera). */
  glow?: boolean;
  /** The phone shadow. false when the screen sits inside a device frame. Default true. */
  frame?: boolean;
  /** Status bar network text ("lte ▮", "no signal"). */
  network?: string;
  /** Status bar clock. Default "9:41". */
  time?: string;
  /** Positioned layer drawn over the content: OrbHint, the TabBar dock, OrbPrompt, sheets. */
  overlay?: React.ReactNode;
  /** Bottom padding of the content in px. 96 clears the tab bar (default); 0 under a sheet; 150 under an OrbPrompt. */
  padBottom?: number;
  /** Gap between content blocks. Default 14. */
  gap?: number | string;
  /** Height override for previews. Default 760. */
  height?: number | string;
  /** Screen content, stacked. */
  children?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}
export declare function PhoneScreen(props: PhoneScreenProps): React.ReactElement;

export interface DevicePhoneProps {
  /** Screen width in px (default 318). The bezel adds 13px and a 1px edge on every side. On a narrower column the screen scales down, keeping its 318:672 ratio. */
  width?: number;
  /** Screen height in px (default 672). */
  height?: number;
  /** What the screen shows, read as one image ("SahayakAI home: two periods, one prep gap"). Default "SahayakAI app screen". */
  label?: string;
  /** Keep the screen's controls live. Off by default: the mock is a picture, inert, and announced by `label`. */
  interactive?: boolean;
  id?: string;
  className?: string;
  style?: React.CSSProperties;
  /** An app screen composition, drawn on `wash-screen`. Position the parked orb and tab bar absolutely inside it. */
  children?: React.ReactNode;
}
export declare function DevicePhone(props: DevicePhoneProps): React.ReactElement;

export interface ScreenSliderProps {
  /** 360×760 app screen compositions, scaled down. They are pictures: inert and announced by caption. */
  screens: React.ReactNode[];
  /** One caption per screen, shown left of the dots ("Home", "Lesson"). */
  captions?: string[];
  /** Milliseconds per screen (default 2400). Pauses on hover and focus, and does not run under prefers-reduced-motion. */
  interval?: number;
  /** Viewport width in px (default 259 = 360 × .72). */
  width?: number;
  /** Viewport height in px (default 547 = 760 × .72). */
  height?: number;
  /** Screen scale (default .72). */
  scale?: number;
  /** The active dot: saffron (default), indigo, leaf, clay, or any CSS colour. */
  accent?: 'saffron' | 'indigo' | 'leaf' | 'clay' | string;
  /** The carousel region's accessible name. Default "App screens". */
  label?: string;
  id?: string;
  className?: string;
  style?: React.CSSProperties;
}
export declare function ScreenSlider(props: ScreenSliderProps): React.ReactElement;

export interface WebNavLink {
  label: string;
  /** In-page anchor or page URL. */
  href: string;
  /** Marks the current page (aria-current="page"). */
  current?: boolean;
  lang?: string;
}
export interface WebNavProps {
  /** Four or five links. A string becomes an anchor of its slug ("For schools" → "#for-schools"). Default Product, VIDYA, For schools, Trust. */
  links?: Array<string | WebNavLink>;
  /** The one dark pill action. Default "Book a school pilot"; null hides it. */
  cta?: string | null;
  /** Makes the CTA a link. */
  ctaHref?: string;
  onCta?: () => void;
  /** Makes the orb and wordmark a link home. */
  homeHref?: string;
  /** The wordmark. Default "SahayakAI". */
  brand?: string;
  /** The folded menu button's label under 760px. Default "Menu". */
  menuLabel?: string;
  /** The nav landmark's name. Default "Main". */
  navLabel?: string;
  /** Start with the folded menu open (narrow widths only). */
  defaultOpen?: boolean;
  id?: string;
  lang?: string;
  className?: string;
  style?: React.CSSProperties;
}
export declare function WebNav(props: WebNavProps): React.ReactElement;

export interface WebHeroProps {
  /** Text in the live-dot capsule ("For every Indian classroom"). */
  eyebrow?: React.ReactNode;
  /** The headline before the accent ("Say it once."). Add a <br/> to break before the accent. */
  title: React.ReactNode;
  /** Set in saffron-600 after the title ("VIDYA does the rest."). */
  accentWord?: React.ReactNode;
  /** One sentence on what the product does. */
  lead?: React.ReactNode;
  /** Buttons: one primary plus one outline, size "web". */
  actions?: React.ReactNode;
  /** Three or four sm MetricCards, each linking to the section that proves it. */
  metrics?: React.ReactNode;
  /** Accessible name of the metric strip. Default "At a glance". */
  metricsLabel?: string;
  /** A DevicePhone (or an image) for the right column. */
  media?: React.ReactNode;
  id?: string;
  lang?: string;
  className?: string;
  style?: React.CSSProperties;
}
export declare function WebHero(props: WebHeroProps): React.ReactElement;

export interface WebSectionProps {
  /** Anchor for nav links and MetricCards ("product", "boards"). */
  id?: string;
  /** Saffron tracked label above the title ("The reality"). */
  eyebrow?: React.ReactNode;
  /** The headline: two short contrasting clauses. Names the section landmark. */
  title?: React.ReactNode;
  /** One or two sentences under the title. */
  lead?: React.ReactNode;
  /** milk = page ground (default) · band = the alternate section · card = white. Alternate milk and band down a page. */
  tone?: 'milk' | 'band' | 'card';
  /** Header alignment. Default left; center for testimonials and closing sections. */
  align?: 'left' | 'center';
  /** The faint drifting saffron blob, top left. */
  glow?: boolean;
  /** Title element. Default h2. */
  titleAs?: keyof JSX.IntrinsicElements;
  lang?: string;
  className?: string;
  style?: React.CSSProperties;
  /** The section body: a FeatureGrid, ScreenSliders, a Testimonial. */
  children?: React.ReactNode;
}
export declare function WebSection(props: WebSectionProps): React.ReactElement;

export interface FeatureCardProps {
  /** Short tracked label beside the accent dot ("For the teacher", "Assess"). */
  eyebrow?: React.ReactNode;
  /** The card title, one short line ("Less evening work, more teaching"). */
  title: React.ReactNode;
  /** One or two sentences under the title. */
  body?: React.ReactNode;
  /** Three or four bullets: [boldLead, rest] pairs or plain strings. */
  points?: Array<string | [string, string]>;
  /** Dot and bullet colour: saffron (default), indigo, leaf, clay (saffron-800), or any CSS colour. */
  accent?: 'saffron' | 'indigo' | 'leaf' | 'clay' | string;
  /** The ink-800 card. At most one per grid. */
  dark?: boolean;
  /** Root element. Default div; use 'article' or 'li' to fit the page. */
  as?: keyof JSX.IntrinsicElements;
  /** Title element. Default h3 (under a WebSection h2). */
  titleAs?: keyof JSX.IntrinsicElements;
  id?: string;
  lang?: string;
  className?: string;
  style?: React.CSSProperties;
  /** Extra content after the points (a link, a ScreenSlider). */
  children?: React.ReactNode;
}
export declare function FeatureCard(props: FeatureCardProps): React.ReactElement;

export interface FeatureGridProps {
  /** Minimum card width in px before the grid drops a column (default 290). Cards fill the row. */
  min?: number;
  /** Root element. Default div; 'ul' when the children are 'li' cards. */
  as?: keyof JSX.IntrinsicElements;
  id?: string;
  className?: string;
  style?: React.CSSProperties;
  children?: React.ReactNode;
}
export declare function FeatureGrid(props: FeatureGridProps): React.ReactElement;

export interface MetricCardProps {
  /** The proof, short: "29 boards", "11 languages", "1 sentence". True numbers only; never an invented usage or outcome figure. */
  value: string;
  /** What the value means, one line: "CBSE, ICSE / ISC and 27 state boards". */
  label: string;
  /** The section that proves it ("#boards"). Default "#". */
  href?: string;
  /** Value colour and hover edge: saffron (default), leaf, indigo, clay (saffron-800), or any CSS colour. */
  accent?: 'saffron' | 'leaf' | 'indigo' | 'clay' | string;
  /** The tracked link cue under the label. Default "See how →"; null hides it. A trailing arrow is hidden from screen readers. */
  cta?: string | null;
  /** sm 26px value, 18px radius (hero strip) · lg 40px value, 24px radius (stat row). */
  size?: 'sm' | 'lg';
  id?: string;
  lang?: string;
  className?: string;
  style?: React.CSSProperties;
  onClick?: (e: React.MouseEvent) => void;
}
export declare function MetricCard(props: MetricCardProps): React.ReactElement;

export interface TestimonialQuote {
  /** The quote, without quotation marks (they are added). */
  text: string;
  /** Attribution line. For an unsigned sample: "Sample quote · class teacher · replace with a signed testimonial". */
  who: string;
  /** Two letters in the avatar disc. Decorative; hidden from screen readers. */
  initials?: string;
  /** Language of the quote ("hi"). */
  lang?: string;
}
export interface TestimonialProps {
  /** Two to four quotes, mixing teacher and school-leader voices. Only signed testimonials name a person. */
  quotes: TestimonialQuote[];
  /** Milliseconds per quote (default 7000). Rotation pauses on hover and focus, starts paused under prefers-reduced-motion, and has a Pause button. */
  interval?: number;
  /** The carousel region's accessible name. Default "What teachers say". */
  label?: string;
  id?: string;
  lang?: string;
  className?: string;
  style?: React.CSSProperties;
}
export declare function Testimonial(props: TestimonialProps): React.ReactElement;

export interface CTABandProps {
  /** The closing headline ("Give your teachers their evenings back."). Names the section landmark. */
  title: React.ReactNode;
  /** One sentence on what happens next. */
  lead?: React.ReactNode;
  /** The milk primary action. Default "Book a school pilot"; null hides it. */
  primary?: string | null;
  /** An optional outline action beside it. */
  secondary?: string;
  /** Makes the primary a link. */
  primaryHref?: string;
  /** Makes the secondary a link. */
  secondaryHref?: string;
  onPrimary?: () => void;
  onSecondary?: () => void;
  id?: string;
  lang?: string;
  className?: string;
  style?: React.CSSProperties;
}
export declare function CTABand(props: CTABandProps): React.ReactElement;

export interface WebFooterLink {
  label: string;
  href: string;
  lang?: string;
}
export interface WebFooterProps {
  /** Set after the wordmark with a middle dot. Default "an assistant for every teacher". null hides it. */
  tagline?: string | null;
  /** Quiet links. A string becomes an anchor of its slug. Default Product, VIDYA, Trust, Privacy, Contact. */
  links?: Array<string | WebFooterLink>;
  /** The wordmark. Default "SahayakAI". */
  brand?: string;
  /** The links' nav landmark name. Default "Footer". */
  navLabel?: string;
  id?: string;
  lang?: string;
  className?: string;
  style?: React.CSSProperties;
}
export declare function WebFooter(props: WebFooterProps): React.ReactElement;

declare global {
  interface Window {
    SahayakAI: {
      Button: typeof Button;
      Chip: typeof Chip;
      Pill: typeof Pill;
      Eyebrow: typeof Eyebrow;
      Icon: typeof Icon;
      Avatar: typeof Avatar;
      Switch: typeof Switch;
      SegmentedControl: typeof SegmentedControl;
      Field: typeof Field;
      Composer: typeof Composer;
      SearchField: typeof SearchField;
      CheckCard: typeof CheckCard;
      Checkbox: typeof Checkbox;
      Slider: typeof Slider;
      UploadDrop: typeof UploadDrop;
      BoardSwitch: typeof BoardSwitch;
      LanguagePicker: typeof LanguagePicker;
      OptionSheet: typeof OptionSheet;
      GlassCard: typeof GlassCard;
      Tile: typeof Tile;
      ToolTile: typeof ToolTile;
      NoticeCard: typeof NoticeCard;
      HonestyNote: typeof HonestyNote;
      StatTile: typeof StatTile;
      ProgressBar: typeof ProgressBar;
      Skeleton: typeof Skeleton;
      Toast: typeof Toast;
      EmptyState: typeof EmptyState;
      Sheet: typeof Sheet;
      Dialog: typeof Dialog;
      TaskRow: typeof TaskRow;
      SuggestionRow: typeof SuggestionRow;
      SettingsRow: typeof SettingsRow;
      DisclosureRow: typeof DisclosureRow;
      ChecklistStep: typeof ChecklistStep;
      RosterRow: typeof RosterRow;
      TabBar: typeof TabBar;
      SideRail: typeof SideRail;
      TopBar: typeof TopBar;
      ScreenHeader: typeof ScreenHeader;
      StatusBar: typeof StatusBar;
      Orb: typeof Orb;
      OrbHint: typeof OrbHint;
      OrbPrompt: typeof OrbPrompt;
      SpeakCard: typeof SpeakCard;
      VoiceSheet: typeof VoiceSheet;
      DeliverTray: typeof DeliverTray;
      ReadbackBar: typeof ReadbackBar;
      LiveOrb: typeof LiveOrb;
      LiveStatus: typeof LiveStatus;
      LiveHeader: typeof LiveHeader;
      LiveTranscript: typeof LiveTranscript;
      LiveCaption: typeof LiveCaption;
      LiveReceipts: typeof LiveReceipts;
      LiveControls: typeof LiveControls;
      LiveError: typeof LiveError;
      VidyaPresence: typeof VidyaPresence;
      ChatHeader: typeof ChatHeader;
      ChatBubble: typeof ChatBubble;
      AnswerCard: typeof AnswerCard;
      TypingIndicator: typeof TypingIndicator;
      ChatThread: typeof ChatThread;
      ArtifactFrame: typeof ArtifactFrame;
      ActionBar: typeof ActionBar;
      Accordion: typeof Accordion;
      FeedbackRow: typeof FeedbackRow;
      QuizQuestion: typeof QuizQuestion;
      RubricCriterion: typeof RubricCriterion;
      RubricTable: typeof RubricTable;
      MediaRow: typeof MediaRow;
      MarksChart: typeof MarksChart;
      ReviewRow: typeof ReviewRow;
      CaptureStrip: typeof CaptureStrip;
      PostCard: typeof PostCard;
      PersonAction: typeof PersonAction;
      PersonRow: typeof PersonRow;
      GroupRow: typeof GroupRow;
      GroupTile: typeof GroupTile;
      ResourceCard: typeof ResourceCard;
      MessageRow: typeof MessageRow;
      ClassTabs: typeof ClassTabs;
      TriageCard: typeof TriageCard;
      ContactRow: typeof ContactRow;
      ReasonOption: typeof ReasonOption;
      EvidenceCard: typeof EvidenceCard;
      ConceptRow: typeof ConceptRow;
      MessagePreview: typeof MessagePreview;
      ChannelOption: typeof ChannelOption;
      VoiceNoteCard: typeof VoiceNoteCard;
      CallStage: typeof CallStage;
      CallTranscript: typeof CallTranscript;
      SummaryCard: typeof SummaryCard;
      LibraryRow: typeof LibraryRow;
      ConversationRow: typeof ConversationRow;
      UsageMeter: typeof UsageMeter;
      LibraryCard: typeof LibraryCard;
      DataTable: typeof DataTable;
      SourceLabel: typeof SourceLabel;
      ApiKeyRow: typeof ApiKeyRow;
      KeyReveal: typeof KeyReveal;
      OutcomeBar: typeof OutcomeBar;
      DocumentSheet: typeof DocumentSheet;
      PhoneScreen: typeof PhoneScreen;
      DevicePhone: typeof DevicePhone;
      ScreenSlider: typeof ScreenSlider;
      WebNav: typeof WebNav;
      WebHero: typeof WebHero;
      WebSection: typeof WebSection;
      FeatureCard: typeof FeatureCard;
      FeatureGrid: typeof FeatureGrid;
      MetricCard: typeof MetricCard;
      Testimonial: typeof Testimonial;
      CTABand: typeof CTABand;
      WebFooter: typeof WebFooter;
    };
  }
}
