import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:go_router/go_router.dart';

import 'package:sahayakai_mobile/src/core/theme/glassmorphic/glass_components.dart';
import 'package:sahayakai_mobile/src/features/lesson_plan/presentation/screens/create_lesson_screen.dart';
import 'package:sahayakai_mobile/src/features/quiz/presentation/screens/quiz_config_screen.dart';
import 'package:sahayakai_mobile/src/features/chat/presentation/screens/chat_screen.dart';
import 'package:sahayakai_mobile/src/features/home/presentation/screens/my_library_screen.dart';
import 'package:sahayakai_mobile/src/features/community/presentation/screens/community_feed_screen.dart';
import 'package:sahayakai_mobile/src/features/content/data/content_repository.dart';
import 'package:sahayakai_mobile/src/features/content/domain/content_models.dart';
import 'package:sahayakai_mobile/src/features/content/presentation/providers/content_provider.dart';
import 'widgets/app_drawer.dart';

import 'package:sahayakai_mobile/src/core/error/connectivity_banner.dart';
import 'package:sahayakai_mobile/src/core/services/metrics_service.dart';
import 'package:sahayakai_mobile/src/features/home/presentation/screens/tools_grid_screen.dart';
import 'package:sahayakai_mobile/src/features/home/presentation/screens/profile_screen.dart';
import 'package:sahayakai_mobile/src/features/vidya/presentation/widgets/vidya_fab.dart';

class HomeScreen extends ConsumerStatefulWidget {
  const HomeScreen({super.key});

  @override
  ConsumerState<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends ConsumerState<HomeScreen> {
  int _currentIndex = 0;
  bool _hasUnreadNotifications = true; // TODO: wire to real notification count
  bool _showCommunityNudge = true;

  @override
  void initState() {
    super.initState();
    MetricsService.trackScreenView('home');
  }

  @override
  Widget build(BuildContext context) {
    // Set status bar style
    SystemChrome.setSystemUIOverlayStyle(
      const SystemUiOverlayStyle(
        statusBarColor: Colors.transparent,
        statusBarIconBrightness: Brightness.dark,
        statusBarBrightness: Brightness.light,
      ),
    );

    // Define pages for the bottom nav
    final List<Widget> pages = [
      _buildDashboard(context), // 0: Home
      const ToolsGridScreen(), // 1: Tools
      const CommunityFeedScreen(), // 2: Community
      const MyLibraryScreen(), // 3: Library
      const ProfileScreen(), // 4: Profile
    ];

    return Scaffold(
      extendBodyBehindAppBar: true,
      drawer: const AppDrawer(),
      appBar: _buildCustomAppBar(context),
      floatingActionButton: const VidyaFab(),
      body: Stack(
        children: [
          // Background Image
          Positioned.fill(
            child: Image.asset(
              'assets/images/app_background.png',
              fit: BoxFit.cover,
            ),
          ),
          // Content
          SafeArea(
            child: ConnectivityBanner(
              child: IndexedStack(
                index: _currentIndex,
                children: pages,
              ),
            ),
          ),
        ],
      ),
      bottomNavigationBar: GlassBottomNavBar(
        currentIndex: _currentIndex,
        onTap: (index) => setState(() => _currentIndex = index),
        items: const [
          GlassNavItem(
            icon: Icons.home_outlined,
            activeIcon: Icons.home_filled,
            label: 'Home',
          ),
          GlassNavItem(
            icon: Icons.grid_view_outlined,
            activeIcon: Icons.grid_view_rounded,
            label: 'Tools',
          ),
          GlassNavItem(
            icon: Icons.people_outline_rounded,
            activeIcon: Icons.people_rounded,
            label: 'Community',
          ),
          GlassNavItem(
            icon: Icons.book_outlined,
            activeIcon: Icons.book_rounded,
            label: 'Library',
          ),
          GlassNavItem(
            icon: Icons.person_outline_rounded,
            activeIcon: Icons.person_rounded,
            label: 'Profile',
          ),
        ],
      ),
    );
  }

  PreferredSizeWidget _buildCustomAppBar(BuildContext context) {
    return PreferredSize(
      preferredSize: const Size.fromHeight(70),
      child: Container(
        decoration: const BoxDecoration(
          gradient: GlassColors.warmBackgroundGradient,
        ),
        child: SafeArea(
          bottom: false,
          child: Padding(
            padding: const EdgeInsets.symmetric(
              horizontal: GlassSpacing.lg,
              vertical: GlassSpacing.sm,
            ),
            child: Row(
              children: [
                Builder(
                  builder: (context) => GlassIconButton(
                    icon: Icons.menu_rounded,
                    onPressed: () => Scaffold.of(context).openDrawer(),
                  ),
                ),
                const Spacer(),
                Text(
                  'SahayakAI',
                  style: GlassTypography.headline2(),
                ),
                const Spacer(),
                // Messages icon
                GlassIconButton(
                  icon: Icons.chat_bubble_outline_rounded,
                  onPressed: () => context.push('/messages'),
                ),
                const SizedBox(width: 4),
                // Notifications with unread badge
                Stack(
                  clipBehavior: Clip.none,
                  children: [
                    GlassIconButton(
                      icon: Icons.notifications_outlined,
                      onPressed: () => context.push('/notifications'),
                    ),
                    if (_hasUnreadNotifications)
                      Positioned(
                        right: 6,
                        top: 6,
                        child: Container(
                          width: 10,
                          height: 10,
                          decoration: BoxDecoration(
                            color: const Color(0xFFEF4444),
                            shape: BoxShape.circle,
                            border: Border.all(
                              color: Colors.white,
                              width: 1.5,
                            ),
                          ),
                        ),
                      ),
                  ],
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildDashboard(BuildContext context) {
    return SingleChildScrollView(
      padding: const EdgeInsets.symmetric(horizontal: GlassSpacing.xl),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const SizedBox(height: GlassSpacing.lg),
          
          // 1. Hero Card
          GlassHeroCard(
            title: 'Namaste,\n${FirebaseAuth.instance.currentUser?.displayName ?? 'Teacher'}!',
            subtitle: 'Ready to inspire your students today?',
            illustration: ClipRRect(
              borderRadius: const BorderRadius.only(
                topRight: Radius.circular(GlassRadius.lg),
                bottomRight: Radius.circular(GlassRadius.lg),
              ),
              child: Image.asset(
                'assets/images/hero_illustration.png',
                fit: BoxFit.contain,
                width: 160,
                errorBuilder: (context, error, stackTrace) {
                  return Container(
                    width: 160,
                    color: Colors.transparent,
                  );
                },
              ),
            ),
          ),
          const SizedBox(height: GlassSpacing.xxl),

          // 2. Quick Actions Header
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                'Quick Actions',
                style: GlassTypography.headline2(),
              ),
              TextButton(
                onPressed: () => setState(() => _currentIndex = 1),
                child: Text(
                  'View All',
                  style: GlassTypography.labelMedium(
                    color: GlassColors.primary,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: GlassSpacing.lg),
          
          // Quick Actions Grid
          Row(
            children: [
              Expanded(
                child: GlassToolCard(
                  title: 'Plan\nLesson',
                  icon: Icons.menu_book_rounded,
                  onTap: () => Navigator.push(
                    context,
                    MaterialPageRoute(builder: (_) => const CreateLessonScreen()),
                  ),
                ),
              ),
              const SizedBox(width: GlassSpacing.lg),
              Expanded(
                child: GlassToolCard(
                  title: 'Create\nQuiz',
                  icon: Icons.extension_rounded,
                  onTap: () => Navigator.push(
                    context,
                    MaterialPageRoute(builder: (_) => const QuizConfigScreen()),
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: GlassSpacing.lg),

          // AI Assistant Card
          GlassCard(
            onTap: () => Navigator.push(
              context,
              MaterialPageRoute(builder: (_) => const ChatScreen()),
            ),
            child: Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(14),
                  decoration: BoxDecoration(
                    color: const Color(0xFFE0F2FE),
                    borderRadius: BorderRadius.circular(GlassRadius.md),
                  ),
                  child: const Icon(
                    Icons.auto_awesome,
                    color: Color(0xFF2563EB),
                    size: 24,
                  ),
                ),
                const SizedBox(width: GlassSpacing.lg),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Ask Sahayak',
                        style: GlassTypography.headline3(
                          color: const Color(0xFF1E40AF),
                        ),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        'Your AI teaching assistant',
                        style: GlassTypography.bodySmall(
                          color: const Color(0xFF3B82F6),
                        ),
                      ),
                    ],
                  ),
                ),
                const Icon(
                  Icons.mic_none_rounded,
                  color: Color(0xFF2563EB),
                  size: 24,
                ),
              ],
            ),
          ),
          const SizedBox(height: GlassSpacing.xxl),

          // Community Nudge Banner
          if (_showCommunityNudge) _buildCommunityNudgeBanner(),
          if (_showCommunityNudge)
            const SizedBox(height: GlassSpacing.xxl),

          // Edu News Card
          _buildEduNewsCard(),
          const SizedBox(height: GlassSpacing.xxl),

          // 3. Recent Activity — Real Data from Content Library
          Text(
            'Recent Activity',
            style: GlassTypography.headline2(),
          ),
          const SizedBox(height: GlassSpacing.lg),
          _buildRecentActivitySection(),
          const SizedBox(height: GlassSpacing.xxl),

          // 4. Teaching Insight
          _buildTeachingInsightCard(),
          
          const SizedBox(height: 100), // Bottom padding
        ],
      ),
    );
  }

  Widget _buildRecentActivitySection() {
    final contentAsync =
        ref.watch(contentListProvider(const ContentFilter(limit: 5)));

    return contentAsync.when(
      data: (response) {
        if (response.items.isEmpty) {
          return GlassCard(
            padding: const EdgeInsets.all(GlassSpacing.xl),
            child: Column(
              children: [
                Icon(Icons.history_rounded,
                    size: 40, color: GlassColors.textTertiary),
                const SizedBox(height: GlassSpacing.md),
                Text('No activity yet',
                    style: GlassTypography.bodyMedium(
                        color: GlassColors.textSecondary)),
                Text('Generate content to see it here',
                    style: GlassTypography.bodySmall()),
              ],
            ),
          );
        }
        return Column(
          children: response.items.map((item) {
            final meta = _metaForType(item.type);
            return Padding(
              padding: const EdgeInsets.only(bottom: GlassSpacing.md),
              child: _buildRecentActivityItem(
                item.title,
                item.typeLabel,
                meta.$1,
                meta.$2.withOpacity(0.1),
                meta.$2,
              ),
            );
          }).toList(),
        );
      },
      loading: () => const Padding(
        padding: EdgeInsets.symmetric(vertical: GlassSpacing.xl),
        child: Center(
          child: SizedBox(
            width: 24,
            height: 24,
            child: CircularProgressIndicator(
                strokeWidth: 2, color: GlassColors.primary),
          ),
        ),
      ),
      error: (_, __) => GlassCard(
        child: Text('Could not load recent activity',
            style: GlassTypography.bodySmall()),
      ),
    );
  }

  (IconData, Color) _metaForType(String type) {
    switch (type) {
      case 'lesson-plan':
        return (Icons.book_rounded, const Color(0xFFDC2626));
      case 'quiz':
        return (Icons.extension_rounded, const Color(0xFF2563EB));
      case 'worksheet':
        return (Icons.assignment_rounded, const Color(0xFF16A34A));
      case 'visual-aid':
        return (Icons.image_rounded, const Color(0xFF9333EA));
      case 'rubric':
        return (Icons.grading_rounded, const Color(0xFFF59E0B));
      case 'exam-paper':
        return (Icons.description_rounded, const Color(0xFF0D9488));
      case 'virtual-field-trip':
        return (Icons.travel_explore_rounded, const Color(0xFF6366F1));
      case 'teacher-training':
        return (Icons.school_rounded, const Color(0xFFEC4899));
      default:
        return (Icons.article_rounded, GlassColors.primary);
    }
  }

  Widget _buildRecentActivityItem(
    String title,
    String time,
    IconData icon,
    Color bgColor,
    Color iconColor,
  ) {
    return GlassCard(
      padding: const EdgeInsets.all(GlassSpacing.lg),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: bgColor,
              borderRadius: BorderRadius.circular(GlassRadius.md),
            ),
            child: Icon(icon, color: iconColor, size: 20),
          ),
          const SizedBox(width: GlassSpacing.lg),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title, style: GlassTypography.labelLarge()),
                const SizedBox(height: 2),
                Text(time, style: GlassTypography.bodySmall()),
              ],
            ),
          ),
          Container(
            padding: const EdgeInsets.all(8),
            decoration: const BoxDecoration(
              color: GlassColors.inputBackground,
              shape: BoxShape.circle,
            ),
            child: const Icon(
              Icons.arrow_forward_ios_rounded,
              size: 12,
              color: GlassColors.textTertiary,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildCommunityNudgeBanner() {
    return GlassCard(
      onTap: () => context.push('/community/compose'),
      child: Container(
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(GlassRadius.lg),
          gradient: const LinearGradient(
            colors: [Color(0xFFF0F9FF), Color(0xFFE0F2FE)],
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
          ),
        ),
        padding: const EdgeInsets.all(GlassSpacing.lg),
        child: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: const Color(0xFF3B82F6).withOpacity(0.15),
                borderRadius: BorderRadius.circular(GlassRadius.md),
              ),
              child: const Icon(
                Icons.people_rounded,
                color: Color(0xFF2563EB),
                size: 24,
              ),
            ),
            const SizedBox(width: GlassSpacing.lg),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Share your expertise!',
                    style: GlassTypography.labelLarge(
                      color: const Color(0xFF1E40AF),
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    'Post in the Community',
                    style: GlassTypography.bodySmall(
                      color: const Color(0xFF3B82F6),
                    ),
                  ),
                ],
              ),
            ),
            GestureDetector(
              onTap: () => setState(() => _showCommunityNudge = false),
              child: const Padding(
                padding: EdgeInsets.all(4),
                child: Icon(
                  Icons.close_rounded,
                  size: 18,
                  color: GlassColors.textTertiary,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildEduNewsCard() {
    return GlassCard(
      onTap: () => context.push('/news'),
      padding: const EdgeInsets.all(GlassSpacing.lg),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: const Color(0xFFFEF3C7),
              borderRadius: BorderRadius.circular(GlassRadius.md),
            ),
            child: const Icon(
              Icons.newspaper_rounded,
              color: Color(0xFFF59E0B),
              size: 22,
            ),
          ),
          const SizedBox(width: GlassSpacing.lg),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('Edu News', style: GlassTypography.labelLarge()),
                const SizedBox(height: 2),
                Text(
                  'Latest updates in education',
                  style: GlassTypography.bodySmall(
                    color: GlassColors.textSecondary,
                  ),
                ),
              ],
            ),
          ),
          const Icon(
            Icons.arrow_forward_ios_rounded,
            size: 14,
            color: GlassColors.textTertiary,
          ),
        ],
      ),
    );
  }

  Widget _buildTeachingInsightCard() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'TEACHING INSIGHT',
          style: GlassTypography.sectionHeader(),
        ),
        const SizedBox(height: GlassSpacing.md),
        GlassCard(
          padding: EdgeInsets.zero,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Image Section
              Stack(
                children: [
                  Container(
                    height: 160,
                    width: double.infinity,
                    decoration: const BoxDecoration(
                      color: GlassColors.inputBackground,
                      borderRadius: BorderRadius.vertical(
                        top: Radius.circular(GlassRadius.lg),
                      ),
                      image: DecorationImage(
                        image: NetworkImage(
                          'https://images.unsplash.com/photo-1509042239860-f550ce710b93?ixlib=rb-1.2.1&auto=format&fit=crop&w=800&q=80',
                        ),
                        fit: BoxFit.cover,
                      ),
                    ),
                  ),
                  Positioned(
                    left: GlassSpacing.lg,
                    bottom: GlassSpacing.lg,
                    child: Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: GlassSpacing.md,
                        vertical: GlassSpacing.xs,
                      ),
                      decoration: BoxDecoration(
                        color: GlassColors.primary,
                        borderRadius: BorderRadius.circular(GlassRadius.pill),
                      ),
                      child: Text(
                        'TIP OF THE DAY',
                        style: GlassTypography.labelSmall(color: Colors.white),
                      ),
                    ),
                  ),
                ],
              ),
              // Content Section
              Padding(
                padding: const EdgeInsets.all(GlassSpacing.xl),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Connect math to harvest',
                      style: GlassTypography.headline3(),
                    ),
                    const SizedBox(height: GlassSpacing.sm),
                    Text(
                      'Use local crop yields to explain percentages. It helps students relate abstract concepts to their daily lives.',
                      style: GlassTypography.bodyMedium(
                        color: GlassColors.textSecondary,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}
