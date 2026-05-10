// ============================================================================
// FEATURE CONTRACT (per Quality DNA rule 2: contract before code)
// ----------------------------------------------------------------------------
// What: Demos the VIDYA 11-way intent classifier running on-device.
// Why:  Classifier is small enough for Nano. Running it on-device removes
//       ~300 ms of round-trip latency from every assistant invocation and
//       keeps utterances private when offline.
// Inputs:  utterance typed by the user.
// Outputs: predicted intent label.
// Failure: malformed JSON from the model is shown verbatim — Phase T.2
//          parity tests must see exactly what Nano returned.
// Cost:    on-device only. Zero marginal cost.
// ============================================================================

import 'dart:convert';

import 'package:flutter/material.dart';

import '../services/sahayakai_ai.dart';

class VidyaClassifierScreen extends StatefulWidget {
  const VidyaClassifierScreen({super.key});

  @override
  State<VidyaClassifierScreen> createState() => _VidyaClassifierScreenState();
}

class _VidyaClassifierScreenState extends State<VidyaClassifierScreen> {
  final _controller = TextEditingController();
  String _intent = '';
  String? _error;
  bool _loading = false;

  Future<void> _classify() async {
    final utterance = _controller.text.trim();
    if (utterance.isEmpty) return;
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final raw = await SahayakAI.instance
          .ask(SahayakAI.instance.vidyaClassifier, utterance);
      final parsed = jsonDecode(raw) as Map<String, dynamic>;
      setState(() => _intent = parsed['intent']?.toString() ?? 'unknown');
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
      appBar: AppBar(title: const Text('VIDYA classifier')),
      body: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            TextField(
              controller: _controller,
              decoration: const InputDecoration(
                border: OutlineInputBorder(),
                hintText: 'Type what a teacher would say to VIDYA',
              ),
              minLines: 2,
              maxLines: 4,
            ),
            const SizedBox(height: 12),
            FilledButton(
              onPressed: _loading ? null : _classify,
              child: Text(_loading ? 'Classifying…' : 'Classify intent'),
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
            if (_intent.isNotEmpty)
              Card(
                child: ListTile(
                  title: const Text('Predicted intent'),
                  subtitle: Text(_intent),
                ),
              ),
          ],
        ),
      ),
    );
  }
}
