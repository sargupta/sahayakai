import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../providers/auth_provider.dart';
import '../../data/auth_repository.dart';
import '../../../../core/theme/glassmorphic/glass_components.dart';

/// Phone number input screen with +91 prefix and Google Sign-In option.
class PhoneLoginScreen extends ConsumerStatefulWidget {
  const PhoneLoginScreen({super.key});

  @override
  ConsumerState<PhoneLoginScreen> createState() => _PhoneLoginScreenState();
}

class _PhoneLoginScreenState extends ConsumerState<PhoneLoginScreen> {
  final _phoneController = TextEditingController();
  final _formKey = GlobalKey<FormState>();

  @override
  void dispose() {
    _phoneController.dispose();
    super.dispose();
  }

  void _sendOtp() {
    if (!_formKey.currentState!.validate()) return;
    final phone = '+91${_phoneController.text.trim()}';
    ref.read(phoneAuthProvider.notifier).sendOtp(phone);
  }

  @override
  Widget build(BuildContext context) {
    final phoneState = ref.watch(phoneAuthProvider);

    // Navigate to OTP screen when code is sent.
    ref.listen<PhoneAuthState>(phoneAuthProvider, (prev, next) {
      if (next.status == PhoneAuthStatus.codeSent) {
        context.push('/otp');
      }
    });

    return Scaffold(
      backgroundColor: GlassColors.background,
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 48),
          child: Form(
            key: _formKey,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                const SizedBox(height: 40),

                // App branding
                Icon(Icons.school_rounded,
                    size: 64, color: GlassColors.primary),
                const SizedBox(height: 16),
                Text(
                  'SahayakAI',
                  textAlign: TextAlign.center,
                  style: Theme.of(context).textTheme.headlineMedium?.copyWith(
                        fontWeight: FontWeight.bold,
                        color: GlassColors.primary,
                      ),
                ),
                const SizedBox(height: 8),
                Text(
                  'Your AI Teaching Assistant',
                  textAlign: TextAlign.center,
                  style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                        color: GlassColors.textSecondary,
                      ),
                ),
                const SizedBox(height: 48),

                // Phone number input
                GlassCard(
                  child: Padding(
                    padding: const EdgeInsets.all(20),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'PHONE NUMBER',
                          style:
                              Theme.of(context).textTheme.labelSmall?.copyWith(
                                    color: GlassColors.textSecondary,
                                    fontWeight: FontWeight.w600,
                                    letterSpacing: 1.2,
                                  ),
                        ),
                        const SizedBox(height: 8),
                        Row(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            // Country code prefix
                            Container(
                              height: 56,
                              padding:
                                  const EdgeInsets.symmetric(horizontal: 12),
                              decoration: BoxDecoration(
                                color: GlassColors.surface.withValues(alpha: 0.5),
                                borderRadius: BorderRadius.circular(12),
                                border:
                                    Border.all(color: GlassColors.border),
                              ),
                              alignment: Alignment.center,
                              child: Text(
                                '+91',
                                style: Theme.of(context)
                                    .textTheme
                                    .titleMedium
                                    ?.copyWith(fontWeight: FontWeight.w600),
                              ),
                            ),
                            const SizedBox(width: 8),
                            // Phone number field
                            Expanded(
                              child: TextFormField(
                                controller: _phoneController,
                                keyboardType: TextInputType.phone,
                                maxLength: 10,
                                inputFormatters: [
                                  FilteringTextInputFormatter.digitsOnly,
                                ],
                                decoration: InputDecoration(
                                  hintText: 'Enter 10-digit number',
                                  counterText: '',
                                  filled: true,
                                  fillColor:
                                      GlassColors.surface.withValues(alpha: 0.3),
                                  border: OutlineInputBorder(
                                    borderRadius: BorderRadius.circular(12),
                                    borderSide:
                                        BorderSide(color: GlassColors.border),
                                  ),
                                  enabledBorder: OutlineInputBorder(
                                    borderRadius: BorderRadius.circular(12),
                                    borderSide:
                                        BorderSide(color: GlassColors.border),
                                  ),
                                  focusedBorder: OutlineInputBorder(
                                    borderRadius: BorderRadius.circular(12),
                                    borderSide: BorderSide(
                                        color: GlassColors.primary, width: 2),
                                  ),
                                  contentPadding: const EdgeInsets.symmetric(
                                      horizontal: 16, vertical: 16),
                                ),
                                validator: (value) {
                                  if (value == null || value.trim().length != 10) {
                                    return 'Please enter a valid 10-digit number';
                                  }
                                  return null;
                                },
                              ),
                            ),
                          ],
                        ),
                      ],
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

                // Send OTP button
                GlassPrimaryButton(
                  label: 'Send OTP',
                  icon: Icons.sms_rounded,
                  isLoading: phoneState.isLoading,
                  onPressed: phoneState.isLoading ? null : _sendOtp,
                ),
                const SizedBox(height: 24),

                // Divider
                Row(
                  children: [
                    Expanded(child: Divider(color: GlassColors.border)),
                    Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 16),
                      child: Text(
                        'OR',
                        style: TextStyle(
                          color: GlassColors.textSecondary,
                          fontSize: 12,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ),
                    Expanded(child: Divider(color: GlassColors.border)),
                  ],
                ),
                const SizedBox(height: 24),

                // Google Sign-In button
                GlassSecondaryButton(
                  label: 'Sign in with Google',
                  icon: Icons.g_mobiledata_rounded,
                  onPressed: () async {
                    try {
                      final result = await ref
                          .read(authRepositoryProvider)
                          .signInWithGoogle();
                      if (result == null && context.mounted) {
                        // User cancelled — do nothing.
                      }
                      // On success, authStateProvider fires → GoRouter redirects.
                    } catch (e) {
                      if (context.mounted) {
                        ScaffoldMessenger.of(context).showSnackBar(
                          SnackBar(
                              content:
                                  Text('Google Sign-In failed: ${e.toString()}')),
                        );
                      }
                    }
                  },
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
