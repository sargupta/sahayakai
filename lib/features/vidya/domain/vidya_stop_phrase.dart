/// Whether [utterance] is the teacher ending the conversation ("stop",
/// "that's all", "बस", "ரொம்ப நன்றி, போதும்"…), answered on the device so it
/// never costs a classifier call and works in every language the app speaks.
///
/// Strict on purpose: after politeness and VIDYA's name are set aside, the
/// whole utterance must BE a stop phrase. "Stop the lesson at chapter 3" or
/// "बस का किराया" are requests, not goodbyes, and go to the classifier.
bool isVidyaStopPhrase(String utterance) {
  var text = _normalise(utterance);
  for (final filler in _fillers) {
    text = text.replaceAll(_normalise(filler), ' ');
  }
  text = text.replaceAll(RegExp(r'\s+'), ' ').trim();
  if (text.isEmpty) return false;
  return _phrases.any((phrase) => _normalise(phrase).trim() == text);
}

/// Words that ride along with a goodbye without changing it.
const List<String> _fillers = [
  'vidya',
  'विद्या',
  'please',
  'ok',
  'okay',
  'thank you',
  'thanks',
  'now',
  'धन्यवाद',
  'शुक्रिया',
  'ठीक है',
  'अब',
  'प्लीज़',
  'प्लीज',
  'dhanyavaad',
  'shukriya',
  'theek hai',
  'thik hai',
  'ab',
  'ধন্যবাদ',
  'આભાર',
  'ಧನ್ಯವಾದ',
  'നന്ദി',
  'धन्यवाद',
  'ଧନ୍ୟବାଦ',
  'ਧੰਨਵਾਦ',
  'நன்றி',
  'ரொம்ப நன்றி',
  'ధన్యవాదాలు',
];

/// The goodbyes, in English, Hinglish and each of the app's Indic languages.
const List<String> _phrases = [
  // English
  'stop', 'stop listening', 'stop it', "that's all", 'that is all',
  "that's it", 'thats all', 'thats it', 'enough', 'bye', 'goodbye',
  'good bye', "i'm done", 'im done', 'i am done', "we're done", 'done',
  'end', 'end conversation', 'cancel', 'quiet',
  // Hindi + Hinglish
  'बस', 'बस करो', 'बस कीजिए', 'रुको', 'रुक जाओ', 'रुकिए', 'बंद करो',
  'बंद कीजिए', 'हो गया', 'चुप', 'अलविदा',
  'bas', 'bas karo', 'ruko', 'ruk jao', 'band karo', 'ho gaya',
  // Marathi
  'थांब', 'थांबा', 'बंद कर', 'पुरे', 'झाले',
  // Bengali
  'থামো', 'থামুন', 'থাক', 'বন্ধ করো', 'ব্যস', 'হয়ে গেছে',
  // Gujarati
  'બસ', 'બંધ કરો', 'અટકો', 'થઈ ગયું',
  // Kannada
  'ನಿಲ್ಲಿಸು', 'ನಿಲ್ಲಿಸಿ', 'ಸಾಕು', 'ಮುಗಿಯಿತು',
  // Malayalam
  'നിർത്തൂ', 'നിർത്ത്', 'നിർത്തുക', 'മതി',
  // Odia
  'ବନ୍ଦ କର', 'ବନ୍ଦ କରନ୍ତୁ', 'ରୁହ', 'ବସ୍',
  // Punjabi
  'ਬੱਸ', 'ਰੁਕੋ', 'ਬੰਦ ਕਰੋ', 'ਹੋ ਗਿਆ',
  // Tamil
  'நிறுத்து', 'நிறுத்துங்கள்', 'போதும்', 'முடிந்தது',
  // Telugu
  'ఆపు', 'ఆపండి', 'చాలు', 'అయిపోయింది',
];

/// Lower-cased, punctuation-free, single-spaced and space-padded, with the
/// Devanagari nukta dropped (speech-to-text writes it inconsistently).
String _normalise(String s) {
  final cleaned = s
      .toLowerCase()
      .replaceAll(_nukta, '')
      .replaceAll(RegExp(r"[^\p{L}\p{M}\p{N}\s']", unicode: true), ' ')
      .replaceAll("'", '')
      .replaceAll(RegExp(r'\s+'), ' ')
      .trim();
  return ' $cleaned ';
}

/// The Devanagari nukta (U+093C).
final String _nukta = String.fromCharCode(0x093C);
