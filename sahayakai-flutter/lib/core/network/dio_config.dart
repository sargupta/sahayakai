/// Base URL of the unchanged production backend. The Flutter client is a
/// native front-end over the same Next.js API the web app calls.
const String kApiBaseUrl = 'https://sahayakai.com';

// AI generation can take up to the server's maxDuration = 120 s.
const Duration kConnectTimeout = Duration(seconds: 15);
const Duration kReceiveTimeout = Duration(seconds: 125); // > server 120 s ceiling
const Duration kSendTimeout = Duration(seconds: 60); // covers image uploads
