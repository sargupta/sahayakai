import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/api_client.dart';

final exportRepositoryProvider = Provider((ref) {
  return ExportRepository(ref.read(apiClientProvider));
});

class ExportResponse {
  final String? jobId;
  final String? downloadUrl; // Present if inline export (small data)
  final String status;

  const ExportResponse({this.jobId, this.downloadUrl, required this.status});

  factory ExportResponse.fromJson(Map<String, dynamic> json) => ExportResponse(
        jobId: json['jobId'] as String?,
        downloadUrl: json['downloadUrl'] as String?,
        status: json['status'] as String? ?? 'pending',
      );
}

class ExportStatus {
  final String status; // 'pending' | 'processing' | 'completed' | 'failed'
  final String? downloadUrl;
  final int? progress; // 0-100

  const ExportStatus({required this.status, this.downloadUrl, this.progress});

  factory ExportStatus.fromJson(Map<String, dynamic> json) => ExportStatus(
        status: json['status'] as String? ?? 'pending',
        downloadUrl: json['downloadUrl'] as String?,
        progress: json['progress'] as int?,
      );
}

class ExportRepository {
  final ApiClient _apiClient;

  ExportRepository(this._apiClient);

  /// POST /export — request data export.
  Future<ExportResponse> requestExport() async {
    final response = await _apiClient.client.post('/export');
    if (response.statusCode == 200) {
      return ExportResponse.fromJson(response.data as Map<String, dynamic>);
    }
    throw Exception('Export request failed: ${response.statusCode}');
  }

  /// GET /export/status?jobId= — poll export status.
  Future<ExportStatus> getStatus(String jobId) async {
    final response = await _apiClient.client.get(
      '/export/status',
      queryParameters: {'jobId': jobId},
    );
    if (response.statusCode == 200) {
      return ExportStatus.fromJson(response.data as Map<String, dynamic>);
    }
    throw Exception('Status check failed: ${response.statusCode}');
  }
}
