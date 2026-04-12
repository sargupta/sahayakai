import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/theme/glassmorphic/glass_components.dart';
import '../../data/org_repository.dart';

final _orgProvider = FutureProvider.autoDispose<Organization?>((ref) async {
  return ref.read(orgRepositoryProvider).getOrganization();
});

class OrganizationScreen extends ConsumerWidget {
  const OrganizationScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final orgAsync = ref.watch(_orgProvider);

    return GlassScaffold(
      title: 'My School',
      showBackButton: true,
      body: orgAsync.when(
        loading: () => const Center(
          child: GlassLoadingIndicator(message: 'Loading...'),
        ),
        error: (_, __) => const GlassEmptyState(
          icon: Icons.school_rounded,
          title: 'No Organization',
          message: 'You are not part of any school organization yet.',
        ),
        data: (org) {
          if (org == null) {
            return const GlassEmptyState(
              icon: Icons.school_rounded,
              title: 'No Organization',
              message: 'You are not part of any school organization yet.',
            );
          }
          return _buildOrgView(context, ref, org);
        },
      ),
    );
  }

  Widget _buildOrgView(
      BuildContext context, WidgetRef ref, Organization org) {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(GlassSpacing.xl),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          GlassCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(org.name, style: GlassTypography.headline2()),
                const SizedBox(height: GlassSpacing.xs),
                Text(
                  '${org.type.toUpperCase()} • ${org.plan.toUpperCase()} Plan',
                  style: GlassTypography.bodySmall(
                      color: GlassColors.textSecondary),
                ),
                const SizedBox(height: GlassSpacing.md),
                Text(
                  '${org.members.length} / ${org.totalSeats} members',
                  style: GlassTypography.labelMedium(),
                ),
              ],
            ),
          ),
          const SizedBox(height: GlassSpacing.xxl),

          Text('MEMBERS', style: GlassTypography.sectionHeader()),
          const SizedBox(height: GlassSpacing.lg),

          ...org.members.map((member) => Padding(
                padding: const EdgeInsets.only(bottom: GlassSpacing.md),
                child: GlassListItem(
                  icon: Icons.person_rounded,
                  iconColor: GlassColors.primary,
                  iconBackgroundColor:
                      GlassColors.primary.withOpacity(0.1),
                  title: member.displayName ?? member.phoneNumber ?? 'Teacher',
                  subtitle: member.role.toUpperCase(),
                  onTap: () {},
                ),
              )),
        ],
      ),
    );
  }
}
