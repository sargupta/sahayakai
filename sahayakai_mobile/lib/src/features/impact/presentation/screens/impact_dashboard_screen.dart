import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:fl_chart/fl_chart.dart';

import '../../../usage/data/usage_repository.dart';
import '../../data/teacher_health_repository.dart';
import '../../../content/data/content_repository.dart';
import '../../../content/domain/content_models.dart';
import '../../../content/presentation/providers/content_provider.dart';

/// Provider that fetches the teacher health score for the current user.
final _healthScoreProvider =
    FutureProvider.autoDispose<TeacherHealthScore>((ref) async {
  final uid = FirebaseAuth.instance.currentUser?.uid;
  if (uid == null) throw Exception('Not signed in');
  final repo = ref.read(teacherHealthRepositoryProvider);
  return repo.getHealthScore(uid);
});

/// Provider that fetches the 5 most recent content items (any type).
final _recentContentProvider =
    FutureProvider.autoDispose<ContentListResponse>((ref) async {
  final repo = ref.read(contentRepositoryProvider);
  return repo.listContent(limit: 5);
});

class ImpactDashboardScreen extends ConsumerWidget {
  const ImpactDashboardScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final usageAsync = ref.watch(usageProvider);
    final healthAsync = ref.watch(_healthScoreProvider);
    final recentContentAsync = ref.watch(_recentContentProvider);

    return Scaffold(
      appBar: AppBar(
        title: Text("Impact Dashboard",
            style: GoogleFonts.outfit(
                fontWeight: FontWeight.bold, color: Colors.black)),
        backgroundColor: Colors.white,
        elevation: 0,
        iconTheme: const IconThemeData(color: Colors.black),
      ),
      body: SingleChildScrollView(
        keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // ── Health Score Card ──────────────────────────────
            _buildHealthScoreSection(healthAsync),
            const SizedBox(height: 24),

            // ── Summary Cards (existing real data) ────────────
            Row(
              children: [
                Expanded(
                    child: _buildMetricCard(
                  "Lessons",
                  usageAsync
                          .whenData(
                              (u) => '${u.features['lesson-plan']?.used ?? 0}')
                          .value ??
                      '--',
                  Icons.book,
                  Colors.blue,
                )),
                const SizedBox(width: 12),
                Expanded(
                    child: _buildMetricCard(
                  "Quizzes",
                  usageAsync
                          .whenData(
                              (u) => '${u.features['quiz']?.used ?? 0}')
                          .value ??
                      '--',
                  Icons.extension,
                  Colors.orange,
                )),
              ],
            ),
            const SizedBox(height: 12),
            Row(
              children: [
                Expanded(
                    child: _buildMetricCard(
                  "Worksheets",
                  usageAsync
                          .whenData(
                              (u) => '${u.features['worksheet']?.used ?? 0}')
                          .value ??
                      '--',
                  Icons.assignment,
                  Colors.purple,
                )),
                const SizedBox(width: 12),
                Expanded(
                    child: _buildMetricCard(
                  "Plan",
                  usageAsync
                          .whenData((u) => u.plan.toUpperCase())
                          .value ??
                      '--',
                  Icons.workspace_premium,
                  Colors.green,
                )),
              ],
            ),
            const SizedBox(height: 32),

            // ── Usage Bar Chart (real data) ───────────────────
            Text("Content Usage",
                style: GoogleFonts.outfit(
                    fontSize: 20, fontWeight: FontWeight.bold)),
            const SizedBox(height: 16),
            _buildUsageChart(usageAsync),
            const SizedBox(height: 32),

            // ── Recent Creations (real data) ──────────────────
            Text("Recent Creations",
                style: GoogleFonts.outfit(
                    fontSize: 20, fontWeight: FontWeight.bold)),
            const SizedBox(height: 16),
            _buildRecentCreations(recentContentAsync),
          ],
        ),
      ),
    );
  }

  // ─── Health Score Section ─────────────────────────────────────

  Widget _buildHealthScoreSection(AsyncValue<TeacherHealthScore> healthAsync) {
    return healthAsync.when(
      loading: () => Container(
        padding: const EdgeInsets.all(24),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(16),
          boxShadow: const [BoxShadow(color: Colors.black12, blurRadius: 4)],
        ),
        child: const Center(child: CircularProgressIndicator()),
      ),
      error: (e, _) => Container(
        padding: const EdgeInsets.all(24),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(16),
          boxShadow: const [BoxShadow(color: Colors.black12, blurRadius: 4)],
        ),
        child: Row(
          children: [
            const Icon(Icons.error_outline, color: Colors.red),
            const SizedBox(width: 12),
            Expanded(
              child: Text(
                'Unable to load health score',
                style: GoogleFonts.inter(color: Colors.grey[600]),
              ),
            ),
          ],
        ),
      ),
      data: (health) => _buildHealthScoreCard(health),
    );
  }

  Widget _buildHealthScoreCard(TeacherHealthScore health) {
    final score = health.healthScore;
    final Color scoreColor;
    if (score >= 70) {
      scoreColor = Colors.green;
    } else if (score >= 40) {
      scoreColor = Colors.orange;
    } else {
      scoreColor = Colors.red;
    }

    final tier = health.tier ?? 'unknown';
    final Color tierBgColor;
    final Color tierFgColor;
    switch (tier.toLowerCase()) {
      case 'active':
        tierBgColor = Colors.green.shade50;
        tierFgColor = Colors.green.shade700;
        break;
      case 'at-risk':
        tierBgColor = Colors.orange.shade50;
        tierFgColor = Colors.orange.shade700;
        break;
      case 'dormant':
        tierBgColor = Colors.red.shade50;
        tierFgColor = Colors.red.shade700;
        break;
      default:
        tierBgColor = Colors.grey.shade100;
        tierFgColor = Colors.grey.shade700;
    }

    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          BoxShadow(
              color: Colors.black.withOpacity(0.05),
              blurRadius: 8,
              offset: const Offset(0, 2)),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text("Health Score",
              style: GoogleFonts.outfit(
                  fontSize: 18, fontWeight: FontWeight.bold)),
          const SizedBox(height: 16),
          Row(
            children: [
              // Circular progress
              SizedBox(
                width: 80,
                height: 80,
                child: Stack(
                  fit: StackFit.expand,
                  children: [
                    CircularProgressIndicator(
                      value: score / 100,
                      strokeWidth: 8,
                      backgroundColor: scoreColor.withOpacity(0.15),
                      valueColor: AlwaysStoppedAnimation(scoreColor),
                    ),
                    Center(
                      child: Text(
                        '${score.round()}',
                        style: GoogleFonts.outfit(
                          fontSize: 22,
                          fontWeight: FontWeight.bold,
                          color: scoreColor,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 20),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // Tier badge
                    Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 12, vertical: 4),
                      decoration: BoxDecoration(
                        color: tierBgColor,
                        borderRadius: BorderRadius.circular(20),
                      ),
                      child: Text(
                        tier[0].toUpperCase() + tier.substring(1),
                        style: GoogleFonts.inter(
                          fontSize: 13,
                          fontWeight: FontWeight.w600,
                          color: tierFgColor,
                        ),
                      ),
                    ),
                    const SizedBox(height: 8),
                    Text(
                      score >= 70
                          ? 'Great engagement!'
                          : score >= 40
                              ? 'Room for improvement'
                              : 'Needs attention',
                      style: GoogleFonts.inter(
                          fontSize: 13, color: Colors.grey[600]),
                    ),
                  ],
                ),
              ),
            ],
          ),

          // Breakdown metrics
          if (health.breakdown != null && health.breakdown!.isNotEmpty) ...[
            const SizedBox(height: 16),
            const Divider(),
            const SizedBox(height: 8),
            Wrap(
              spacing: 16,
              runSpacing: 8,
              children: health.breakdown!.entries.map((entry) {
                return _buildBreakdownChip(
                  _formatBreakdownKey(entry.key),
                  '${entry.value}',
                );
              }).toList(),
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildBreakdownChip(String label, String value) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Text(value,
            style:
                GoogleFonts.outfit(fontWeight: FontWeight.bold, fontSize: 16)),
        Text(label,
            style: GoogleFonts.inter(color: Colors.grey[600], fontSize: 11)),
      ],
    );
  }

  String _formatBreakdownKey(String key) {
    // Convert camelCase / snake_case to Title Case
    return key
        .replaceAllMapped(
            RegExp(r'([a-z])([A-Z])'), (m) => '${m[1]} ${m[2]}')
        .replaceAll('_', ' ')
        .split(' ')
        .map((w) =>
            w.isEmpty ? '' : '${w[0].toUpperCase()}${w.substring(1)}')
        .join(' ');
  }

  // ─── Usage Bar Chart ──────────────────────────────────────────

  Widget _buildUsageChart(AsyncValue usageAsync) {
    return Container(
      height: 220,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        boxShadow: const [BoxShadow(color: Colors.black12, blurRadius: 4)],
      ),
      child: usageAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(
          child: Text('Unable to load chart',
              style: GoogleFonts.inter(color: Colors.grey)),
        ),
        data: (usage) {
          final features = <_ChartFeature>[
            _ChartFeature('Lessons', 'lesson-plan', Colors.blue),
            _ChartFeature('Quizzes', 'quiz', Colors.orange),
            _ChartFeature('Worksheets', 'worksheet', Colors.purple),
            _ChartFeature('Visual Aids', 'visual-aid', Colors.teal),
            _ChartFeature('Rubrics', 'rubric', Colors.indigo),
            _ChartFeature('Exams', 'exam-paper', Colors.red),
          ];

          final bars = <BarChartGroupData>[];
          double maxY = 1;
          for (int i = 0; i < features.length; i++) {
            final used =
                (usage.features[features[i].key]?.used ?? 0).toDouble();
            if (used > maxY) maxY = used;
            bars.add(_makeGroupData(i, used, features[i].color));
          }
          // Add 20% headroom
          maxY = (maxY * 1.2).ceilToDouble();
          if (maxY < 5) maxY = 5;

          return BarChart(
            BarChartData(
              alignment: BarChartAlignment.spaceAround,
              maxY: maxY,
              titlesData: FlTitlesData(
                show: true,
                bottomTitles: AxisTitles(
                  sideTitles: SideTitles(
                    showTitles: true,
                    getTitlesWidget: (val, meta) {
                      final idx = val.toInt();
                      if (idx >= 0 && idx < features.length) {
                        return Padding(
                          padding: const EdgeInsets.only(top: 4),
                          child: Text(features[idx].label,
                              style: GoogleFonts.inter(fontSize: 10)),
                        );
                      }
                      return const Text('');
                    },
                  ),
                ),
                leftTitles: AxisTitles(
                  sideTitles: SideTitles(
                    showTitles: true,
                    reservedSize: 28,
                    getTitlesWidget: (val, meta) {
                      if (val == val.roundToDouble()) {
                        return Text('${val.toInt()}',
                            style: GoogleFonts.inter(
                                fontSize: 10, color: Colors.grey));
                      }
                      return const Text('');
                    },
                  ),
                ),
                topTitles:
                    const AxisTitles(sideTitles: SideTitles(showTitles: false)),
                rightTitles:
                    const AxisTitles(sideTitles: SideTitles(showTitles: false)),
              ),
              gridData: const FlGridData(show: false),
              borderData: FlBorderData(show: false),
              barGroups: bars,
            ),
          );
        },
      ),
    );
  }

  BarChartGroupData _makeGroupData(int x, double y, Color color) {
    return BarChartGroupData(
      x: x,
      barRods: [
        BarChartRodData(
            toY: y,
            color: color,
            width: 16,
            borderRadius: BorderRadius.circular(4)),
      ],
    );
  }

  // ─── Recent Creations ─────────────────────────────────────────

  Widget _buildRecentCreations(AsyncValue<ContentListResponse> contentAsync) {
    return contentAsync.when(
      loading: () => const Center(
          child: Padding(
        padding: EdgeInsets.all(24),
        child: CircularProgressIndicator(),
      )),
      error: (e, _) => Card(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Text('Unable to load recent content',
              style: GoogleFonts.inter(color: Colors.grey)),
        ),
      ),
      data: (response) {
        if (response.items.isEmpty) {
          return Card(
            shape:
                RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Text('No content created yet. Start generating!',
                  style: GoogleFonts.inter(color: Colors.grey[600])),
            ),
          );
        }
        return Column(
          children: response.items
              .map((item) => _buildContentItemTile(item))
              .toList(),
        );
      },
    );
  }

  Widget _buildContentItemTile(ContentItem item) {
    final IconData icon;
    final Color color;
    switch (item.type) {
      case 'lesson-plan':
        icon = Icons.book;
        color = Colors.blue;
        break;
      case 'quiz':
        icon = Icons.extension;
        color = Colors.orange;
        break;
      case 'worksheet':
        icon = Icons.assignment;
        color = Colors.purple;
        break;
      case 'visual-aid':
        icon = Icons.image;
        color = Colors.teal;
        break;
      case 'rubric':
        icon = Icons.rule;
        color = Colors.indigo;
        break;
      case 'exam-paper':
        icon = Icons.description;
        color = Colors.red;
        break;
      case 'virtual-field-trip':
        icon = Icons.explore;
        color = Colors.green;
        break;
      default:
        icon = Icons.article;
        color = Colors.blueGrey;
    }

    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      child: ListTile(
        leading: Container(
          padding: const EdgeInsets.all(8),
          decoration: BoxDecoration(
              color: color.withOpacity(0.1), shape: BoxShape.circle),
          child: Icon(icon, color: color),
        ),
        title: Text(item.title,
            style: GoogleFonts.inter(fontWeight: FontWeight.w600),
            maxLines: 1,
            overflow: TextOverflow.ellipsis),
        subtitle: Text(
          '${item.typeLabel}  ·  ${_relativeTime(item.createdAt)}',
          style: GoogleFonts.inter(fontSize: 12),
        ),
      ),
    );
  }

  /// Converts an ISO-8601 date string into a human-readable relative time.
  String _relativeTime(String? isoDate) {
    if (isoDate == null) return '';
    final date = DateTime.tryParse(isoDate);
    if (date == null) return '';
    final diff = DateTime.now().difference(date);
    if (diff.inMinutes < 1) return 'Just now';
    if (diff.inMinutes < 60) return '${diff.inMinutes}m ago';
    if (diff.inHours < 24) return '${diff.inHours}h ago';
    if (diff.inDays == 1) return 'Yesterday';
    if (diff.inDays < 7) return '${diff.inDays}d ago';
    if (diff.inDays < 30) return '${(diff.inDays / 7).floor()}w ago';
    return '${(diff.inDays / 30).floor()}mo ago';
  }

  // ─── Shared widgets ───────────────────────────────────────────

  Widget _buildMetricCard(
      String label, String value, IconData icon, Color color) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          BoxShadow(
              color: Colors.black.withOpacity(0.05),
              blurRadius: 8,
              offset: const Offset(0, 2)),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(
                color: color.withOpacity(0.1), shape: BoxShape.circle),
            child: Icon(icon, color: color, size: 20),
          ),
          const SizedBox(height: 12),
          Text(value,
              style: GoogleFonts.outfit(
                  fontSize: 24, fontWeight: FontWeight.bold)),
          Text(label,
              style: GoogleFonts.inter(color: Colors.grey, fontSize: 13)),
        ],
      ),
    );
  }
}

/// Helper class for chart feature configuration.
class _ChartFeature {
  final String label;
  final String key;
  final Color color;
  const _ChartFeature(this.label, this.key, this.color);
}
