import 'package:dio/dio.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/network/api_config.dart';
import '../../domain/user_profile_model.dart';

class OnboardingState {
  final String displayName;
  final String schoolName;
  final List<String> gradeLevels;
  final List<String> subjects;
  final String preferredLanguage;
  final bool isSubmitting;
  final String? error;

  const OnboardingState({
    this.displayName = '',
    this.schoolName = '',
    this.gradeLevels = const [],
    this.subjects = const [],
    this.preferredLanguage = 'English',
    this.isSubmitting = false,
    this.error,
  });

  OnboardingState copyWith({
    String? displayName,
    String? schoolName,
    List<String>? gradeLevels,
    List<String>? subjects,
    String? preferredLanguage,
    bool? isSubmitting,
    String? error,
  }) {
    return OnboardingState(
      displayName: displayName ?? this.displayName,
      schoolName: schoolName ?? this.schoolName,
      gradeLevels: gradeLevels ?? this.gradeLevels,
      subjects: subjects ?? this.subjects,
      preferredLanguage: preferredLanguage ?? this.preferredLanguage,
      isSubmitting: isSubmitting ?? this.isSubmitting,
      error: error,
    );
  }

  bool get isValid =>
      displayName.trim().isNotEmpty && schoolName.trim().isNotEmpty;
}

class OnboardingNotifier extends StateNotifier<OnboardingState> {
  OnboardingNotifier() : super(const OnboardingState());

  void setDisplayName(String v) => state = state.copyWith(displayName: v);
  void setSchoolName(String v) => state = state.copyWith(schoolName: v);
  void setPreferredLanguage(String v) =>
      state = state.copyWith(preferredLanguage: v);

  void toggleGradeLevel(String grade) {
    final current = List<String>.from(state.gradeLevels);
    if (current.contains(grade)) {
      current.remove(grade);
    } else {
      current.add(grade);
    }
    state = state.copyWith(gradeLevels: current);
  }

  void toggleSubject(String subject) {
    final current = List<String>.from(state.subjects);
    if (current.contains(subject)) {
      current.remove(subject);
    } else {
      current.add(subject);
    }
    state = state.copyWith(subjects: current);
  }

  /// Submit profile to backend. Uses Dio directly with Firebase token
  /// to avoid coupling with apiClientProvider.
  Future<bool> submit() async {
    if (!state.isValid) {
      state = state.copyWith(error: 'Please fill in your name and school.');
      return false;
    }

    state = state.copyWith(isSubmitting: true, error: null);

    try {
      final user = FirebaseAuth.instance.currentUser;
      if (user == null) {
        state = state.copyWith(
            isSubmitting: false, error: 'Not authenticated. Please sign in.');
        return false;
      }

      final token = await user.getIdToken();
      final profile = UserProfileModel(
        uid: user.uid,
        displayName: state.displayName.trim(),
        email: user.email ?? '',
        phoneNumber: user.phoneNumber,
        schoolName: state.schoolName.trim(),
        gradeLevels: state.gradeLevels,
        subjects: state.subjects,
        preferredLanguage: state.preferredLanguage,
      );

      await Dio().post(
        '${ApiConfig.baseUrl}/user/profile',
        data: profile.toJson(),
        options: Options(headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer $token',
        }),
      );

      state = state.copyWith(isSubmitting: false);
      return true;
    } on DioException catch (e) {
      final msg = e.response?.data?['error']?.toString() ??
          'Failed to save profile. Please try again.';
      state = state.copyWith(isSubmitting: false, error: msg);
      return false;
    } catch (e) {
      state = state.copyWith(
          isSubmitting: false,
          error: 'Something went wrong. Please try again.');
      return false;
    }
  }
}

final onboardingProvider =
    StateNotifierProvider.autoDispose<OnboardingNotifier, OnboardingState>(
        (ref) {
  return OnboardingNotifier();
});
