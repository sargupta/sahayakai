import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';

import '../../../../core/network/api_client.dart';
import '../../../../core/theme/glassmorphic/glass_components.dart';
import '../../../auth/presentation/providers/user_profile_provider.dart';

// ─────────────────── Pricing data ───────────────────

class _PricingTier {
  final String id;
  final String name;
  final String tagline;
  final String price;
  final String period;
  final String? badge;
  final Color accentColor;
  final List<String> features;
  final bool isCurrentPlan;

  const _PricingTier({
    required this.id,
    required this.name,
    required this.tagline,
    required this.price,
    required this.period,
    this.badge,
    required this.accentColor,
    required this.features,
    this.isCurrentPlan = false,
  });

  /// Build a [_PricingTier] from a JSON map returned by the billing API.
  factory _PricingTier.fromJson(Map<String, dynamic> json) {
    return _PricingTier(
      id: json['id'] as String,
      name: json['name'] as String,
      tagline: json['tagline'] as String? ?? '',
      price: json['price'] as String,
      period: json['period'] as String,
      badge: json['badge'] as String?,
      accentColor: Color(
        int.parse(
          (json['accentColor'] as String? ?? 'FF9E9E9E')
              .replaceFirst('#', ''),
          radix: 16,
        ),
      ),
      features: (json['features'] as List<dynamic>?)
              ?.map((e) => e.toString())
              .toList() ??
          [],
    );
  }
}

// ─────────────────── Default / offline plans ───────────────────

const _defaultPlans = <Map<String, dynamic>>[
  {
    'id': 'free',
    'name': 'Free',
    'tagline': 'Start your AI teaching journey',
    'price': '₹0',
    'period': 'forever',
    'accentColor': 'FF4CAF50',
    'features': [
      '5 lesson plans per month',
      '3 quizzes per month',
      '2 worksheets per month',
      'Community feed access',
      'VIDYA chat (10 messages/day)',
      'Basic voice input',
    ],
  },
  {
    'id': 'teacher_pro',
    'name': 'Teacher Pro',
    'tagline': 'Unlimited AI tools for educators',
    'price': '₹299',
    'period': '/month',
    'badge': 'Most Popular',
    'accentColor': 'FFFF9800',
    'features': [
      'Unlimited lesson plans',
      'Unlimited quizzes & worksheets',
      'Exam paper generator',
      'Visual aid creator',
      'Video storyteller',
      'Virtual field trips',
      'Unlimited VIDYA chat',
      'PDF export for all content',
      'Priority support',
      'Sarvam AI voice (11 languages)',
    ],
  },
  {
    'id': 'institution',
    'name': 'Institution',
    'tagline': 'For schools and education teams',
    'price': '₹999',
    'period': '/month',
    'badge': 'Best Value',
    'accentColor': 'FF9C27B0',
    'features': [
      'Everything in Teacher Pro',
      'Up to 50 teacher accounts',
      'Admin dashboard',
      'Usage analytics',
      'Custom school branding',
      'Bulk content export',
      'Dedicated account manager',
      'SLA-backed uptime',
      'API access',
      'Annual billing discount (2 months free)',
    ],
  },
];

// ─────────────────── Plans provider ───────────────────

final plansProvider =
    FutureProvider<List<Map<String, dynamic>>>((ref) async {
  try {
    final client = ref.read(apiClientProvider).client;
    final response = await client.get('/billing/plans');
    return (response.data as List).cast<Map<String, dynamic>>();
  } catch (_) {
    // Fallback to hardcoded plans when offline or API unavailable
    return _defaultPlans;
  }
});

// ─────────────────── Screen ───────────────────

class PricingScreen extends ConsumerWidget {
  const PricingScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final currentPlan = ref.watch(userPlanTypeProvider);
    final plansAsync = ref.watch(plansProvider);

    return Scaffold(
      backgroundColor: const Color(0xFF0D0D1A),
      body: SafeArea(
        child: Column(
          children: [
            _buildHeader(context),
            Expanded(
              child: plansAsync.when(
                loading: () => const Center(
                  child: CircularProgressIndicator(color: Color(0xFFFF9800)),
                ),
                error: (_, __) => _buildPlansList(
                  ref,
                  _defaultPlans
                      .map((j) => _PricingTier.fromJson(j))
                      .toList(),
                  currentPlan,
                ),
                data: (plans) => _buildPlansList(
                  ref,
                  plans.map((j) => _PricingTier.fromJson(j)).toList(),
                  currentPlan,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildPlansList(
      WidgetRef ref, List<_PricingTier> tiers, String? currentPlan) {
    return RefreshIndicator(
      color: const Color(0xFFFF9800),
      backgroundColor: const Color(0xFF1A1A2E),
      onRefresh: () async {
        // ignore: unused_result
        ref.invalidate(plansProvider);
        // Wait for the refresh to complete
        await ref.read(plansProvider.future);
      },
      child: ListView(
        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
        children: [
          _buildSubheader(),
          const SizedBox(height: 24),
          ...tiers.map(
            (tier) => _PricingCard(
              tier: tier,
              isCurrentPlan: currentPlan == tier.id,
            ),
          ),
          const SizedBox(height: 16),
          _buildFootnote(),
          const SizedBox(height: 40),
        ],
      ),
    );
  }

  Widget _buildHeader(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(8, 8, 16, 0),
      child: Row(
        children: [
          IconButton(
            icon:
                const Icon(Icons.arrow_back_ios_new_rounded, color: Colors.white70),
            onPressed: () => context.pop(),
          ),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Choose Your Plan',
                  style: GoogleFonts.outfit(
                    fontSize: 22,
                    fontWeight: FontWeight.w700,
                    color: Colors.white,
                  ),
                ),
                Text(
                  'Upgrade anytime. Cancel anytime.',
                  style: GoogleFonts.outfit(
                      fontSize: 13, color: Colors.white54),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildSubheader() {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      decoration: BoxDecoration(
        color: Colors.white.withOpacity(0.05),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: Colors.white.withOpacity(0.08)),
      ),
      child: Row(
        children: [
          const Icon(Icons.lock_open_rounded,
              size: 18, color: Color(0xFFFF9800)),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              'SahayakAI is built for Bharat\'s 10M teachers. '
              'Pricing reflects local purchasing power.',
              style: GoogleFonts.outfit(
                  fontSize: 12, color: Colors.white60, height: 1.5),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildFootnote() {
    return Text(
      '* Prices in INR. GST applicable.\n'
      '* Annual plans available at 20% discount.\n'
      '* Government schools may qualify for subsidised plans.',
      style: GoogleFonts.outfit(fontSize: 11, color: Colors.white38, height: 1.6),
      textAlign: TextAlign.center,
    );
  }
}

// ─────────────────── Pricing Card ───────────────────

class _PricingCard extends StatelessWidget {
  final _PricingTier tier;
  final bool isCurrentPlan;

  const _PricingCard({required this.tier, required this.isCurrentPlan});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 16),
      child: Container(
        decoration: BoxDecoration(
          color: isCurrentPlan
              ? tier.accentColor.withOpacity(0.12)
              : Colors.white.withOpacity(0.05),
          borderRadius: BorderRadius.circular(20),
          border: Border.all(
            color: isCurrentPlan
                ? tier.accentColor
                : Colors.white.withOpacity(0.1),
            width: isCurrentPlan ? 1.5 : 1,
          ),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Header
            Container(
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  colors: [
                    tier.accentColor.withOpacity(0.3),
                    tier.accentColor.withOpacity(0.05),
                  ],
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                ),
                borderRadius: const BorderRadius.vertical(
                    top: Radius.circular(20)),
              ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Text(
                            tier.name,
                            style: GoogleFonts.outfit(
                              fontSize: 18,
                              fontWeight: FontWeight.w700,
                              color: Colors.white,
                            ),
                          ),
                          if (isCurrentPlan) ...[
                            const SizedBox(width: 8),
                            Container(
                              padding: const EdgeInsets.symmetric(
                                  horizontal: 8, vertical: 2),
                              decoration: BoxDecoration(
                                color: tier.accentColor,
                                borderRadius: BorderRadius.circular(8),
                              ),
                              child: Text(
                                'Current',
                                style: GoogleFonts.outfit(
                                    fontSize: 10,
                                    fontWeight: FontWeight.w700,
                                    color: Colors.white),
                              ),
                            ),
                          ],
                        ],
                      ),
                      const SizedBox(height: 2),
                      Text(
                        tier.tagline,
                        style: GoogleFonts.outfit(
                            fontSize: 12, color: Colors.white60),
                      ),
                    ],
                  ),
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.end,
                    children: [
                      if (tier.badge != null)
                        Container(
                          padding: const EdgeInsets.symmetric(
                              horizontal: 8, vertical: 3),
                          decoration: BoxDecoration(
                            color: tier.accentColor,
                            borderRadius: BorderRadius.circular(8),
                          ),
                          child: Text(
                            tier.badge!,
                            style: GoogleFonts.outfit(
                                fontSize: 10,
                                fontWeight: FontWeight.w700,
                                color: Colors.white),
                          ),
                        ),
                      const SizedBox(height: 4),
                      Text(
                        tier.price,
                        style: GoogleFonts.outfit(
                          fontSize: 28,
                          fontWeight: FontWeight.w800,
                          color: tier.accentColor,
                        ),
                      ),
                      Text(
                        tier.period,
                        style: GoogleFonts.outfit(
                            fontSize: 12, color: Colors.white54),
                      ),
                    ],
                  ),
                ],
              ),
            ),

            // Features
            Padding(
              padding: const EdgeInsets.all(20),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  ...tier.features.map(
                    (feature) => Padding(
                      padding: const EdgeInsets.only(bottom: 10),
                      child: Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Icon(
                            Icons.check_circle_rounded,
                            size: 16,
                            color: tier.accentColor,
                          ),
                          const SizedBox(width: 8),
                          Expanded(
                            child: Text(
                              feature,
                              style: GoogleFonts.outfit(
                                  fontSize: 13,
                                  color: Colors.white70,
                                  height: 1.3),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                  const SizedBox(height: 8),
                  SizedBox(
                    width: double.infinity,
                    child: _buildCTA(context),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildCTA(BuildContext context) {
    if (isCurrentPlan) {
      return OutlinedButton(
        onPressed: null,
        style: OutlinedButton.styleFrom(
          side: BorderSide(color: tier.accentColor.withOpacity(0.4)),
          shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(12)),
          padding: const EdgeInsets.symmetric(vertical: 14),
        ),
        child: Text(
          'Current Plan',
          style: GoogleFonts.outfit(
              fontSize: 14,
              fontWeight: FontWeight.w600,
              color: tier.accentColor),
        ),
      );
    }

    if (tier.id == 'free') {
      return OutlinedButton(
        onPressed: () => context.pop(),
        style: OutlinedButton.styleFrom(
          side: BorderSide(color: Colors.white.withOpacity(0.2)),
          shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(12)),
          padding: const EdgeInsets.symmetric(vertical: 14),
        ),
        child: Text(
          'Continue with Free',
          style: GoogleFonts.outfit(
              fontSize: 14,
              fontWeight: FontWeight.w600,
              color: Colors.white60),
        ),
      );
    }

    return ElevatedButton(
      onPressed: () {
        // Payment gateway integration point.
        // TODO: Integrate Razorpay / Google Pay when billing is ready.
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              'Payment coming soon! Contact us at support@sahayakai.app to upgrade.',
              style: GoogleFonts.outfit(fontSize: 13),
            ),
            backgroundColor: tier.accentColor,
            duration: const Duration(seconds: 4),
          ),
        );
      },
      style: ElevatedButton.styleFrom(
        backgroundColor: tier.accentColor,
        foregroundColor: Colors.white,
        shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(12)),
        padding: const EdgeInsets.symmetric(vertical: 14),
        elevation: 0,
      ),
      child: Text(
        'Upgrade to ${tier.name}',
        style: GoogleFonts.outfit(
            fontSize: 14, fontWeight: FontWeight.w700),
      ),
    );
  }
}
