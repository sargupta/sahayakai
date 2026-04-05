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
];
