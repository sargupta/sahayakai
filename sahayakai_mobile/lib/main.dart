import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_dotenv/flutter_dotenv.dart';
import 'src/features/home/presentation/home_screen.dart';
import 'src/core/theme/providers/theme_provider.dart';
import 'src/core/theme/app_theme.dart';

// Feature Screen Imports
import 'src/features/lesson_plan/presentation/screens/create_lesson_screen.dart';
import 'src/features/quiz/presentation/screens/quiz_config_screen.dart';
import 'src/features/worksheet/presentation/screens/worksheet_wizard_screen.dart';
import 'src/features/rubric/presentation/screens/rubric_generator_screen.dart';
import 'src/features/visual_aid/presentation/screens/visual_aid_creator_screen.dart';
import 'src/features/instant_answer/presentation/screens/instant_answer_screen.dart';
import 'src/features/video/presentation/screens/video_storyteller_screen.dart';
import 'src/features/virtual_field_trip/presentation/screens/virtual_field_trip_screen.dart';
import 'src/features/content_creator/presentation/screens/content_creator_screen.dart';
import 'src/features/training/presentation/screens/teacher_training_screen.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await dotenv.load(fileName: ".env");
  runApp(const ProviderScope(child: SahayakApp()));
}

class SahayakApp extends ConsumerWidget {
  const SahayakApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    // Watch the Async Theme Provider
    final sahayakThemeAsync = ref.watch(sahayakThemeProvider);

    return sahayakThemeAsync.when(
      loading: () => const MaterialApp(
        home: Scaffold(
          body: Center(child: CircularProgressIndicator(color: Colors.orange)),
        ),
      ),
      error: (err, stack) => MaterialApp(
        home: Scaffold(
          body: Center(child: Text("Error loading theme: $err")),
        ),
      ),
      data: (sahayakTheme) {
        return MaterialApp(
          title: 'SahayakAI',
          debugShowCheckedModeBanner: false,
          // Integrate the loaded extension into Material 3
          theme: AppTheme.lightTheme.copyWith(
            extensions: [
              sahayakTheme, // The JSON-loaded tokens
            ],
          ),
          home: const HomeScreen(),
          routes: {
            '/create-lesson': (context) => const CreateLessonScreen(),
            '/quiz-config': (context) => const QuizConfigScreen(),
            '/worksheet-wizard': (context) => const WorksheetWizardScreen(),
            '/rubric-generator': (context) => const RubricGeneratorScreen(),
            '/visual-aid-creator': (context) => const VisualAidCreatorScreen(),
            '/instant-answer': (context) => const InstantAnswerScreen(),
            '/video-storyteller': (context) => const VideoStorytellerScreen(),
            '/virtual-field-trip': (context) => const VirtualFieldTripScreen(),
            '/content-creator': (context) => const ContentCreatorScreen(),
            '/teacher-training': (context) => const TeacherTrainingScreen(),
          },
        );
      },
    );
  }
}
