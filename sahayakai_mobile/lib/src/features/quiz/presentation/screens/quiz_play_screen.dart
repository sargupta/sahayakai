import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../domain/quiz_models.dart';

class QuizPlayScreen extends StatefulWidget {
  final Quiz quiz;
  const QuizPlayScreen({super.key, required this.quiz});

  @override
  State<QuizPlayScreen> createState() => _QuizPlayScreenState();
}

class _QuizPlayScreenState extends State<QuizPlayScreen> {
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

  @override
  Widget build(BuildContext context) {
    if (_currentIndex >= widget.quiz.questions.length) {
      return Scaffold(
        appBar: AppBar(title: const Text('Quiz Completed')),
        body: Center(
            child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Text("Score: $_score / ${widget.quiz.questions.length}", style: GoogleFonts.inter(fontSize: 24, fontWeight: FontWeight.bold)),
            const SizedBox(height: 20),
            ElevatedButton(onPressed: () => Navigator.pop(context), child: const Text("Back to Home"))
          ],
        )),
      );
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
}
