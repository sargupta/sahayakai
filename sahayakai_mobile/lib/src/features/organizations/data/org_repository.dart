import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/api_client.dart';

final orgRepositoryProvider = Provider((ref) {
  return OrgRepository(ref.read(apiClientProvider));
});

class Organization {
  final String id;
  final String name;
  final String type;
  final String plan;
  final int totalSeats;
  final List<OrgMember> members;

  const Organization({
    required this.id,
    required this.name,
    required this.type,
    required this.plan,
    required this.totalSeats,
    this.members = const [],
  });

  factory Organization.fromJson(Map<String, dynamic> json) => Organization(
        id: json['id'] as String? ?? '',
        name: json['name'] as String? ?? '',
        type: json['type'] as String? ?? 'school',
        plan: json['plan'] as String? ?? 'gold',
        totalSeats: json['totalSeats'] as int? ?? 0,
        members: (json['members'] as List<dynamic>?)
                ?.map((m) => OrgMember.fromJson(m as Map<String, dynamic>))
                .toList() ??
            [],
      );
}

class OrgMember {
  final String uid;
  final String? displayName;
  final String? email;
  final String? phoneNumber;
  final String role;

  const OrgMember({
    required this.uid,
    this.displayName,
    this.email,
    this.phoneNumber,
    required this.role,
  });

  factory OrgMember.fromJson(Map<String, dynamic> json) => OrgMember(
        uid: json['uid'] as String? ?? '',
        displayName: json['displayName'] as String?,
        email: json['email'] as String?,
        phoneNumber: json['phoneNumber'] as String?,
        role: json['role'] as String? ?? 'teacher',
      );
}

class OrgRepository {
  final ApiClient _apiClient;

  OrgRepository(this._apiClient);

  Future<Organization?> getOrganization() async {
    final response = await _apiClient.client.get('/organizations');
    if (response.statusCode == 200 && response.data != null) {
      return Organization.fromJson(response.data as Map<String, dynamic>);
    }
    return null;
  }

  Future<Organization> createOrganization({
    required String name,
    required String type,
    required String plan,
    required int totalSeats,
  }) async {
    final response = await _apiClient.client.post(
      '/organizations',
      data: {
        'name': name,
        'type': type,
        'plan': plan,
        'totalSeats': totalSeats,
      },
    );
    if (response.statusCode == 200) {
      return Organization.fromJson(response.data as Map<String, dynamic>);
    }
    throw Exception('Org creation failed: ${response.statusCode}');
  }

  Future<void> inviteTeacher(String phoneNumber, String role) async {
    await _apiClient.client.post(
      '/organizations/invite',
      data: {'phoneNumber': phoneNumber, 'role': role},
    );
  }

  Future<void> removeTeacher(String userId) async {
    await _apiClient.client.post(
      '/organizations/remove',
      data: {'userId': userId},
    );
  }
}
