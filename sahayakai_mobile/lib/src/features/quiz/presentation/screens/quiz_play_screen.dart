import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:share_plus/share_plus.dart';
import 'package:go_router/go_router.dart';
import '../../../../components/save_to_library_button.dart';
import '../../../../components/tts_play_button.dart';
import '../../../../components/share_to_community_button.dart';
import '../../../../core/services/metrics_service.dart';
import '../../domain/quiz_models.dart';

class QuizPlayScreen extends ConsumerStatefulWidget {
  final Quiz quiz;
  const QuizPlayScreen({super.key, required this.quiz});

  @override
  ConsumerState<QuizPlayScreen> createState() => _QuizPlayScreenState();
}

class _QuizPlayScreenState extends ConsumerState<QuizPlayScreen> {
  int _currentIndex = 0;
  int _score = 0;
  bool _showAnswer = false;
  String? _selectedOption;

  void _submitAnswer() {
    setState(() {
      _showAnswer = true;
      if (_selectedOption == widget.quiz.questions[_currentIndex].correctAnswer) {
        _score++;
      }
    });
  }

  void _nextQuestion() {
    setState(() {
      _currentIndex++;
      _showAnswer = false;
      _selectedOption = null;
    });
  }

  void _retryQuiz() {
    setState(() {
      _currentIndex = 0;
      _score = 0;
      _showAnswer = false;
      _selectedOption = null;
    });
  }

  @override
  Widget build(BuildContext context) {
    if (_currentIndex >= widget.quiz.questions.length) {
      return _buildCompletionScreen();
    }

    final question = widget.quiz.questions[_currentIndex];

    return Scaffold(
      appBar: AppBar(
        title: Text("Question ${_currentIndex + 1}/${widget.quiz.questions.length}"),
        backgroundColor: const Color(0xFF16A34A),
        foregroundColor: Colors.white,
      ),
      body: Padding(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(question.text, style: GoogleFonts.inter(fontSize: 18, fontWeight: FontWeight.w600)),
            const SizedBox(height: 24),
            ...question.options.map((option) {
              final isSelected = _selectedOption == option;
              final isCorrect = option == question.correctAnswer;

              Color color = Colors.white;
              if (_showAnswer) {
                if (isCorrect) color = Colors.green.shade100;
                if (isSelected && !isCorrect) color = Colors.red.shade100;
              } else if (isSelected) {
                color = Colors.blue.shade50;
              }

              return Padding(
                padding: const EdgeInsets.only(bottom: 12),
                child: InkWell(
                  onTap: _showAnswer ? null : () => setState(() => _selectedOption = option),
                  child: Container(
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      color: color,
                      border: Border.all(color: Colors.grey.shade300),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Text(option),
                  ),
                ),
              );
            }),
            const Spacer(),
            if (_showAnswer)
               Text("Explanation: ${question.explanation}", style: const TextStyle(fontStyle: FontStyle.italic)),
            const SizedBox(height: 12),
            SizedBox(
              height: 50,
              child: ElevatedButton(
                style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFF16A34A), foregroundColor: Colors.white),
                onPressed: _selectedOption == null ? null : (_showAnswer ? _nextQuestion : _submitAnswer),
                child: Text(_showAnswer ? (_currentIndex == widget.quiz.questions.length - 1 ? "Finish" : "Next Question") : "Submit"),
              ),
            )
          ],
        ),
      ),
    );
  }

  Widget _buildCompletionScreen() {
    final total = widget.quiz.questions.length;
    final percentage = total > 0 ? (_score / total * 100).round() : 0;

    // Track quiz completion with score details.
    MetricsService.trackEvent('quiz_completed', properties: {
      'title': widget.quiz.title,
      'score': '$_score',
      'total': '$total',
      'percentage': '$percentage',
    });

    String emoji;
    String message;
    Color accentColor;

    if (percentage >= 80) {
      emoji = '\u{1F3C6}'; // trophy
      message = 'Outstanding! You really know your stuff!';
      accentColor = const Color(0xFFFFD700);
    } else if (percentage >= 50) {
      emoji = '\u{1F44D}'; // thumbs up
      message = 'Good job! Keep learning and improving!';
      accentColor = const Color(0xFF16A34A);
    } else {
      emoji = '\u{1F3AF}'; // target
      message = 'Keep practicing! Every attempt makes you better!';
      accentColor = const Color(0xFFEF4444);
    }

    const greenPrimary = Color(0xFF16A34A);

    return Scaffold(
      appBar: AppBar(
        title: Text('Quiz Completed', style: GoogleFonts.outfit(fontWeight: FontWeight.w600)),
        backgroundColor: greenPrimary,
        foregroundColor: Colors.white,
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(24.0),
        child: Column(
          children: [
            const SizedBox(height: 16),
            // Emoji / icon
            Text(
              emoji,
              style: const TextStyle(fontSize: 72),
            ),
            const SizedBox(height: 16),
            // Score
            Text(
              'Score: $_score / $total',
              style: GoogleFonts.outfit(
                fontSize: 32,
                fontWeight: FontWeight.bold,
                color: greenPrimary,
              ),
            ),
            const SizedBox(height: 8),
            // Percentage
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
              decoration: BoxDecoration(
                color: accentColor.withOpacity(0.15),
                borderRadius: BorderRadius.circular(20),
              ),
              child: Text(
                '$percentage%',
                style: GoogleFonts.outfit(
                  fontSize: 24,
                  fontWeight: FontWeight.w700,
                  color: accentColor,
                ),
              ),
            ),
            const SizedBox(height: 16),
            // Motivational message
            Text(
              message,
              textAlign: TextAlign.center,
              style: GoogleFonts.inter(
                fontSize: 16,
                fontWeight: FontWeight.w500,
                color: Colors.grey.shade700,
              ),
            ),
            const SizedBox(height: 20),
            // TTS: read score aloud
            Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                TTSPlayButton(
                  text: 'You scored $_score out of $total. $message',
                ),
                const SizedBox(width: 12),
                ShareToCommunityButton(
                  type: 'quiz',
                  title: widget.quiz.title,
                  data: {
                    'title': widget.quiz.title,
                    'score': _score,
                    'total': total,
                    'percentage': percentage,
                  },
                  topic: widget.quiz.title,
                ),
              ],
            ),
            const SizedBox(height: 24),
            // 2x2 action button grid
            GridView.count(
              crossAxisCount: 2,
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              mainAxisSpacing: 12,
              crossAxisSpacing: 12,
              childAspectRatio: 1.6,
              children: [
                // Save to Library
                _CompletionActionCard(
                  icon: Icons.bookmark_add_rounded,
                  label: 'Save to Library',
                  color: greenPrimary,
                  customWidget: SaveToLibraryButton(
                    type: 'quiz',
                    title: widget.quiz.title,
                    data: {
                      'title': widget.quiz.title,
                      'score': _score,
                      'total': total,
                      'percentage': percentage,
                    },
                  ),
                ),
                // Share Score
                _CompletionActionCard(
                  icon: Icons.share_rounded,
                  label: 'Share Score',
                  color: const Color(0xFF2563EB),
                  onTap: () {
                    Share.share(
                      'I scored $_score/$total on ${widget.quiz.title} quiz on SahayakAI!',
                    );
                  },
                ),
                // Retry Quiz
                _CompletionActionCard(
                  icon: Icons.refresh_rounded,
                  label: 'Retry Quiz',
                  color: const Color(0xFFF59E0B),
                  onTap: _retryQuiz,
                ),
                // New Quiz
                _CompletionActionCard(
                  icon: Icons.add_circle_outline_rounded,
                  label: 'New Quiz',
                  color: const Color(0xFF8B5CF6),
                  onTap: () => Navigator.pop(context),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _CompletionActionCard extends StatelessWidget {
  final IconData icon;
  final String label;
  final Color color;
  final VoidCallback? onTap;
  final Widget? customWidget;

  const _CompletionActionCard({
    required this.icon,
    required this.label,
    required this.color,
    this.onTap,
    this.customWidget,
  });

  @override
  Widget build(BuildContext context) {
    return Material(
      color: color.withOpacity(0.08),
      borderRadius: BorderRadius.circular(16),
      child: InkWell(
        onTap: customWidget != null ? null : onTap,
        borderRadius: BorderRadius.circular(16),
        child: Container(
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: color.withOpacity(0.2)),
          ),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              if (customWidget != null)
                IconTheme(
                  data: IconThemeData(color: color, size: 28),
                  child: customWidget!,
                )
              else
                Icon(icon, color: color, size: 28),
              const SizedBox(height: 8),
              Text(
                label,
                textAlign: TextAlign.center,
                style: GoogleFonts.inter(
                  fontSize: 13,
                  fontWeight: FontWeight.w600,
                  color: color,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
