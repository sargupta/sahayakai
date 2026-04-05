import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../providers/auth_provider.dart';
import '../providers/onboarding_provider.dart';
import '../../../../core/providers/language_provider.dart';
import '../../../../core/theme/glassmorphic/glass_components.dart';

/// Profile setup screen shown after first sign-in.
/// Collects: displayName, schoolName, gradeLevels, subjects, preferredLanguage.
class OnboardingScreen extends ConsumerWidget {
  const OnboardingScreen({super.key});

  static const _grades = [
    'Class 1', 'Class 2', 'Class 3', 'Class 4',
    'Class 5', 'Class 6', 'Class 7', 'Class 8',
    'Class 9', 'Class 10', 'Class 11', 'Class 12',
  ];

  static const _subjects = [
    'Mathematics', 'Science', 'English', 'Hindi',
    'Social Studies', 'Computer Science', 'Physics',
    'Chemistry', 'Biology', 'Geography', 'History',
    'Economics', 'Accountancy', 'Art',
  ];

  // Use the canonical language list from the provider (single source of truth).

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(onboardingProvider);
    final notifier = ref.read(onboardingProvider.notifier);

    return GlassScaffold(
      title: 'Complete Your Profile',
      showBackButton: false,
      body: SingleChildScrollView(
        padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // Name
            GlassTextField(
              labelText: 'YOUR NAME',
              hintText: 'e.g. Priya Sharma',
              onChanged: notifier.setDisplayName,
            ),
            const SizedBox(height: 16),

            // School
            GlassTextField(
              labelText: 'SCHOOL NAME',
              hintText: 'e.g. Delhi Public School, Bangalore',
              onChanged: notifier.setSchoolName,
            ),
            const SizedBox(height: 24),

            // Grade Levels
            _SectionLabel('GRADE LEVELS'),
            const SizedBox(height: 8),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: _grades.map((grade) {
                final selected = state.gradeLevels.contains(grade);
                return ChoiceChip(
                  label: Text(grade),
                  selected: selected,
                  selectedColor: GlassColors.primary.withValues(alpha: 0.2),
                  onSelected: (_) => notifier.toggleGradeLevel(grade),
                  side: BorderSide(
                    color: selected ? GlassColors.primary : GlassColors.border,
                  ),
                );
              }).toList(),
            ),
            const SizedBox(height: 24),

            // Subjects
            _SectionLabel('SUBJECTS YOU TEACH'),
            const SizedBox(height: 8),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: _subjects.map((subject) {
                final selected = state.subjects.contains(subject);
                return ChoiceChip(
                  label: Text(subject),
                  selected: selected,
                  selectedColor: GlassColors.primary.withValues(alpha: 0.2),
                  onSelected: (_) => notifier.toggleSubject(subject),
                  side: BorderSide(
                    color: selected ? GlassColors.primary : GlassColors.border,
                  ),
                );
              }).toList(),
            ),
            const SizedBox(height: 24),

            // Preferred Language
            GlassDropdown<String>(
              labelText: 'PREFERRED LANGUAGE',
              value: state.preferredLanguage,
              items: languageDisplayNames
                  .map((lang) => DropdownMenuItem(
                        value: lang,
                        child: Text(lang),
                      ))
                  .toList(),
              onChanged: (v) {
                if (v != null) notifier.setPreferredLanguage(v);
              },
            ),
            const SizedBox(height: 24),

            // Error
            if (state.error != null)
              Padding(
                padding: const EdgeInsets.only(bottom: 16),
                child: Text(
                  state.error!,
                  textAlign: TextAlign.center,
                  style: TextStyle(color: GlassColors.error, fontSize: 14),
                ),
              ),

            // Submit
            GlassPrimaryButton(
              label: 'Get Started',
              icon: Icons.rocket_launch_rounded,
              isLoading: state.isSubmitting,
              onPressed: state.isSubmitting
                  ? null
                  : () async {
                      final success = await notifier.submit();
                      if (success && context.mounted) {
                        // Invalidate profile check so AuthGateScreen re-evaluates.
                        ref.invalidate(profileExistsProvider);
                        context.go('/');
                      }
                    },
            ),
            const SizedBox(height: 32),
          ],
        ),
      ),
    );
  }
}

class _SectionLabel extends StatelessWidget {
  final String text;
  const _SectionLabel(this.text);

  @override
  Widget build(BuildContext context) {
    return Text(
      text,
      style: Theme.of(context).textTheme.labelSmall?.copyWith(
            color: GlassColors.textSecondary,
            fontWeight: FontWeight.w600,
            letterSpacing: 1.2,
          ),
    );
  }
}
