import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/api_client.dart';

final fieldTripRepositoryProvider = Provider((ref) {
  return FieldTripRepository(ref.read(apiClientProvider));
});

class FieldTripOutput {
  final String title;
  final List<FieldTripStop> stops;
  final String? gradeLevel;
  final String? subject;

  const FieldTripOutput({
    required this.title,
    this.stops = const [],
    this.gradeLevel,
    this.subject,
  });

  factory FieldTripOutput.fromJson(Map<String, dynamic> json) => FieldTripOutput(
        title: json['title'] as String? ?? '',
        stops: (json['stops'] as List<dynamic>?)
                ?.map((s) => FieldTripStop.fromJson(s as Map<String, dynamic>))
                .toList() ??
            [],
        gradeLevel: json['gradeLevel'] as String?,
        subject: json['subject'] as String?,
      );
}

class FieldTripStop {
  final String name;
  final String description;
  final String educationalFact;
  final String reflectionPrompt;
  final String? googleEarthUrl;
  final String? culturalAnalogy;
  final String? explanation;

  const FieldTripStop({
    required this.name,
    required this.description,
    required this.educationalFact,
    required this.reflectionPrompt,
    this.googleEarthUrl,
    this.culturalAnalogy,
    this.explanation,
  });

  factory FieldTripStop.fromJson(Map<String, dynamic> json) => FieldTripStop(
        name: json['name'] as String? ?? '',
        description: json['description'] as String? ?? '',
        educationalFact: json['educationalFact'] as String? ?? '',
        reflectionPrompt: json['reflectionPrompt'] as String? ?? '',
        googleEarthUrl: json['googleEarthUrl'] as String?,
        culturalAnalogy: json['culturalAnalogy'] as String?,
        explanation: json['explanation'] as String?,
      );
}

class FieldTripRepository {
  final ApiClient _apiClient;

  FieldTripRepository(this._apiClient);

  Future<FieldTripOutput> generate({
    required String topic,
    String? gradeLevel,
    String? language,
  }) async {
    final response = await _apiClient.client.post(
      '/ai/virtual-field-trip',
      data: {
        'topic': topic,
        if (gradeLevel != null) 'gradeLevel': gradeLevel,
        if (language != null) 'language': language,
      },
    );

    if (response.statusCode == 200) {
      return FieldTripOutput.fromJson(response.data as Map<String, dynamic>);
    }
    throw Exception('Virtual field trip failed: ${response.statusCode}');
  }
}
