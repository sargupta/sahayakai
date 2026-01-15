import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../features/lesson_plan/presentation/screens/create_lesson_screen.dart';
import '../../../../features/quiz/presentation/screens/quiz_config_screen.dart';
// Still keep this as "Sahayak AI" or replace? Image says "AI Companion" at top.
import '../../../../features/home/presentation/screens/my_library_screen.dart';
import '../../../../features/worksheet/presentation/screens/worksheet_wizard_screen.dart';
import '../../../../features/rubric/presentation/screens/rubric_generator_screen.dart';
import '../../../../features/visual_aid/presentation/screens/visual_aid_creator_screen.dart';
import '../../../../features/video/presentation/screens/video_storyteller_screen.dart';
import '../../../../features/virtual_field_trip/presentation/screens/virtual_field_trip_screen.dart';
import '../../../../features/training/presentation/screens/teacher_training_screen.dart';
import '../../../../features/impact/presentation/screens/impact_dashboard_screen.dart';
import '../../../../features/community/presentation/screens/community_feed_screen.dart';
import '../../../../features/instant_answer/presentation/screens/instant_answer_screen.dart';
import '../../../../features/content_creator/presentation/screens/content_creator_screen.dart';
import '../../../../features/community/presentation/screens/submit_content_screen.dart';
import '../../../../features/admin/presentation/screens/review_panel_screen.dart';

import '../../../../features/home/presentation/screens/profile_screen.dart';

class AppDrawer extends ConsumerWidget {
  const AppDrawer({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Drawer(
      child: Column(
        children: [
          // 1. User Profile Header - Styled like "AI Companion" or just generic helpful header
          UserAccountsDrawerHeader(
            decoration: const BoxDecoration(
              color: AppColors.primary,
            ),
            currentAccountPicture: CircleAvatar(
              backgroundColor: Colors.white,
              child: Text("SG",
                  style: TextStyle(
                      color: AppColors.primary, fontWeight: FontWeight.bold)),
            ),
            accountName: const Text("Sargupta",
                style: TextStyle(fontWeight: FontWeight.bold)),
            accountEmail: const Text("Government High School, Madurai"),
          ),

          // 2. Navigation Items
          Expanded(
            child: ListView(
              padding: EdgeInsets.zero,
              children: [
                _buildSectionHeader("AI Tools"),
                _buildDrawerItem(context,
                    icon: Icons.calendar_today,
                    title: "Lesson Plan",
                    onTap: () => _nav(context, const CreateLessonScreen())),
                _buildDrawerItem(context,
                    icon: Icons.assignment_turned_in,
                    title: "Rubric Generator",
                    onTap: () => _nav(context, const RubricGeneratorScreen())),
                _buildDrawerItem(context,
                    icon: Icons.edit_note,
                    title: "Worksheet Wizard",
                    onTap: () => _nav(context, const WorksheetWizardScreen())),
                _buildDrawerItem(context,
                    icon: Icons.quiz_outlined,
                    title: "Quiz Generator",
                    onTap: () => _nav(context, const QuizConfigScreen())),
                _buildDrawerItem(context,
                    icon: Icons.image_outlined,
                    title: "Visual Aid Designer",
                    onTap: () => _nav(context, const VisualAidCreatorScreen())),
                _buildDrawerItem(context,
                    icon: Icons.auto_awesome,
                    title: "Instant Answer",
                    onTap: () => _nav(context, const InstantAnswerScreen())),
                _buildDrawerItem(context,
                    icon: Icons.menu_book,
                    title: "Content Creator",
                    onTap: () => _nav(context, const ContentCreatorScreen())),
                _buildDrawerItem(context,
                    icon: Icons.video_camera_back_outlined,
                    title: "Video Storyteller",
                    onTap: () => _nav(context, const VideoStorytellerScreen())),
                _buildDrawerItem(context,
                    icon: Icons.school_outlined,
                    title: "Teacher Training",
                    onTap: () => _nav(context, const TeacherTrainingScreen())),
                _buildDrawerItem(context,
                    icon: Icons.public,
                    title: "Virtual Field Trip",
                    onTap: () => _nav(context, const VirtualFieldTripScreen())),
                // Keep generic chat if needed or hidden? Image doesn't show "Sahayak Assistant" explicitly in list, but "AI Companion" is header.
                // We can keep it or hide it. I'll add it as "AI Chat" if desired, but user list is specific. I'll stick to list.

                _buildSectionHeader("Platform"),
                _buildDrawerItem(context,
                    icon: Icons.folder_open,
                    title: "My Library",
                    onTap: () => _nav(context, const MyLibraryScreen())),
                _buildDrawerItem(context,
                    icon: Icons.people_alt_outlined,
                    title: "Community Library",
                    onTap: () => _nav(context, const CommunityFeedScreen())),
                _buildDrawerItem(context,
                    icon: Icons.bar_chart,
                    title: "Impact Dashboard",
                    onTap: () => _nav(context, const ImpactDashboardScreen())),
                _buildDrawerItem(context,
                    icon: Icons.upload_file,
                    title: "Submit Content",
                    onTap: () => _nav(context, const SubmitContentScreen())),
                _buildDrawerItem(context,
                    icon: Icons.person_outline,
                    title: "My Profile",
                    onTap: () => _nav(context, const ProfileScreen())),

                _buildSectionHeader("Admin"),
                _buildDrawerItem(context,
                    icon: Icons.admin_panel_settings_outlined,
                    title: "Review Panel",
                    onTap: () => _nav(context, const ReviewPanelScreen())),
              ],
            ),
          ),

          // 3. Footer
          const Divider(),
          ListTile(
            leading: const Icon(Icons.settings, color: AppColors.textLight),
            title: const Text("Settings"),
            onTap: () {},
          ),
          const SizedBox(height: 16),
        ],
      ),
    );
  }

  Widget _buildSectionHeader(String title) {
    return Padding(
      padding:
          const EdgeInsets.fromLTRB(16, 24, 16, 8), // Increased top padding
      child: Text(
        title, // Case sensitive match to image? Image uses "AI Tools", "Platform", "Admin"
        style: const TextStyle(
          color: AppColors.textLight, // Grey color
          fontSize: 14,
          fontWeight: FontWeight.w500,
        ),
      ),
    );
  }

  Widget _buildDrawerItem(BuildContext context,
      {required IconData icon,
      required String title,
      VoidCallback? onTap,
      bool isComingSoon = false}) {
    return ListTile(
      dense: true, // Make items compact like image
      contentPadding: const EdgeInsets.symmetric(horizontal: 24, vertical: 0),
      leading: Icon(icon, color: Colors.grey.shade600, size: 22), // Grey icons
      title: Text(title,
          style: TextStyle(
              color: Colors.grey.shade800,
              fontSize: 16,
              fontWeight: FontWeight.normal)),
      onTap: isComingSoon
          ? null
          : () {
              Navigator.pop(context); // Close drawer
              if (onTap != null) onTap();
            },
    );
  }

  void _nav(BuildContext context, Widget screen) {
    Navigator.push(context, MaterialPageRoute(builder: (c) => screen));
  }
}
