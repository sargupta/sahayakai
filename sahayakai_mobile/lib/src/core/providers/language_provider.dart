import 'package:flutter_riverpod/flutter_riverpod.dart';

final languageProvider = StateNotifierProvider<LanguageNotifier, String>((ref) {
  return LanguageNotifier();
});

class LanguageNotifier extends StateNotifier<String> {
  LanguageNotifier() : super('English'); // Default

  void setLanguage(String language) {
    state = language;
  }
}

// Display names for the language selector UI (native script)
const languageDisplayNames = [
  'English', 'हिंदी', 'தமிழ்', 'తెలుగు', 'ಕನ್ನಡ',
  'मराठी', 'বাংলা', 'ગુજરાતી', 'മലയാളം', 'ਪੰਜਾਬੀ',
];

// Supported languages list
final supportedLanguages = [
  'English',
  'Hindi',
  'Tamil',
  'Telugu',
  'Kannada',
  'Marathi',
  'Bengali',
  'Gujarati',
  'Malayalam',
  'Punjabi',
  'Odia',
];

/// Map from English language name → BCP-47 locale code.
const _languageToBcp47 = <String, String>{
  'English': 'en-IN',
  'Hindi': 'hi-IN',
  'Tamil': 'ta-IN',
  'Telugu': 'te-IN',
  'Kannada': 'kn-IN',
  'Marathi': 'mr-IN',
  'Bengali': 'bn-IN',
  'Gujarati': 'gu-IN',
  'Malayalam': 'ml-IN',
  'Punjabi': 'pa-IN',
  'Odia': 'or-IN',
};

/// Map from short/BCP-47 code → English display name.
const _codeToDisplayName = <String, String>{
  'en': 'English',
  'hi': 'Hindi',
  'ta': 'Tamil',
  'te': 'Telugu',
  'kn': 'Kannada',
  'mr': 'Marathi',
  'bn': 'Bengali',
  'gu': 'Gujarati',
  'ml': 'Malayalam',
  'pa': 'Punjabi',
  'or': 'Odia',
};

/// Returns the BCP-47 code (e.g. 'hi-IN') for a given English language name.
/// Returns `null` if the language is not recognised.
String? getBcp47Code(String languageName) => _languageToBcp47[languageName];

/// Returns the English display name (e.g. 'Hindi') for a short code like 'hi'.
/// Returns `null` if the code is not recognised.
String? getDisplayName(String shortCode) => _codeToDisplayName[shortCode];
