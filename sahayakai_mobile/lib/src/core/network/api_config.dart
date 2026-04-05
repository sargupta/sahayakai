import 'dart:io' show Platform;

/// Centralized API configuration with environment-aware base URL.
///
/// Usage:
///   flutter run                          → dev (localhost)
///   flutter run --dart-define=ENV=prod   → production
class ApiConfig {
  ApiConfig._();

  static String get baseUrl {
    const env = String.fromEnvironment('ENV', defaultValue: 'dev');
    switch (env) {
      case 'prod':
        return 'https://sahayakai.app/api';
      case 'staging':
        return 'https://staging.sahayakai.app/api';
      default:
        // Dev: Android emulator uses 10.0.2.2, iOS simulator uses 127.0.0.1
        final host = Platform.isAndroid ? '10.0.2.2' : '127.0.0.1';
        return 'http://$host:3000/api';
    }
  }
}
