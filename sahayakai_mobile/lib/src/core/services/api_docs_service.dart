import 'package:url_launcher/url_launcher.dart';

import '../network/api_config.dart';

/// Opens the API documentation (GET /api-docs) in the system browser.
///
/// Used in developer/admin settings screen.
class ApiDocsService {
  ApiDocsService._();

  static Future<void> openDocs() async {
    final uri = Uri.parse('${ApiConfig.baseUrl}-docs');
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri, mode: LaunchMode.externalApplication);
    }
  }
}
