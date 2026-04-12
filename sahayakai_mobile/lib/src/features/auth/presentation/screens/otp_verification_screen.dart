import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../providers/auth_provider.dart';
import '../../../../core/theme/glassmorphic/glass_components.dart';

/// OTP entry screen with 6-digit input, resend timer, and auto-verify support.
class OtpVerificationScreen extends ConsumerStatefulWidget {
  const OtpVerificationScreen({super.key});

  @override
  ConsumerState<OtpVerificationScreen> createState() =>
      _OtpVerificationScreenState();
}

class _OtpVerificationScreenState
    extends ConsumerState<OtpVerificationScreen> {
  final _otpController = TextEditingController();
  Timer? _resendTimer;
  int _resendCountdown = 60;
  bool _canResend = false;

  @override
  void initState() {
    super.initState();
    _startResendTimer();
  }

  @override
  void dispose() {
    _otpController.dispose();
    _resendTimer?.cancel();
    super.dispose();
  }

  void _startResendTimer() {
    _canResend = false;
    _resendCountdown = 60;
    _resendTimer?.cancel();
    _resendTimer = Timer.periodic(const Duration(seconds: 1), (timer) {
      if (!mounted) {
        timer.cancel();
        return;
      }
      setState(() {
        _resendCountdown--;
        if (_resendCountdown <= 0) {
          _canResend = true;
          timer.cancel();
        }
      });
    });
  }

  void _verifyOtp() {
    final otp = _otpController.text.trim();
    if (otp.length != 6) return;
    ref.read(phoneAuthProvider.notifier).verifyOtp(otp);
  }

  void _resendOtp() {
    // The phone number is retained in the phoneAuthProvider state.
    // Re-triggering sendOtp with same verificationId resends.
    _startResendTimer();
    // Resend is handled by the PhoneAuthNotifier via forceResendingToken.
    // We'd need to re-call sendOtp with the same phone number.
    // For now, pop back and let user re-enter.
    Navigator.of(context).pop();
  }

  @override
  Widget build(BuildContext context) {
    final phoneState = ref.watch(phoneAuthProvider);

    // Auto-verified (Android SMS auto-read) → GoRouter redirect handles navigation.
    // No explicit navigation needed here.

    return GlassScaffold(
      title: 'Verify OTP',
      showBackButton: true,
      onBackPressed: () {
        ref.read(phoneAuthProvider.notifier).reset();
        Navigator.of(context).pop();
      },
      body: SingleChildScrollView(
        padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 32),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // Instruction
            Text(
              'Enter the 6-digit code sent to your phone',
              textAlign: TextAlign.center,
              style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                    color: GlassColors.textSecondary,
                  ),
            ),
            const SizedBox(height: 32),

            // OTP Input
            GlassCard(
              child: Padding(
                padding: const EdgeInsets.all(20),
                child: TextFormField(
                  controller: _otpController,
                  keyboardType: TextInputType.number,
                  maxLength: 6,
                  textAlign: TextAlign.center,
                  style: Theme.of(context).textTheme.headlineMedium?.copyWith(
                        fontWeight: FontWeight.bold,
                        letterSpacing: 12,
                      ),
                  inputFormatters: [
                    FilteringTextInputFormatter.digitsOnly,
                  ],
                  decoration: InputDecoration(
                    counterText: '',
                    hintText: '------',
                    hintStyle: TextStyle(
                      letterSpacing: 12,
                      color: GlassColors.textSecondary.withValues(alpha: 0.4),
                    ),
                    filled: true,
                    fillColor: GlassColors.surface.withValues(alpha: 0.3),
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(12),
                      borderSide: BorderSide(color: GlassColors.border),
                    ),
                    enabledBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(12),
                      borderSide: BorderSide(color: GlassColors.border),
                    ),
                    focusedBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(12),
                      borderSide:
                          BorderSide(color: GlassColors.primary, width: 2),
                    ),
                    contentPadding: const EdgeInsets.symmetric(
                        horizontal: 16, vertical: 16),
                  ),
                  autofocus: true,
                  onChanged: (value) {
                    if (value.length == 6) _verifyOtp();
                  },
                ),
              ),
            ),
            const SizedBox(height: 16),

            // Error message
            if (phoneState.errorMessage != null)
              Padding(
                padding: const EdgeInsets.only(bottom: 16),
                child: Text(
                  phoneState.errorMessage!,
                  textAlign: TextAlign.center,
                  style: TextStyle(color: GlassColors.error, fontSize: 14),
                ),
              ),

            // Verify button
            GlassPrimaryButton(
              label: 'Verify',
              icon: Icons.check_circle_rounded,
              isLoading: phoneState.isLoading,
              onPressed: phoneState.isLoading ? null : _verifyOtp,
            ),
            const SizedBox(height: 24),

            // Resend timer
            Center(
              child: _canResend
                  ? TextButton(
                      onPressed: _resendOtp,
                      child: Text(
                        'Resend OTP',
                        style: TextStyle(
                          color: GlassColors.primary,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    )
                  : Text(
                      'Resend in ${_resendCountdown}s',
                      style: TextStyle(
                        color: GlassColors.textSecondary,
                        fontSize: 14,
                      ),
                    ),
            ),
          ],
        ),
      ),
    );
  }
}
