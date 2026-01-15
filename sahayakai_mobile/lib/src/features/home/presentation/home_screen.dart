import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

import 'package:sahayakai_mobile/src/core/theme/app_theme.dart';
import 'package:sahayakai_mobile/src/features/lesson_plan/presentation/screens/create_lesson_screen.dart';
import 'package:sahayakai_mobile/src/features/quiz/presentation/screens/quiz_config_screen.dart';
import 'package:sahayakai_mobile/src/features/chat/presentation/screens/chat_screen.dart';
import 'package:sahayakai_mobile/src/features/home/presentation/screens/my_library_screen.dart'; // Import for tabs
import 'package:sahayakai_mobile/src/features/community/presentation/screens/community_feed_screen.dart'; // Import for tabs
import 'widgets/app_drawer.dart';

import 'package:sahayakai_mobile/src/features/home/presentation/screens/tools_grid_screen.dart';
import 'package:sahayakai_mobile/src/features/home/presentation/screens/profile_screen.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  int _currentIndex = 0;

  @override
  Widget build(BuildContext context) {
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
      body: Container(
        decoration: const BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [
              Color(0xFFFFF7ED), // Orange-ish white
              Colors.white,
              Color(0xFFF0FDF4), // Green-ish white
            ],
          ),
        ),
        child: SafeArea(
          // Only wrap body in SafeArea if it's the dashboard?
          // Actually, standard SafeArea is good, but for the bottom nav we might need adjustment.
          // Let's keep it simple.
          child: IndexedStack(
            index: _currentIndex,
            children: pages,
          ),
        ),
      ),
      bottomNavigationBar: _buildBottomNavBar(),
    );
  }

  PreferredSizeWidget _buildCustomAppBar(BuildContext context) {
    return PreferredSize(
      preferredSize: const Size.fromHeight(70),
      child: Container(
        padding: const EdgeInsets.only(top: 8, bottom: 8, left: 8, right: 16),
        decoration: BoxDecoration(
            color: AppColors.background.withOpacity(0.8), // Semi-transparent
            border: const Border(
              bottom: BorderSide(
                color: Color(
                    0x1A000000), // Very light black/grey for transparency effect
                width: 1,
              ),
            ),
            boxShadow: [
              BoxShadow(
                  color: Colors.black.withOpacity(0.02),
                  blurRadius: 4,
                  offset: const Offset(0, 2)),
            ]),
        child: AppBar(
          backgroundColor: Colors.transparent,
          elevation: 0,
          leading: Builder(
            builder: (context) => IconButton(
              icon: const Icon(Icons.menu, color: AppColors.textMain, size: 28),
              onPressed: () => Scaffold.of(context).openDrawer(),
            ),
          ),
          centerTitle: true,
          title: Text(
            "SahayakAI",
            style: GoogleFonts.outfit(
              fontSize: 24,
              fontWeight: FontWeight.bold,
              color: AppColors.textMain,
            ),
          ),
          actions: [
            Stack(
              alignment: Alignment.topRight,
              children: [
                IconButton(
                  icon: const Icon(Icons.notifications_none_outlined,
                      color: AppColors.textMain, size: 28),
                  onPressed: () {},
                ),
                Positioned(
                  top: 8,
                  right: 8,
                  child: Container(
                    width: 10,
                    height: 10,
                    decoration: const BoxDecoration(
                      color: AppColors.primary,
                      shape: BoxShape.circle,
                    ),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildBottomNavBar() {
    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.05),
            blurRadius: 10,
            offset: const Offset(0, -2),
          ),
        ],
      ),
      child: BottomNavigationBar(
        currentIndex: _currentIndex,
        onTap: (index) => setState(() => _currentIndex = index),
        type: BottomNavigationBarType.fixed,
        backgroundColor: Colors.white,
        selectedItemColor: AppColors.primary,
        unselectedItemColor: AppColors.textLight,
        selectedLabelStyle:
            GoogleFonts.inter(fontSize: 12, fontWeight: FontWeight.w600),
        unselectedLabelStyle: GoogleFonts.inter(fontSize: 12),
        elevation: 0,
        items: const [
          BottomNavigationBarItem(icon: Icon(Icons.home_filled), label: "Home"),
          BottomNavigationBarItem(icon: Icon(Icons.grid_view), label: "Tools"),
          BottomNavigationBarItem(
              icon: Icon(Icons.people_alt_outlined), label: "Community"),
          BottomNavigationBarItem(
              icon: Icon(Icons.book_outlined), label: "Library"),
          BottomNavigationBarItem(
              icon: Icon(Icons.person_outline), label: "Profile"),
        ],
      ),
    );
  }

  Widget _buildDashboard(BuildContext context) {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // 1. Hero Card - Enhanced
          _buildHeroCard(),
          const SizedBox(height: 20), // Reduced from 32

          // 2. Quick Actions Header
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                "Quick Actions",
                style: GoogleFonts.outfit(
                    fontSize: 22,
                    fontWeight: FontWeight.bold,
                    color: const Color(0xFF111827) // Darker grey for contrast
                    ),
              ),
              TextButton(
                onPressed: () => setState(() => _currentIndex = 1),
                child: Text("View All",
                    style: GoogleFonts.inter(
                        fontWeight: FontWeight.w600,
                        color:
                            const Color(0xFFFF9933) // Saffron accent for link
                        )),
              ),
            ],
          ),
          const SizedBox(height: 12), // Reduced from 16
          _buildQuickActionsGrid(context),

          const SizedBox(height: 20), // Reduced from 32

          // 3. Recent Activity Header
          Text(
            "Recent Activity",
            style: GoogleFonts.outfit(
                fontSize: 22,
                fontWeight: FontWeight.bold,
                color: const Color(0xFF111827)),
          ),
          const SizedBox(height: 12), // Reduced from 16
          _buildRecentActivityItem(
              "Photosynthesis Lesson Plan",
              "Today, 10:30 AM",
              Icons.book,
              const Color(0xFFFEF2F2),
              const Color(0xFFDC2626)),
          _buildRecentActivityItem("Class 7 Science Quiz", "Yesterday",
              Icons.quiz, const Color(0xFFF3E8FF), const Color(0xFF7C3AED)),

          const SizedBox(height: 20), // Reduced from 32

          // 4. Teaching Insight (Tip of the Day)
          _buildTeachingInsightCard(),

          const SizedBox(height: 80), // Bottom padding
        ],
      ),
    );
  }

  Widget _buildHeroCard() {
    return Container(
      width: double.infinity,
      height: 220, // Slightly taller
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(32), // More rounded
        gradient: const LinearGradient(
          colors: [
            Color(0xFFFFAD66), // Rich Saffron
            Color(0xFFFFD1A3), // Soft Peach
            Color(0xFFFFF7ED), // Fade to white tint
          ],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          stops: [0.0, 0.6, 1.0],
        ),
        boxShadow: [
          BoxShadow(
            color: const Color(0xFFFF9933).withOpacity(0.3), // Colored shadow
            blurRadius: 24,
            offset: const Offset(0, 12),
            spreadRadius: -4,
          ),
        ],
      ),
      child: Stack(
        children: [
          // Use the generated vector asset
          Positioned(
            right: 0,
            top: 0,
            bottom: 0,
            child: ClipRRect(
              borderRadius: const BorderRadius.only(
                  topRight: Radius.circular(32),
                  bottomRight: Radius.circular(32)),
              child: Image.asset(
                'assets/images/hero_illustration.png',
                fit: BoxFit.cover,
                width: 200, // Adjust overlap
                alignment: Alignment.centerRight,
                color: Colors.white.withOpacity(
                    0.9), // Blend slightly if needed, or stick to raw
                colorBlendMode: BlendMode.modulate,
              ),
            ),
          ),

          Padding(
            padding: const EdgeInsets.all(28),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Text(
                  "Namaste,\nTeacher!",
                  style: GoogleFonts.dmSerifDisplay(
                      fontSize: 40, // Larger
                      fontWeight: FontWeight.bold,
                      color: const Color(0xFF1F2937), // Dark text contrast
                      height: 1.1,
                      shadows: [
                        Shadow(
                            color: Colors.white.withOpacity(0.5),
                            offset: const Offset(1, 1),
                            blurRadius: 2)
                      ]),
                ),
                const SizedBox(height: 12),
                SizedBox(
                  width: 180,
                  child: Text(
                    "Ready to inspire your students today?",
                    style: GoogleFonts.inter(
                        fontSize: 16,
                        fontWeight: FontWeight.w500,
                        color: const Color(0xFF4B5563)),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildQuickActionsGrid(BuildContext context) {
    return Column(
      children: [
        Row(
          children: [
            Expanded(
              child: _buildActionCard(
                context,
                "Plan \nLesson",
                Icons.menu_book_rounded,
                const Color(0xFFFFF1F2), // Pink-50
                const Color(0xFFBE123C), // Rose-700
                () => Navigator.push(
                    context,
                    MaterialPageRoute(
                        builder: (_) => const CreateLessonScreen())),
              ),
            ),
            const SizedBox(width: 20),
            Expanded(
              child: _buildActionCard(
                context,
                "Create \nQuiz",
                Icons.extension_rounded,
                const Color(0xFFF3E8FF), // Purple-50
                const Color(0xFF7E22CE), // Purple-700
                () => Navigator.push(
                    context,
                    MaterialPageRoute(
                        builder: (_) => const QuizConfigScreen())),
              ),
            ),
          ],
        ),
        const SizedBox(height: 20),

        // AI Assistant - Glass/Gradient Effect
        GestureDetector(
          onTap: () => Navigator.push(
              context, MaterialPageRoute(builder: (_) => const ChatScreen())),
          child: Container(
            width: double.infinity,
            padding: const EdgeInsets.all(24),
            decoration: BoxDecoration(
              gradient: const LinearGradient(
                colors: [Color(0xFFE0F2FE), Color(0xFFDBEAFE)], // Sky to Blue
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
              borderRadius: BorderRadius.circular(28),
              boxShadow: [
                BoxShadow(
                    color: const Color(0xFF3B82F6).withOpacity(0.2),
                    blurRadius: 16,
                    offset: const Offset(0, 8),
                    spreadRadius: -2),
              ],
              border:
                  Border.all(color: Colors.white.withOpacity(0.6), width: 1.5),
            ),
            child: Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(14),
                  decoration: const BoxDecoration(
                      color: Colors.white,
                      shape: BoxShape.circle,
                      boxShadow: [
                        BoxShadow(
                            color: Colors.black12,
                            blurRadius: 8,
                            offset: Offset(0, 4))
                      ]),
                  child: const Icon(Icons.auto_awesome,
                      color: Color(0xFF2563EB), size: 30),
                ),
                const SizedBox(width: 20),
                Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text("Ask Sahayak",
                        style: GoogleFonts.outfit(
                            fontSize: 20,
                            fontWeight: FontWeight.bold,
                            color: const Color(0xFF1E40AF) // Dark Blue
                            )),
                    Text("Your AI teaching assistant",
                        style: GoogleFonts.inter(
                            fontSize: 13, color: const Color(0xFF3B82F6))),
                  ],
                ),
                const Spacer(),
                const Icon(Icons.mic_none_rounded,
                    color: Color(0xFF2563EB), size: 28),
              ],
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildActionCard(BuildContext context, String title, IconData icon,
      Color bgColor, Color iconColor, VoidCallback onTap) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        height: 160,
        padding: const EdgeInsets.all(24),
        decoration: BoxDecoration(
          color: bgColor,
          borderRadius: BorderRadius.circular(28),
          boxShadow: [
            BoxShadow(
              color: bgColor.withOpacity(0.8), // Deep cool shadow matching bg
              blurRadius: 0, // Solid crisp shadow or none? Let's go soft
              offset: const Offset(0, 0),
            ),
            BoxShadow(
              color: Colors.black.withOpacity(0.05),
              blurRadius: 10,
              offset: const Offset(0, 4),
            ),
          ],
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Container(
              padding: const EdgeInsets.all(12),
              decoration: const BoxDecoration(
                  color: Colors.white,
                  shape: BoxShape.circle,
                  boxShadow: [
                    BoxShadow(
                        color: Colors.black12,
                        blurRadius: 6,
                        offset: Offset(0, 2))
                  ]),
              child: Icon(icon, color: iconColor, size: 28),
            ),
            Text(
              title,
              style: GoogleFonts.outfit(
                  fontSize: 20,
                  fontWeight: FontWeight.bold,
                  color: const Color(0xFF1F2937)),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildRecentActivityItem(
      String title, String time, IconData icon, Color bg, Color iconColor) {
    return Container(
      margin: const EdgeInsets.only(bottom: 16),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: Colors.grey.shade100),
        boxShadow: [
          BoxShadow(
              color: Colors.black.withOpacity(0.04),
              blurRadius: 12,
              offset: const Offset(0, 4)),
        ],
      ),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
                color: bg, borderRadius: BorderRadius.circular(16)),
            child: Icon(icon, color: iconColor),
          ),
          const SizedBox(width: 16),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title,
                    style: GoogleFonts.inter(
                        fontWeight: FontWeight.w600, fontSize: 16)),
                const SizedBox(height: 4),
                Text(time,
                    style: GoogleFonts.inter(fontSize: 13, color: Colors.grey)),
              ],
            ),
          ),
          Container(
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(
                color: Colors.grey.shade50, shape: BoxShape.circle),
            child: const Icon(Icons.arrow_forward_ios_rounded,
                size: 14, color: Colors.grey),
          )
        ],
      ),
    );
  }

  Widget _buildTeachingInsightCard() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text("TEACHING INSIGHT",
            style: GoogleFonts.inter(
                fontSize: 12,
                fontWeight: FontWeight.bold,
                letterSpacing: 1.2,
                color: AppColors.textLight)),
        const SizedBox(height: 12),
        Container(
          width: double.infinity,
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(28),
            boxShadow: [
              BoxShadow(
                  color: Colors.black.withOpacity(0.05),
                  blurRadius: 16,
                  offset: const Offset(0, 8),
                  spreadRadius: -2),
            ],
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Image Placeholder with Badge
              Stack(
                children: [
                  Container(
                    height: 180,
                    width: double.infinity,
                    decoration: BoxDecoration(
                        color: Colors.grey.shade200,
                        borderRadius: const BorderRadius.vertical(
                            top: Radius.circular(28)),
                        image: const DecorationImage(
                          image: NetworkImage(
                              "https://images.unsplash.com/photo-1509042239860-f550ce710b93?ixlib=rb-1.2.1&auto=format&fit=crop&w=800&q=80"),
                          fit: BoxFit.cover,
                        )),
                  ),
                  Positioned(
                    left: 20,
                    bottom: 20,
                    child: Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 14, vertical: 8),
                      decoration: BoxDecoration(
                          color: const Color(0xFFFF9933),
                          borderRadius: BorderRadius.circular(20),
                          boxShadow: [
                            BoxShadow(
                                color: Colors.black.withOpacity(0.2),
                                blurRadius: 8,
                                offset: const Offset(0, 2))
                          ]),
                      child: Text(
                        "TIP OF THE DAY",
                        style: GoogleFonts.inter(
                            fontSize: 11,
                            fontWeight: FontWeight.bold,
                            color: Colors.white,
                            letterSpacing: 0.5),
                      ),
                    ),
                  )
                ],
              ),
              Padding(
                padding: const EdgeInsets.all(24),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      "Connect math to harvest",
                      style: GoogleFonts.outfit(
                          fontSize: 22,
                          fontWeight: FontWeight.bold,
                          color: const Color(0xFF1F2937)),
                    ),
                    const SizedBox(height: 8),
                    Text(
                      "Use local crop yields to explain percentages. It helps students relate abstract concepts to their daily lives.",
                      style: GoogleFonts.inter(
                          fontSize: 15,
                          color: const Color(0xFF4B5563),
                          height: 1.6),
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
