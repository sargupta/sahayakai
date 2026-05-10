// ============================================================================
// FEATURE CONTRACT (per Quality DNA rule 2: contract before code)
// ----------------------------------------------------------------------------
// What: Minimal UI for the instant-answer agent. Teacher types a question,
//       hits ask, and sees a two-sentence response.
// Why:  Demonstrates the on-device fallback path — when the device is
//       offline the SDK serves Nano; when online it routes to cloud.
// Inputs:  text question typed by the teacher.
// Outputs: short answer rendered below the input.
// Failure: errors render inline as a red banner — never swallowed because
//          Phase T.2 parity tests need to see real diagnostics.
// Cost:    on-device = free; cloud = ~₹0.0003 per call (Flash, 200 tokens).
// ============================================================================

import 'package:flutter/material.dart';

import '../services/sahayakai_ai.dart';

class InstantAnswerScreen extends StatefulWidget {
  const InstantAnswerScreen({super.key});

  @override
  State<InstantAnswerScreen> createState() => _InstantAnswerScreenState();
}

class _InstantAnswerScreenState extends State<InstantAnswerScreen> {
  final _controller = TextEditingController();
  String _answer = '';
  String? _error;
  bool _loading = false;

  Future<void> _ask() async {
    final question = _controller.text.trim();
    if (question.isEmpty) return;
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final reply = await SahayakAI.instance
          .ask(SahayakAI.instance.instantAnswer, question);
      setState(() => _answer = reply);
    } catch (e) {
      setState(() => _error = e.toString());
    } finally {
      setState(() => _loading = false);
    }
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Instant answer')),
      body: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            TextField(
              controller: _controller,
              decoration: const InputDecoration(
                border: OutlineInputBorder(),
                hintText: 'Ask a question (works offline once cached)',
              ),
              minLines: 2,
              maxLines: 4,
            ),
            const SizedBox(height: 12),
            FilledButton(
              onPressed: _loading ? null : _ask,
              child: Text(_loading ? 'Thinking…' : 'Ask'),
            ),
            const SizedBox(height: 16),
            if (_error != null)
              Container(
                padding: const EdgeInsets.all(12),
                color: Colors.red.shade50,
                child: Text(
                  _error!,
                  style: TextStyle(color: Colors.red.shade900),
                ),
              ),
            if (_answer.isNotEmpty)
              Card(
                child: Padding(
                  padding: const EdgeInsets.all(12),
                  child: Text(_answer),
                ),
              ),
          ],
        ),
      ),
    );
  }
}
