import 'dart:ui';
import 'package:flutter/material.dart';
import '../../../core/theme/widgets/glass_card.dart';
import '../../../core/theme/widgets/mesh_background.dart';
import '../../../core/theme/widgets/segmented_control.dart';

/// Archive Library Screen - Shows saved lesson plans
/// Matches the glassmorphic design from Archive reference
class ArchiveLibraryScreen extends StatefulWidget {
  const ArchiveLibraryScreen({super.key});

  @override
  State<ArchiveLibraryScreen> createState() => _ArchiveLibraryScreenState();
}

class _ArchiveLibraryScreenState extends State<ArchiveLibraryScreen> {
  int _selectedTab = 0;
  final _tabs = ['All', 'Lessons', 'Quizzes', 'Videos'];

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;

    return Scaffold(
      backgroundColor: Colors.transparent,
      body: MeshBackground(
        child: SafeArea(
          child: Stack(
            children: [
              CustomScrollView(
                slivers: [
                  // Sticky Top App Bar
                  SliverAppBar(
                    floating: true,
                    pinned: true,
                    elevation: 0,
                    backgroundColor: isDark
                        ? const Color(0xFF23190F).withOpacity(0.8)
                        : const Color(0xFFF8F7F5).withOpacity(0.8),
                    flexibleSpace: ClipRRect(
                      child: BackdropFilter(
                        filter: ImageFilter.blur(sigmaX: 10, sigmaY: 10),
                        child: Container(color: Colors.transparent),
                      ),
                    ),
                    leading: IconButton(
                      icon: const Icon(Icons.arrow_back_ios_new),
                      onPressed: () => Navigator.of(context).pop(),
                    ),
                    actions: [
                      Padding(
                        padding: const EdgeInsets.only(right: 8),
                        child: Container(
                          width: 48,
                          height: 48,
                          decoration: BoxDecoration(
                            color: const Color(0xFFFF9933).withOpacity(0.1),
                            borderRadius: BorderRadius.circular(24),
                          ),
                          child: IconButton(
                            icon: const Icon(Icons.search),
                            color: const Color(0xFFFF9933),
                            onPressed: () {
                              // Search functionality
                            },
                          ),
                        ),
                      ),
                    ],
                    bottom: PreferredSize(
                      preferredSize: const Size.fromHeight(100),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Padding(
                            padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
                            child: Text(
                              'The Archive Library',
                              style: theme.textTheme.headlineMedium?.copyWith(
                                fontWeight: FontWeight.bold,
                                letterSpacing: -0.5,
                              ),
                            ),
                          ),
                          // Segmented Control
                          Padding(
                            padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
                            child: SegmentedControl(
                              segments: _tabs,
                              selectedIndex: _selectedTab,
                              onSegmentTapped: (index) {
                                setState(() => _selectedTab = index);
                              },
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),

                  // Content List
                  SliverPadding(
                    padding: const EdgeInsets.fromLTRB(16, 8, 16, 100),
                    sliver: SliverList(
                      delegate: SliverChildBuilderDelegate(
                        (context, index) {
                          return Padding(
                            padding: const EdgeInsets.only(bottom: 12),
                            child: _buildArchiveItem(
                              title: _mockItems[index]['title'] as String,
                              date: _mockItems[index]['date'] as String,
                              type: _mockItems[index]['type'] as String,
                              icon: _mockItems[index]['icon'] as IconData,
                              color: _mockItems[index]['color'] as Color,
                              hasVideo:
                                  _mockItems[index]['hasVideo'] as bool? ??
                                      false,
                            ),
                          );
                        },
                        childCount: _mockItems.length,
                      ),
                    ),
                  ),
                ],
              ),

              // Floating Action Button
              Positioned(
                bottom: 80,
                right: 16,
                child: _buildFAB(),
              ),

              // Bottom Navigation
              Positioned(
                bottom: 0,
                left: 0,
                right: 0,
                child: _buildBottomNav(),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildArchiveItem({
    required String title,
    required String date,
    required String type,
    required IconData icon,
    required Color color,
    bool hasVideo = false,
  }) {
    return GlassCard(
      padding: const EdgeInsets.all(16),
      borderRadius: 16,
      child: Row(
        children: [
          // Thumbnail with icon
          Stack(
            children: [
              Container(
                width: 64,
                height: 64,
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    colors: [color.withOpacity(0.6), color],
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                  ),
                  shape: BoxShape.circle,
                  border: Border.all(
                    color: Colors.white.withOpacity(0.2),
                    width: 2,
                  ),
                  boxShadow: [
                    BoxShadow(
                      color: color.withOpacity(0.3),
                      blurRadius: 12,
                    ),
                  ],
                ),
                child: Icon(
                  icon,
                  color: Colors.white,
                  size: 28,
                ),
              ),
              if (hasVideo)
                Positioned.fill(
                  child: Container(
                    decoration: BoxDecoration(
                      color: Colors.black.withOpacity(0.3),
                      shape: BoxShape.circle,
                    ),
                    child: const Icon(
                      Icons.play_circle,
                      color: Colors.white,
                      size: 24,
                    ),
                  ),
                ),
            ],
          ),
          const SizedBox(width: 16),

          // Content
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: const TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.bold,
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
                const SizedBox(height: 4),
                Text(
                  'Added on $date',
                  style: TextStyle(
                    fontSize: 12,
                    color: const Color(0xFF14B8A6).withOpacity(0.6),
                    fontWeight: FontWeight.w500,
                  ),
                ),
                const SizedBox(height: 8),
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                  decoration: BoxDecoration(
                    color: color.withOpacity(0.1),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Text(
                    type.toUpperCase(),
                    style: TextStyle(
                      fontSize: 10,
                      fontWeight: FontWeight.bold,
                      color: color,
                      letterSpacing: 1,
                    ),
                  ),
                ),
              ],
            ),
          ),

          // Action Buttons
          Row(
            children: [
              _buildActionButton(Icons.share, false),
              const SizedBox(width: 8),
              _buildActionButton(Icons.download, true),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildActionButton(IconData icon, bool isPrimary) {
    return Container(
      width: 40,
      height: 40,
      decoration: BoxDecoration(
        color: isPrimary
            ? const Color(0xFFFF9933).withOpacity(0.1)
            : Colors.white.withOpacity(0.1),
        shape: BoxShape.circle,
        border: Border.all(
          color: isPrimary
              ? const Color(0xFFFF9933).withOpacity(0.2)
              : Colors.black.withOpacity(0.05),
        ),
      ),
      child: Icon(
        icon,
        size: 20,
        color: isPrimary ? const Color(0xFFFF9933) : null,
      ),
    );
  }

  Widget _buildFAB() {
    return Container(
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(9999),
        boxShadow: [
          BoxShadow(
            color: const Color(0xFFFF9933).withOpacity(0.3),
            blurRadius: 20,
            offset: const Offset(0, 8),
          ),
        ],
      ),
      child: Material(
        color: const Color(0xFFFF9933),
        borderRadius: BorderRadius.circular(9999),
        child: InkWell(
          onTap: () {},
          borderRadius: BorderRadius.circular(9999),
          child: const Padding(
            padding: EdgeInsets.symmetric(horizontal: 24, vertical: 16),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(Icons.add_circle, color: Colors.white),
                SizedBox(width: 8),
                Text(
                  'Generate Content',
                  style: TextStyle(
                    color: Colors.white,
                    fontWeight: FontWeight.bold,
                    fontSize: 14,
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildBottomNav() {
    return GlassCard(
      padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
      borderRadius: 0,
      border: Border(
        top: BorderSide(
          color: const Color(0xFF14B8A6).withOpacity(0.1),
        ),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceAround,
        children: [
          _buildNavItem(Icons.home, 'Home', false),
          _buildNavItem(Icons.folder_special, 'Library', true),
          _buildNavItem(Icons.auto_awesome, 'AI Lab', false),
          _buildNavItem(Icons.person, 'Profile', false),
        ],
      ),
    );
  }

  Widget _buildNavItem(IconData icon, String label, bool isActive) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(
          icon,
          color: isActive
              ? const Color(0xFFFF9933)
              : const Color(0xFF14B8A6).withOpacity(0.4),
        ),
        const SizedBox(height: 4),
        Text(
          label,
          style: TextStyle(
            fontSize: 10,
            fontWeight: isActive ? FontWeight.bold : FontWeight.w500,
            color: isActive
                ? const Color(0xFFFF9933)
                : const Color(0xFF14B8A6).withOpacity(0.4),
          ),
        ),
      ],
    );
  }

  // Mock data
  final _mockItems = [
    {
      'title': 'Photosynthesis Class 6',
      'date': 'Oct 24, 2023',
      'type': 'Lesson Plan',
      'icon': Icons.science,
      'color': const Color(0xFFFF9933),
      'hasVideo': false,
    },
    {
      'title': 'Quadratic Equations',
      'date': 'Oct 22, 2023',
      'type': 'Video Lecture',
      'icon': Icons.functions,
      'color': const Color(0xFF14B8A6),
      'hasVideo': true,
    },
    {
      'title': 'Periodic Table Quiz',
      'date': 'Oct 20, 2023',
      'type': 'Quiz',
      'icon': Icons.quiz,
      'color': const Color(0xFFFF9933),
      'hasVideo': false,
    },
    {
      'title': 'Cell Structure & Function',
      'date': 'Oct 18, 2023',
      'type': 'Lesson Plan',
      'icon': Icons.biotech,
      'color': const Color(0xFFFF9933),
      'hasVideo': false,
    },
  ];
}
