import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

class TrainingModule {
  final String title;
  final String duration;
  final String instructor;
  final String description;
  final double progress;
  final Color color;

  TrainingModule({
    required this.title,
    required this.duration,
    required this.instructor,
    required this.description,
    this.progress = 0.0,
    required this.color,
  });
}

class TeacherTrainingScreen extends ConsumerStatefulWidget {
  const TeacherTrainingScreen({super.key});

  @override
  ConsumerState<TeacherTrainingScreen> createState() =>
      _TeacherTrainingScreenState();
}

class _TeacherTrainingScreenState extends ConsumerState<TeacherTrainingScreen> {
  final List<TrainingModule> _modules = [
    TrainingModule(
      title: "AI in the Classroom",
      duration: "45 mins",
      instructor: "Dr. A. Rao",
      description:
          "Learn how to use SahayakAI to automate lesson planning and quizzes.",
      progress: 0.7,
      color: Colors.blue,
    ),
    TrainingModule(
      title: "Classroom Management",
      duration: "30 mins",
      instructor: "Sarah Jenkins",
      description:
          "Effective strategies for large, diverse classrooms in India.",
      progress: 0.0,
      color: Colors.orange,
    ),
    TrainingModule(
      title: "Inclusive Education",
      duration: "60 mins",
      instructor: "N. Gupta",
      description:
          "Techniques to ensure every student feels included and valued.",
      progress: 0.2,
      color: Colors.purple,
    ),
    TrainingModule(
      title: "Digital Assessment",
      duration: "40 mins",
      instructor: "Tech Team",
      description:
          "Mastering digital tools for quick and accurate student assessment.",
      progress: 0.0,
      color: Colors.teal,
    ),
  ];

  @override
  Widget build(BuildContext context) {
    // We can use language to filter content in future
    // final language = ref.watch(languageProvider);

    return Scaffold(
      extendBodyBehindAppBar: true,
      appBar: AppBar(
        title: Text("Teacher Academy",
            style: GoogleFonts.outfit(
                fontWeight: FontWeight.bold, color: Colors.black87)),
        backgroundColor: Colors.white.withOpacity(0.8),
        elevation: 0,
        iconTheme: const IconThemeData(color: Colors.black87),
      ),
      body: Container(
        decoration: BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
            colors: [Colors.blue.shade50, Colors.white],
          ),
        ),
        child: SafeArea(
          child: ListView(
            padding: const EdgeInsets.all(24),
            children: [
              _buildHeroCard(),
              const SizedBox(height: 32),
              Text("Available Modules",
                  style: GoogleFonts.outfit(
                      fontSize: 20,
                      fontWeight: FontWeight.bold,
                      color: Colors.black87)),
              const SizedBox(height: 16),
              ..._modules.map((m) => _buildModuleCard(context, m)),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildHeroCard() {
    final activeModule = _modules.first;
    return Container(
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        color: const Color(0xFF2563EB), // Royal Blue
        borderRadius: BorderRadius.circular(24),
        boxShadow: [
          BoxShadow(
              color: Colors.blue.withOpacity(0.3),
              blurRadius: 20,
              offset: const Offset(0, 10))
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                decoration: BoxDecoration(
                    color: Colors.white24,
                    borderRadius: BorderRadius.circular(20)),
                child: Text("CONTINUE LEARNING",
                    style: GoogleFonts.inter(
                        color: Colors.white,
                        fontWeight: FontWeight.bold,
                        fontSize: 10)),
              ),
              const Spacer(),
              const Icon(Icons.play_circle_fill, color: Colors.white, size: 32),
            ],
          ),
          const SizedBox(height: 24),
          Text(activeModule.title,
              style: GoogleFonts.outfit(
                  fontSize: 24,
                  fontWeight: FontWeight.bold,
                  color: Colors.white)),
          const SizedBox(height: 8),
          Text("Instructor: ${activeModule.instructor}",
              style: GoogleFonts.inter(color: Colors.white70)),
          const SizedBox(height: 24),
          LinearProgressIndicator(
            value: activeModule.progress,
            backgroundColor: Colors.white24,
            valueColor: const AlwaysStoppedAnimation(Colors.white),
          ),
          const SizedBox(height: 8),
          Text("${(activeModule.progress * 100).toInt()}% Completed",
              style: GoogleFonts.inter(color: Colors.white70, fontSize: 12)),
        ],
      ),
    );
  }

  Widget _buildModuleCard(BuildContext context, TrainingModule module) {
    return Container(
      margin: const EdgeInsets.only(bottom: 16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
        boxShadow: [
          BoxShadow(
              color: Colors.black.withOpacity(0.05),
              blurRadius: 10,
              offset: const Offset(0, 4))
        ],
      ),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          borderRadius: BorderRadius.circular(20),
          onTap: () => _showModuleDetail(context, module),
          child: Padding(
            padding: const EdgeInsets.all(20),
            child: Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: module.color.withOpacity(0.1),
                    shape: BoxShape.circle,
                  ),
                  child: Icon(Icons.school, color: module.color),
                ),
                const SizedBox(width: 16),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(module.title,
                          style: GoogleFonts.inter(
                              fontWeight: FontWeight.bold, fontSize: 16)),
                      const SizedBox(height: 4),
                      Text(module.duration,
                          style: GoogleFonts.inter(
                              color: Colors.grey, fontSize: 13)),
                    ],
                  ),
                ),
                Icon(Icons.arrow_forward_ios,
                    size: 16, color: Colors.grey.shade300),
              ],
            ),
          ),
        ),
      ),
    );
  }

  void _showModuleDetail(BuildContext context, TrainingModule module) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) => Container(
        height: MediaQuery.of(context).size.height * 0.85,
        decoration: const BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.vertical(top: Radius.circular(32)),
        ),
        padding: const EdgeInsets.all(32),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Center(
                child: Container(
                    width: 40,
                    height: 4,
                    decoration: BoxDecoration(
                        color: Colors.grey.shade300,
                        borderRadius: BorderRadius.circular(2)))),
            const SizedBox(height: 32),
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                  color: module.color.withOpacity(0.1), shape: BoxShape.circle),
              child: Icon(Icons.school, size: 48, color: module.color),
            ),
            const SizedBox(height: 24),
            Text(module.title,
                textAlign: TextAlign.center,
                style: GoogleFonts.outfit(
                    fontSize: 24, fontWeight: FontWeight.bold)),
            const SizedBox(height: 8),
            Text("by ${module.instructor}",
                textAlign: TextAlign.center,
                style: GoogleFonts.inter(color: Colors.grey)),
            const SizedBox(height: 32),
            Text("About this course",
                style: GoogleFonts.inter(
                    fontWeight: FontWeight.bold, fontSize: 16)),
            const SizedBox(height: 8),
            Text(module.description,
                style: GoogleFonts.inter(
                    height: 1.6, color: Colors.grey.shade700)),
            const Spacer(),
            ElevatedButton(
              onPressed: () => Navigator.pop(context),
              style: ElevatedButton.styleFrom(
                backgroundColor: module.color,
                foregroundColor: Colors.white,
                padding: const EdgeInsets.symmetric(vertical: 20),
                shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(16)),
              ),
              child: const Text("Start Lesson",
                  style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
            ),
          ],
        ),
      ),
    );
  }
}
