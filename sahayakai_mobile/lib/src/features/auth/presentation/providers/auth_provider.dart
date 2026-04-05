import 'package:dio/dio.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../data/auth_repository.dart';
import '../../../../core/network/api_config.dart';

// ─────────────────── Core Auth State ───────────────────

/// Emits the currently signed-in Firebase user (null when signed out).
/// Drives GoRouter redirect and all downstream auth-aware providers.
final authStateProvider = StreamProvider<User?>((ref) {
  return ref.watch(authRepositoryProvider).authStateChanges();
});

/// Simple derived boolean — avoids AsyncValue unwrapping in GoRouter redirect.
final isLoggedInProvider = Provider<bool>((ref) {
  return ref.watch(authStateProvider).valueOrNull != null;
});

// ─────────────────── Profile Existence Check ───────────────────

/// Checks whether the authenticated user has completed onboarding.
/// Returns true if profile exists (schoolName is set), false otherwise.
/// Uses autoDispose so it re-checks on every fresh navigation to AuthGate.
final profileExistsProvider = FutureProvider.autoDispose<bool>((ref) async {
  final user = ref.watch(authStateProvider).valueOrNull;
  if (user == null) return false;

  try {
    // profile-check is a public endpoint — no auth header needed.
    // Uses standalone Dio to avoid circular dependency with apiClientProvider.
    final response = await Dio().get(
      '${ApiConfig.baseUrl}/auth/profile-check',
      queryParameters: {'uid': user.uid},
    );
    return response.data['exists'] == true;
  } catch (_) {
    // Network error → assume profile exists so returning users aren't blocked.
    return true;
  }
});

// ─────────────────── Phone Auth State Machine ───────────────────

enum PhoneAuthStatus { initial, codeSent, verifying, verified, error }

class PhoneAuthState {
  final PhoneAuthStatus status;
  final String? verificationId;
  final int? resendToken;
  final String? errorMessage;
  final bool isLoading;

  const PhoneAuthState({
    this.status = PhoneAuthStatus.initial,
    this.verificationId,
    this.resendToken,
    this.errorMessage,
    this.isLoading = false,
  });

  PhoneAuthState copyWith({
    PhoneAuthStatus? status,
    String? verificationId,
    int? resendToken,
    String? errorMessage,
    bool? isLoading,
  }) {
    return PhoneAuthState(
      status: status ?? this.status,
      verificationId: verificationId ?? this.verificationId,
      resendToken: resendToken ?? this.resendToken,
      errorMessage: errorMessage,
      isLoading: isLoading ?? this.isLoading,
    );
  }
}

class PhoneAuthNotifier extends StateNotifier<PhoneAuthState> {
  final AuthRepository _authRepo;

  PhoneAuthNotifier(this._authRepo) : super(const PhoneAuthState());

  /// Send OTP to the given phone number (must include country code, e.g. +919999999999).
  Future<void> sendOtp(String phoneNumber) async {
    state = state.copyWith(
      isLoading: true,
      errorMessage: null,
      status: PhoneAuthStatus.initial,
    );

    await _authRepo.verifyPhoneNumber(
      phoneNumber: phoneNumber,
      verificationCompleted: (credential) async {
        // Auto-verify on Android (SMS auto-read).
        try {
          await _authRepo.signInWithCredential(credential);
          state = state.copyWith(
            status: PhoneAuthStatus.verified,
            isLoading: false,
          );
        } on FirebaseAuthException catch (e) {
          state = state.copyWith(
            status: PhoneAuthStatus.error,
            errorMessage: _mapAuthError(e),
            isLoading: false,
          );
        }
      },
      verificationFailed: (e) {
        state = state.copyWith(
          status: PhoneAuthStatus.error,
          errorMessage: _mapAuthError(e),
          isLoading: false,
        );
      },
      codeSent: (verificationId, resendToken) {
        state = state.copyWith(
          status: PhoneAuthStatus.codeSent,
          verificationId: verificationId,
          resendToken: resendToken,
          isLoading: false,
        );
      },
      codeAutoRetrievalTimeout: (verificationId) {
        // Only update verificationId if we haven't already verified.
        if (state.status != PhoneAuthStatus.verified) {
          state = state.copyWith(verificationId: verificationId);
        }
      },
      forceResendingToken: state.resendToken,
    );
  }

  /// Verify the OTP entered by the user.
  Future<void> verifyOtp(String otp) async {
    if (state.verificationId == null) return;
    state = state.copyWith(
      isLoading: true,
      errorMessage: null,
      status: PhoneAuthStatus.verifying,
    );

    try {
      await _authRepo.signInWithOtp(
        verificationId: state.verificationId!,
        otp: otp,
      );
      state = state.copyWith(
        status: PhoneAuthStatus.verified,
        isLoading: false,
      );
    } on FirebaseAuthException catch (e) {
      state = state.copyWith(
        status: PhoneAuthStatus.error,
        errorMessage: _mapAuthError(e),
        isLoading: false,
      );
    }
  }

  /// Reset to initial state (e.g. when navigating back to phone input).
  void reset() => state = const PhoneAuthState();

  String _mapAuthError(FirebaseAuthException e) {
    switch (e.code) {
      case 'invalid-phone-number':
        return 'Invalid phone number. Please check and try again.';
      case 'too-many-requests':
        return 'Too many attempts. Please try again later.';
      case 'invalid-verification-code':
        return 'Wrong OTP. Please try again.';
      case 'session-expired':
        return 'OTP expired. Please request a new one.';
      case 'network-request-failed':
        return 'Network error. Please check your connection.';
      default:
        return 'Authentication failed. Please try again.';
    }
  }
}

final phoneAuthProvider =
    StateNotifierProvider<PhoneAuthNotifier, PhoneAuthState>((ref) {
  return PhoneAuthNotifier(ref.read(authRepositoryProvider));
});
