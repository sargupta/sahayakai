import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/api_client.dart';

final sarkarRepositoryProvider = Provider((ref) {
  return SarkarRepository(ref.read(apiClientProvider));
});

class VerificationResult {
  final bool verified;
  final String? schoolName;
  final String? district;
  final String? state;
  final String? message;

  const VerificationResult({
    required this.verified,
    this.schoolName,
    this.district,
    this.state,
    this.message,
  });

  factory VerificationResult.fromJson(Map<String, dynamic> json) =>
      VerificationResult(
        verified: json['verified'] as bool? ?? false,
        schoolName: json['schoolName'] as String?,
        district: json['district'] as String?,
        state: json['state'] as String?,
        message: json['message'] as String?,
      );
}

class SarkarRepository {
  final ApiClient _apiClient;

  SarkarRepository(this._apiClient);

  /// POST /sarkar/verify — verify government teacher via UDISE code.
  Future<VerificationResult> verify(String udiseCode) async {
    final response = await _apiClient.client.post(
      '/sarkar/verify',
      data: {'udiseCode': udiseCode},
    );
    if (response.statusCode == 200) {
      return VerificationResult.fromJson(
          response.data as Map<String, dynamic>);
    }
    throw Exception('Verification failed: ${response.statusCode}');
  }
}
