/// Base URL of the backend. The Flutter client is a native front-end over the
/// same Next.js API the web app calls, and defaults to production.
///
/// Override it at build/run time to point at another tier — UAT, a preview, or
/// a local server — without touching code:
///
///   flutter run   --dart-define=API_BASE_URL=https://uat.example.run.app
///   flutter build apk --dart-define=API_BASE_URL=https://uat.example.run.app
///
/// A blank or missing define falls back to production, so existing builds and
/// tests are unchanged. Any trailing slash is trimmed so a joined request path
/// never doubles up (`https://host//api/...`).
const String _apiBaseUrlRaw = String.fromEnvironment(
  'API_BASE_URL',
  defaultValue: 'https://sahayakai.com',
);

final String kApiBaseUrl = normalizeApiBaseUrl(_apiBaseUrlRaw);

/// The default backend when no `API_BASE_URL` define is supplied.
const String kDefaultApiBaseUrl = 'https://sahayakai.com';

/// Normalizes an `API_BASE_URL` value: trims surrounding whitespace, falls back
/// to [kDefaultApiBaseUrl] when it is blank, and drops a single trailing slash
/// so a joined request path never doubles up. Exposed for unit testing.
String normalizeApiBaseUrl(String value) {
  final trimmed = value.trim();
  final base = trimmed.isEmpty ? kDefaultApiBaseUrl : trimmed;
  return base.endsWith('/') ? base.substring(0, base.length - 1) : base;
}

// AI generation can take up to the server's maxDuration = 120 s.
const Duration kConnectTimeout = Duration(seconds: 15);
const Duration kReceiveTimeout = Duration(seconds: 125); // > server 120 s ceiling
const Duration kSendTimeout = Duration(seconds: 60); // covers image uploads
