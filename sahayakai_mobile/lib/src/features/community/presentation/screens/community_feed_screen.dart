import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/theme/app_theme.dart';
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

  CommunityPost(
      {required this.author,
      required this.role,
      required this.timeAgo,
      required this.title,
      required this.content,
      this.likes = 0,
      this.comments = 0,
      required this.tags});
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
    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC), // Slate 50
      appBar: AppBar(
        title: Text("Teacher Hub",
            style: GoogleFonts.outfit(
                fontWeight: FontWeight.bold, color: Colors.black)),
        backgroundColor: Colors.white,
        elevation: 0,
        actions: [
          IconButton(
              icon: const Icon(Icons.search, color: Colors.black),
              onPressed: () {}),
          IconButton(
              icon: const Icon(Icons.notifications_none, color: Colors.black),
              onPressed: () {}),
        ],
      ),
      body: ListView.builder(
        padding: const EdgeInsets.all(16),
        itemCount: _posts.length,
        itemBuilder: (context, index) => _buildPostCard(_posts[index]),
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () {
          Navigator.push(context,
              MaterialPageRoute(builder: (_) => const SubmitContentScreen()));
        },
        backgroundColor: AppColors.primary,
        icon: const Icon(Icons.add, color: Colors.white),
        label: Text("New Post",
            style: GoogleFonts.outfit(
                fontWeight: FontWeight.bold, color: Colors.white)),
        elevation: 4,
      ),
    );
  }

  Widget _buildPostCard(CommunityPost post) {
    return Container(
      margin: const EdgeInsets.only(bottom: 16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          BoxShadow(
              color: Colors.black.withOpacity(0.05),
              blurRadius: 10,
              offset: const Offset(0, 2))
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Header
          Padding(
            padding: const EdgeInsets.all(16),
            child: Row(
              children: [
                CircleAvatar(
                  backgroundColor: Colors.orange.shade100,
                  foregroundColor: Colors.orange.shade800,
                  child: Text(post.author[0],
                      style: const TextStyle(fontWeight: FontWeight.bold)),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(post.author,
                          style: GoogleFonts.inter(
                              fontWeight: FontWeight.bold, fontSize: 15)),
                      Text("${post.role} • ${post.timeAgo}",
                          style: GoogleFonts.inter(
                              color: Colors.grey, fontSize: 12)),
                    ],
                  ),
                ),
                Icon(Icons.more_horiz, color: Colors.grey.shade400),
              ],
            ),
          ),

          const Divider(height: 1),

          // Content
          Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(post.title,
                    style: GoogleFonts.outfit(
                        fontWeight: FontWeight.bold, fontSize: 18)),
                const SizedBox(height: 8),
                Text(post.content,
                    style: GoogleFonts.inter(
                        fontSize: 15, height: 1.5, color: Colors.black87)),
                const SizedBox(height: 16),
                Wrap(
                  spacing: 8,
                  children: post.tags
                      .map((tag) => Container(
                            padding: const EdgeInsets.symmetric(
                                horizontal: 10, vertical: 4),
                            decoration: BoxDecoration(
                                color: Colors.grey.shade100,
                                borderRadius: BorderRadius.circular(20)),
                            child: Text("#$tag",
                                style: GoogleFonts.inter(
                                    fontSize: 12, color: Colors.grey.shade700)),
                          ))
                      .toList(),
                ),
              ],
            ),
          ),

          const Divider(height: 1),

          // Actions
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceAround,
              children: [
                _buildAction(
                    Icons.favorite_border, "${post.likes}", Colors.pink),
                _buildAction(
                    Icons.chat_bubble_outline, "${post.comments}", Colors.blue),
                _buildAction(Icons.bookmark_border, "Save", Colors.grey),
                _buildAction(Icons.share, "Share", Colors.grey),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildAction(IconData icon, String label, Color color) {
    return InkWell(
      onTap: () {},
      child: Row(
        children: [
          Icon(icon, size: 20, color: Colors.grey.shade600),
          const SizedBox(width: 6),
          Text(label,
              style: GoogleFonts.inter(
                  color: Colors.grey.shade600,
                  fontSize: 13,
                  fontWeight: FontWeight.w500)),
        ],
      ),
    );
  }
}
