import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';

import 'package:sahayakai_mobile/src/core/theme/glassmorphic/glass_components.dart';
import 'package:sahayakai_mobile/src/features/home/presentation/screens/my_library_screen.dart';
import 'package:sahayakai_mobile/src/features/community/presentation/screens/community_feed_screen.dart';
import 'package:sahayakai_mobile/src/features/chat/presentation/screens/chat_screen.dart';
import 'widgets/app_drawer.dart';

import 'package:sahayakai_mobile/src/features/home/presentation/screens/tools_grid_screen.dart';
import 'package:sahayakai_mobile/src/features/home/presentation/screens/profile_screen.dart';

// ─────────────────── Tool definitions ───────────────────

class _Tool {
  final String title;
  final String description;
  final IconData icon;
  final String route;
  final Color gradientStart;
  final Color gradientEnd;

  const _Tool({
    required this.title,
    required this.description,
    required this.icon,
    required this.route,
    required this.gradientStart,
    required this.gradientEnd,
  });
}

const _tools = [
  _Tool(
    title: 'Lesson Plan',
    description: 'AI-powered lesson in seconds',
    icon: Icons.menu_book_rounded,
    route: '/create-lesson',
    gradientStart: Color(0xFF667EEA),
    gradientEnd: Color(0xFF764BA2),
  ),
  _Tool(
    title: 'Quiz',
    description: 'Auto-generate any quiz',
    icon: Icons.extension_rounded,
    route: '/quiz-config',
    gradientStart: Color(0xFFF093FB),
    gradientEnd: Color(0xFFF5576C),
  ),
  _Tool(
    title: 'Worksheet',
    description: 'Print-ready worksheets',
    icon: Icons.assignment_rounded,
    route: '/worksheet-wizard',
    gradientStart: Color(0xFF4FACFE),
    gradientEnd: Color(0xFF00F2FE),
  ),
  _Tool(
    title: 'Exam Paper',
    description: 'Set exams with mark schemes',
    icon: Icons.description_rounded,
    route: '/exam-paper',
    gradientStart: Color(0xFF43E97B),
    gradientEnd: Color(0xFF38F9D7),
  ),
  _Tool(
    title: 'Visual Aid',
    description: 'Generate classroom images',
    icon: Icons.image_rounded,
    route: '/visual-aid-creator',
    gradientStart: Color(0xFFFA709A),
    gradientEnd: Color(0xFFFEE140),
  ),
  _Tool(
    title: 'Instant Answer',
    description: 'Verified facts, instantly',
    icon: Icons.flash_on_rounded,
    route: '/instant-answer',
    gradientStart: Color(0xFFA18CD1),
    gradientEnd: Color(0xFFFBC2EB),
  ),
  _Tool(
    title: 'Video Story',
    description: 'YouTube for your topic',
    icon: Icons.play_circle_fill_rounded,
    route: '/video-storyteller',
    gradientStart: Color(0xFF0BA360),
    gradientEnd: Color(0xFF3CBA92),
  ),
  _Tool(
    title: 'Field Trip',
    description: 'Virtual global tours',
    icon: Icons.public_rounded,
    route: '/virtual-field-trip',
    gradientStart: Color(0xFFFF9A9E),
    gradientEnd: Color(0xFFFECFEF),
  ),
  _Tool(
    title: 'Rubric',
    description: 'Fair, clear grading',
    icon: Icons.grid_on_rounded,
    route: '/rubric-generator',
    gradientStart: Color(0xFF96FBC4),
    gradientEnd: Color(0xFFF9F586),
  ),
  _Tool(
    title: 'Training',
    description: 'Grow your teaching skills',
    icon: Icons.school_rounded,
    route: '/teacher-training',
    gradientStart: Color(0xFF30CFD0),
    gradientEnd: Color(0xFF330867),
  ),
];

// ─────────────────── Home Screen ───────────────────

class HomeScreen extends ConsumerStatefulWidget {
  const HomeScreen({super.key});

  @override
  ConsumerState<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends ConsumerState<HomeScreen> {
  int _currentIndex = 0;

  String _getGreeting() {
    final hour = DateTime.now().hour;
    if (hour < 12) return 'Good Morning';
    if (hour < 17) return 'Good Afternoon';
    return 'Good Evening';
  }

  @override
  Widget build(BuildContext context) {
    SystemChrome.setSystemUIOverlayStyle(
      const SystemUiOverlayStyle(
        statusBarColor: Colors.transparent,
        statusBarIconBrightness: Brightness.dark,
        statusBarBrightness: Brightness.light,
      ),
    );

    final List<Widget> pages = [
      _DashboardTab(
        greeting: _getGreeting(),
        onViewAllTools: () => setState(() => _currentIndex = 1),
      ),
      const ToolsGridScreen(),
      const CommunityFeedScreen(),
      const MyLibraryScreen(),
      const ProfileScreen(),
    ];

    return Scaffold(
      extendBodyBehindAppBar: true,
      drawer: const AppDrawer(),
      appBar: _buildAppBar(context),
      body: Stack(
        children: [
          Positioned.fill(
            child: Container(
              decoration: const BoxDecoration(
                gradient: GlassColors.warmBackgroundGradient,
              ),
            ),
          ),
          SafeArea(
            child: IndexedStack(
              index: _currentIndex,
              children: pages,
            ),
          ),
        ],
      ),
      bottomNavigationBar: GlassBottomNavBar(
        currentIndex: _currentIndex,
        onTap: (index) => setState(() => _currentIndex = index),
        items: const [
          GlassNavItem(icon: Icons.home_outlined, activeIcon: Icons.home_filled, label: 'Home'),
          GlassNavItem(icon: Icons.grid_view_outlined, activeIcon: Icons.grid_view_rounded, label: 'Tools'),
          GlassNavItem(icon: Icons.people_outline_rounded, activeIcon: Icons.people_rounded, label: 'Community'),
          GlassNavItem(icon: Icons.book_outlined, activeIcon: Icons.book_rounded, label: 'Library'),
          GlassNavItem(icon: Icons.person_outline_rounded, activeIcon: Icons.person_rounded, label: 'Profile'),
        ],
      ),
    );
  }

  PreferredSizeWidget _buildAppBar(BuildContext context) {
    return PreferredSize(
      preferredSize: const Size.fromHeight(64),
      child: Container(
        decoration: const BoxDecoration(
          gradient: GlassColors.warmBackgroundGradient,
          border: Border(bottom: BorderSide(color: Color(0xFFE5D9C3), width: 0.5)),
        ),
        child: SafeArea(
          bottom: false,
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
            child: Row(
              children: [
                Builder(
                  builder: (context) => GlassIconButton(
                    icon: Icons.menu_rounded,
                    onPressed: () => Scaffold.of(context).openDrawer(),
                  ),
                ),
                const Spacer(),
                Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Container(
                      width: 28,
                      height: 28,
                      decoration: BoxDecoration(
                        gradient: const LinearGradient(
                          colors: [Color(0xFFFF9933), Color(0xFFE68A00)],
                        ),
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: const Icon(Icons.auto_awesome, color: Colors.white, size: 16),
                    ),
                    const SizedBox(width: 8),
                    Text('SahayakAI', style: GlassTypography.headline2()),
                  ],
                ),
                const Spacer(),
                Stack(
                  alignment: Alignment.topRight,
                  children: [
                    GlassIconButton(icon: Icons.notifications_outlined, onPressed: () {}),
                    Positioned(
                      top: 8, right: 8,
                      child: Container(
                        width: 8, height: 8,
                        decoration: BoxDecoration(
                          color: GlassColors.primary,
                          shape: BoxShape.circle,
                          border: Border.all(color: Colors.white, width: 1.5),
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
}

// ─────────────────── Dashboard Tab ───────────────────

class _DashboardTab extends StatelessWidget {
  final String greeting;
  final VoidCallback onViewAllTools;

  const _DashboardTab({required this.greeting, required this.onViewAllTools});

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      physics: const BouncingScrollPhysics(),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const SizedBox(height: 16),
          _buildHero(context),
          const SizedBox(height: 16),
          _buildVidyaBar(context),
          const SizedBox(height: 28),
          _buildToolsSection(context),
          const SizedBox(height: 28),
          _buildStatsRow(),
          const SizedBox(height: 28),
          _buildCommunitySection(),
          const SizedBox(height: 100),
        ],
      ),
    );
  }

  Widget _buildHero(BuildContext context) {
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 20),
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [Color(0xFFFF9933), Color(0xFFE05C00)],
        ),
        borderRadius: BorderRadius.circular(24),
        boxShadow: [
          BoxShadow(
            color: const Color(0xFFFF9933).withValues(alpha: 0.35),
            blurRadius: 24,
            offset: const Offset(0, 8),
          ),
        ],
      ),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  '$greeting,',
                  style: GoogleFonts.outfit(
                    fontSize: 15,
                    fontWeight: FontWeight.w500,
                    color: Colors.white.withValues(alpha: 0.85),
                  ),
                ),
                Text(
                  'Teacher!',
                  style: GoogleFonts.outfit(
                    fontSize: 30,
                    fontWeight: FontWeight.w800,
                    color: Colors.white,
                    height: 1.1,
                  ),
                ),
                const SizedBox(height: 8),
                Text(
                  'What will you create\nfor your students today?',
                  style: GoogleFonts.outfit(
                    fontSize: 13,
                    color: Colors.white.withValues(alpha: 0.8),
                    height: 1.5,
                  ),
                ),
                const SizedBox(height: 16),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                  decoration: BoxDecoration(
                    color: Colors.white.withValues(alpha: 0.2),
                    borderRadius: BorderRadius.circular(20),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const Icon(Icons.language, size: 14, color: Colors.white),
                      const SizedBox(width: 6),
                      Text(
                        '11 Indian Languages',
                        style: GoogleFonts.outfit(
                          fontSize: 11,
                          color: Colors.white,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(width: 12),
          Container(
            width: 88,
            height: 88,
            decoration: BoxDecoration(
              color: Colors.white.withValues(alpha: 0.18),
              shape: BoxShape.circle,
            ),
            child: const Icon(Icons.auto_awesome, color: Colors.white, size: 44),
          ),
        ],
      ),
    );
  }

  Widget _buildVidyaBar(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 20),
      child: GestureDetector(
        onTap: () => Navigator.push(
          context,
          MaterialPageRoute(builder: (_) => const ChatScreen()),
        ),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(18),
            border: Border.all(color: const Color(0xFFFFD699), width: 1.5),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withValues(alpha: 0.06),
                blurRadius: 16,
                offset: const Offset(0, 4),
              ),
            ],
          ),
          child: Row(
            children: [
              Container(
                width: 38,
                height: 38,
                decoration: BoxDecoration(
                  gradient: const LinearGradient(
                    colors: [Color(0xFFFF9933), Color(0xFFE68A00)],
                  ),
                  borderRadius: BorderRadius.circular(11),
                ),
                child: const Icon(Icons.auto_awesome, color: Colors.white, size: 20),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Ask VIDYA anything…',
                      style: GoogleFonts.outfit(
                        fontSize: 15,
                        color: const Color(0xFF9CA3AF),
                      ),
                    ),
                    Text(
                      '"Explain fractions to Class 5 in Hindi"',
                      style: GoogleFonts.outfit(
                        fontSize: 11,
                        color: const Color(0xFFD1D5DB),
                      ),
                    ),
                  ],
                ),
              ),
              Container(
                width: 40,
                height: 40,
                decoration: BoxDecoration(
                  color: const Color(0xFFFFF3E0),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: const Icon(Icons.mic_rounded, color: Color(0xFFFF9933), size: 22),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildToolsSection(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 20),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('AI Tools', style: GlassTypography.headline2()),
                  Text(
                    '10 tools to supercharge teaching',
                    style: GlassTypography.bodySmall(),
                  ),
                ],
              ),
              GestureDetector(
                onTap: onViewAllTools,
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                  decoration: BoxDecoration(
                    color: GlassColors.primary.withValues(alpha: 0.1),
                    borderRadius: BorderRadius.circular(20),
                  ),
                  child: Text(
                    'View All',
                    style: GoogleFonts.outfit(
                      fontSize: 12,
                      fontWeight: FontWeight.w600,
                      color: GlassColors.primary,
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 14),
        // Horizontal scrolling tool cards
        SizedBox(
          height: 132,
          child: ListView.builder(
            padding: const EdgeInsets.symmetric(horizontal: 20),
            scrollDirection: Axis.horizontal,
            physics: const BouncingScrollPhysics(),
            itemCount: _tools.length,
            itemBuilder: (context, i) => _ToolCard(tool: _tools[i]),
          ),
        ),
        const SizedBox(height: 14),
        // Bottom 4 quick tiles
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 20),
          child: Row(
            children: List.generate(4, (i) => Expanded(
              child: Padding(
                padding: EdgeInsets.only(left: i > 0 ? 8 : 0),
                child: _QuickTile(tool: _tools[i]),
              ),
            )),
          ),
        ),
      ],
    );
  }

  Widget _buildStatsRow() {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 20),
      child: Row(
        children: [
          _StatChip(icon: Icons.auto_awesome, label: '10 AI Tools', color: const Color(0xFF7C3AED)),
          const SizedBox(width: 10),
          _StatChip(icon: Icons.language, label: '11 Languages', color: const Color(0xFF059669)),
          const SizedBox(width: 10),
          _StatChip(icon: Icons.people_rounded, label: '10M Teachers', color: const Color(0xFFD97706)),
        ],
      ),
    );
  }

  Widget _buildCommunitySection() {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text('Community', style: GlassTypography.headline2()),
              Text(
                'See all',
                style: GoogleFonts.outfit(
                  fontSize: 12,
                  fontWeight: FontWeight.w600,
                  color: GlassColors.primary,
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          _CommunityCard(
            author: 'Priya Sharma',
            role: 'Science Teacher, Mumbai',
            content: 'Just made a VR solar system lesson — students absolutely loved it! Sharing resources below.',
            likes: 42,
            timeAgo: '2h ago',
            tags: ['Science', 'Class 6'],
            avatarColor: const Color(0xFF7C3AED),
          ),
          const SizedBox(height: 10),
          _CommunityCard(
            author: 'Ramesh Gupta',
            role: 'Math Head, Delhi',
            content: 'Vedic Math trick for long division — cuts calculation time by 50%. Worksheet attached.',
            likes: 87,
            timeAgo: '5h ago',
            tags: ['Math', 'Tips'],
            avatarColor: const Color(0xFF0891B2),
          ),
        ],
      ),
    );
  }
}

// ─────────────────── Tool Card (horizontal scroll) ───────────────────

class _ToolCard extends StatelessWidget {
  final _Tool tool;
  const _ToolCard({required this.tool});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: () => context.push(tool.route),
      child: Container(
        width: 112,
        margin: const EdgeInsets.only(right: 12),
        decoration: BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [tool.gradientStart, tool.gradientEnd],
          ),
          borderRadius: BorderRadius.circular(20),
          boxShadow: [
            BoxShadow(
              color: tool.gradientStart.withValues(alpha: 0.35),
              blurRadius: 12,
              offset: const Offset(0, 6),
            ),
          ],
        ),
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                width: 40,
                height: 40,
                decoration: BoxDecoration(
                  color: Colors.white.withValues(alpha: 0.25),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Icon(tool.icon, color: Colors.white, size: 22),
              ),
              const Spacer(),
              Text(
                tool.title,
                style: GoogleFonts.outfit(
                  fontSize: 13,
                  fontWeight: FontWeight.w700,
                  color: Colors.white,
                ),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
              const SizedBox(height: 2),
              Text(
                tool.description,
                style: GoogleFonts.outfit(
                  fontSize: 10,
                  color: Colors.white.withValues(alpha: 0.8),
                  height: 1.3,
                ),
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
              ),
            ],
          ),
        ),
      ),
    );
  }
}

// ─────────────────── Quick Tile ───────────────────

class _QuickTile extends StatelessWidget {
  final _Tool tool;
  const _QuickTile({required this.tool});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: () => context.push(tool.route),
      child: Container(
        height: 72,
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: const Color(0xFFE8E8E8)),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.04),
              blurRadius: 8,
              offset: const Offset(0, 2),
            ),
          ],
        ),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Container(
              width: 32,
              height: 32,
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  colors: [tool.gradientStart, tool.gradientEnd],
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                ),
                borderRadius: BorderRadius.circular(10),
              ),
              child: Icon(tool.icon, color: Colors.white, size: 16),
            ),
            const SizedBox(height: 5),
            Text(
              tool.title,
              style: GoogleFonts.outfit(
                fontSize: 10,
                fontWeight: FontWeight.w600,
                color: GlassColors.textPrimary,
              ),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              textAlign: TextAlign.center,
            ),
          ],
        ),
      ),
    );
  }
}

// ─────────────────── Stat Chip ───────────────────

class _StatChip extends StatelessWidget {
  final IconData icon;
  final String label;
  final Color color;
  const _StatChip({required this.icon, required this.label, required this.color});

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 8),
        decoration: BoxDecoration(
          color: color.withValues(alpha: 0.08),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: color.withValues(alpha: 0.15)),
        ),
        child: Column(
          children: [
            Icon(icon, size: 18, color: color),
            const SizedBox(height: 4),
            Text(
              label,
              style: GoogleFonts.outfit(
                fontSize: 10,
                fontWeight: FontWeight.w600,
                color: color,
              ),
              textAlign: TextAlign.center,
            ),
          ],
        ),
      ),
    );
  }
}

// ─────────────────── Community Card (home preview) ───────────────────

class _CommunityCard extends StatelessWidget {
  final String author;
  final String role;
  final String content;
  final int likes;
  final String timeAgo;
  final List<String> tags;
  final Color avatarColor;

  const _CommunityCard({
    required this.author,
    required this.role,
    required this.content,
    required this.likes,
    required this.timeAgo,
    required this.tags,
    required this.avatarColor,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFE8E8E8)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.04),
            blurRadius: 10,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              CircleAvatar(
                radius: 18,
                backgroundColor: avatarColor.withValues(alpha: 0.15),
                child: Text(
                  author[0],
                  style: GoogleFonts.outfit(
                    fontSize: 14,
                    fontWeight: FontWeight.w700,
                    color: avatarColor,
                  ),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(author, style: GlassTypography.labelLarge()),
                    Text('$role · $timeAgo', style: GlassTypography.bodySmall()),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          Text(
            content,
            style: GlassTypography.bodyMedium(color: GlassColors.textSecondary),
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
          ),
          const SizedBox(height: 10),
          Row(
            children: [
              ...tags.map((tag) => Container(
                margin: const EdgeInsets.only(right: 6),
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(
                  color: const Color(0xFFF3F4F6),
                  borderRadius: BorderRadius.circular(20),
                ),
                child: Text(
                  '#$tag',
                  style: GoogleFonts.outfit(
                    fontSize: 10,
                    fontWeight: FontWeight.w500,
                    color: GlassColors.textSecondary,
                  ),
                ),
              )),
              const Spacer(),
              const Icon(Icons.favorite_rounded, size: 14, color: Color(0xFFEC4899)),
              const SizedBox(width: 4),
              Text(
                '$likes',
                style: GoogleFonts.outfit(
                  fontSize: 12,
                  fontWeight: FontWeight.w600,
                  color: const Color(0xFFEC4899),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
