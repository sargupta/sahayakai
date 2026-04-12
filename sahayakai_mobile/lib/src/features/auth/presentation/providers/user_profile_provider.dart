import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/network/api_client.dart';
import '../../domain/user_profile_model.dart';
import 'auth_provider.dart';

/// Basic profile from Firebase Auth fields only.
/// Available synchronously — no network call.
final userProfileProvider = Provider.autoDispose<UserProfileModel?>((ref) {
  final user = ref.watch(authStateProvider).valueOrNull;
  if (user == null) return null;

  return UserProfileModel(
    uid: user.uid,
    displayName: user.displayName ?? '',
    email: user.email,
    phoneNumber: user.phoneNumber,
    photoURL: user.photoURL,
  );
});

/// Full profile from the backend (includes schoolName, gradeLevels, planType, etc.).
/// Use this for profile display, plan-gating decisions, and onboarding checks.
///
/// Falls back gracefully to the Firebase Auth fields if the backend call fails.
final fullUserProfileProvider =
    FutureProvider.autoDispose<UserProfileModel?>((ref) async {
  final user = ref.watch(authStateProvider).valueOrNull;
  if (user == null) return null;

  try {
    final apiClient = ref.read(apiClientProvider);
    final response = await apiClient.client.get('/user/profile');

    if (response.statusCode == 200 && response.data != null) {
      return UserProfileModel.fromJson(
          response.data as Map<String, dynamic>);
    }
  } catch (_) {
    // Network error or 404 (user not yet onboarded) — fall through to Firebase.
  }

  // Fallback: derive from Firebase Auth.
  return UserProfileModel(
    uid: user.uid,
    displayName: user.displayName ?? '',
    email: user.email,
    phoneNumber: user.phoneNumber,
    photoURL: user.photoURL,
  );
});

/// Convenience provider: returns the user's current plan type.
/// Defaults to 'free' if profile cannot be fetched.
final userPlanTypeProvider = Provider.autoDispose<String>((ref) {
  final profile = ref.watch(fullUserProfileProvider).valueOrNull;
  return profile?.planType ?? 'free';
});
