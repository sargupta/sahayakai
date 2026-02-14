import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/theme/glassmorphic/glass_components.dart';
import 'submit_content_screen.dart';

class CommunityPost {
  final String author;
  final String role;
  final String timeAgo;
  final String title;
  final String content;
  final int likes;
  final int comments;
  final List<String> tags;

  CommunityPost({
    required this.author,
    required this.role,
    required this.timeAgo,
    required this.title,
    required this.content,
    this.likes = 0,
    this.comments = 0,
    required this.tags,
  });
}

class CommunityFeedScreen extends ConsumerStatefulWidget {
  const CommunityFeedScreen({super.key});

  @override
  ConsumerState<CommunityFeedScreen> createState() =>
      _CommunityFeedScreenState();
}

class _CommunityFeedScreenState extends ConsumerState<CommunityFeedScreen> {
  final List<CommunityPost> _posts = [
    CommunityPost(
      author: "Priya Sharma",
      role: "Science Teacher",
      timeAgo: "2h ago",
      title: "Interactive Solar System Lesson",
      content:
          "Just created a VR-based lesson plan for the solar system. Students loved the 3D visualization! Check it out in my shared resources.",
      likes: 24,
      comments: 5,
      tags: ["Science", "VR", "Class 6"],
    ),
    CommunityPost(
      author: "Ramesh Gupta",
      role: "Math Head",
      timeAgo: "5h ago",
      title: "Vedic Math Tricks for Division",
      content:
          "Found a great way to teach long division using Vedic Math principles. It speeds up calculation by 50%. Here's the worksheet.",
      likes: 42,
      comments: 12,
      tags: ["Math", "Vedic", "Tips"],
    ),
    CommunityPost(
      author: "Anjali Desai",
      role: "History Teacher",
      timeAgo: "1d ago",
      title: "The Mughal Empire Timeline",
      content:
          "Created a visual timeline for the Mughal Empire using the Timeline tool. Students find it much easier to remember dates now.",
      likes: 18,
      comments: 2,
      tags: ["History", "Visuals"],
    ),
  ];

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: const BoxDecoration(
        gradient: GlassColors.warmBackgroundGradient,
      ),
      child: Stack(
        children: [
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Header
              Padding(
                padding: const EdgeInsets.all(GlassSpacing.xl),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Connect & Share',
                      style: GlassTypography.decorativeLabel(),
                    ),
                    const SizedBox(height: GlassSpacing.xs),
                    Text(
                      'Teacher Hub',
                      style: GlassTypography.headline1(),
                    ),
                    const SizedBox(height: GlassSpacing.sm),
                    Container(
                      width: 60,
                      height: 2,
                      color: GlassColors.textTertiary.withOpacity(0.3),
                    ),
                  ],
                ),
              ),

              // Posts List
              Expanded(
                child: ListView.builder(
                  padding: const EdgeInsets.symmetric(
                    horizontal: GlassSpacing.xl,
                  ),
                  itemCount: _posts.length,
                  itemBuilder: (context, index) => _buildPostCard(_posts[index]),
                ),
              ),
            ],
          ),

          // FAB
          Positioned(
            bottom: GlassSpacing.xl,
            right: GlassSpacing.xl,
            child: GlassFloatingButton(
              label: 'New Post',
              icon: Icons.add_rounded,
              onPressed: () {
                Navigator.push(
                  context,
                  MaterialPageRoute(builder: (_) => const SubmitContentScreen()),
                );
              },
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildPostCard(CommunityPost post) {
    return Padding(
      padding: const EdgeInsets.only(bottom: GlassSpacing.lg),
      child: GlassCard(
        padding: EdgeInsets.zero,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Header
            Padding(
              padding: const EdgeInsets.all(GlassSpacing.lg),
              child: Row(
                children: [
                  Container(
                    width: 44,
                    height: 44,
                    decoration: BoxDecoration(
                      color: GlassColors.primary.withOpacity(0.1),
                      shape: BoxShape.circle,
                    ),
                    child: Center(
                      child: Text(
                        post.author[0],
                        style: GlassTypography.headline3(
                          color: GlassColors.primary,
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(width: GlassSpacing.md),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          post.author,
                          style: GlassTypography.labelLarge(),
                        ),
                        Text(
                          '${post.role} • ${post.timeAgo}',
                          style: GlassTypography.bodySmall(),
                        ),
                      ],
                    ),
                  ),
                  const Icon(
                    Icons.more_horiz_rounded,
                    color: GlassColors.textTertiary,
                  ),
                ],
              ),
            ),

            const Divider(height: 1, color: GlassColors.divider),

            // Content
            Padding(
              padding: const EdgeInsets.all(GlassSpacing.lg),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    post.title,
                    style: GlassTypography.headline3(),
                  ),
                  const SizedBox(height: GlassSpacing.sm),
                  Text(
                    post.content,
                    style: GlassTypography.bodyMedium(
                      color: GlassColors.textSecondary,
                    ),
                  ),
                  const SizedBox(height: GlassSpacing.lg),
                  Wrap(
                    spacing: GlassSpacing.sm,
                    runSpacing: GlassSpacing.sm,
                    children: post.tags
                        .map((tag) => Container(
                              padding: const EdgeInsets.symmetric(
                                horizontal: GlassSpacing.md,
                                vertical: GlassSpacing.xs,
                              ),
                              decoration: BoxDecoration(
                                color: GlassColors.inputBackground,
                                borderRadius: BorderRadius.circular(GlassRadius.pill),
                              ),
                              child: Text(
                                '#$tag',
                                style: GlassTypography.labelSmall(),
                              ),
                            ))
                        .toList(),
                  ),
                ],
              ),
            ),

            const Divider(height: 1, color: GlassColors.divider),

            // Actions
            Padding(
              padding: const EdgeInsets.symmetric(
                horizontal: GlassSpacing.lg,
                vertical: GlassSpacing.md,
              ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceAround,
                children: [
                  _buildAction(
                    Icons.favorite_border_rounded,
                    '${post.likes}',
                    const Color(0xFFEC4899),
                  ),
                  _buildAction(
                    Icons.chat_bubble_outline_rounded,
                    '${post.comments}',
                    const Color(0xFF3B82F6),
                  ),
                  _buildAction(
                    Icons.bookmark_border_rounded,
                    'Save',
                    GlassColors.textSecondary,
                  ),
                  _buildAction(
                    Icons.share_rounded,
                    'Share',
                    GlassColors.textSecondary,
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildAction(IconData icon, String label, Color color) {
    return GestureDetector(
      onTap: () {},
      child: Row(
        children: [
          Icon(icon, size: 20, color: color),
          const SizedBox(width: 6),
          Text(
            label,
            style: GlassTypography.labelSmall(color: color),
          ),
        ],
      ),
    );
  }
}
