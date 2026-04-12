import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/api_client.dart';

final userRepositoryProvider = Provider((ref) {
  return UserRepository(ref.read(apiClientProvider));
});

class ConsentPreferences {
  final bool analytics;
  final bool community;
  final bool trainingData;

  const ConsentPreferences({
    this.analytics = false,
    this.community = false,
    this.trainingData = false,
  });

  factory ConsentPreferences.fromJson(Map<String, dynamic> json) =>
      ConsentPreferences(
        analytics: json['analytics'] as bool? ?? false,
        community: json['community'] as bool? ?? false,
        trainingData: json['trainingData'] as bool? ?? false,
      );

  Map<String, dynamic> toJson() => {
        'analytics': analytics,
        'community': community,
        'trainingData': trainingData,
      };
}

class UserRepository {
  final ApiClient _apiClient;

  UserRepository(this._apiClient);

  /// PATCH /user/profile — partial update (experience, role, qualifications).
  Future<void> updateProfile({
    int? yearsOfExperience,
    String? administrativeRole,
    List<String>? qualifications,
  }) async {
    final response = await _apiClient.client.patch(
      '/user/profile',
      data: {
        if (yearsOfExperience != null) 'yearsOfExperience': yearsOfExperience,
        if (administrativeRole != null)
          'administrativeRole': administrativeRole,
        if (qualifications != null) 'qualifications': qualifications,
      },
    );

    if (response.statusCode != 200) {
      throw Exception('Profile update failed: ${response.statusCode}');
    }
  }

  /// GET /user/consent — DPDP consent preferences.
  Future<ConsentPreferences> getConsent() async {
    final response = await _apiClient.client.get('/user/consent');
    if (response.statusCode == 200) {
      return ConsentPreferences.fromJson(
          response.data as Map<String, dynamic>);
    }
    throw Exception('Failed to fetch consent: ${response.statusCode}');
  }

  /// POST /user/consent — update DPDP consent.
  Future<void> updateConsent(ConsentPreferences prefs) async {
    final response = await _apiClient.client.post(
      '/user/consent',
      data: prefs.toJson(),
    );
    if (response.statusCode != 200) {
      throw Exception('Consent update failed: ${response.statusCode}');
    }
  }

  /// POST /user/delete-account — initiate account deletion (30-day grace).
  Future<void> deleteAccount() async {
    final response = await _apiClient.client.post('/user/delete-account');
    if (response.statusCode != 200) {
      throw Exception('Account deletion failed: ${response.statusCode}');
    }
  }
}
