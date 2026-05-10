// ============================================================================
// FEATURE CONTRACT (per Quality DNA rule 2: contract before code)
// ----------------------------------------------------------------------------
// What: Records short audio with `record` and transcribes it via the hybrid
//       voice-to-text model. Short clips run on-device, longer ones cloud.
// Why:  Voice-first app — every chat surface needs mic input. Hybrid SDK
//       keeps short utterances private and free.
// Inputs:  microphone audio captured via `record` package.
// Outputs: transcript text rendered below the recorder.
// Failure: mic permission denied -> error banner. SDK errors are shown
//          verbatim because Phase T.2 parity tests need real diagnostics.
// Cost:    on-device only for clips < 10 s; longer clips bill at cloud rate.
// ============================================================================

import 'dart:io';

import 'package:flutter/material.dart';
import 'package:path_provider/path_provider.dart';
import 'package:record/record.dart';

import '../services/sahayakai_ai.dart';

class VoiceToTextScreen extends StatefulWidget {
  const VoiceToTextScreen({super.key});

  @override
  State<VoiceToTextScreen> createState() => _VoiceToTextScreenState();
}

class _VoiceToTextScreenState extends State<VoiceToTextScreen> {
  final _recorder = AudioRecorder();
  bool _recording = false;
  bool _loading = false;
  String _transcript = '';
  String? _error;
  String? _activePath;

  Future<void> _toggle() async {
    if (_recording) {
      final path = await _recorder.stop();
      setState(() => _recording = false);
      if (path != null) {
        await _transcribe(path);
      }
      return;
    }

    if (!await _recorder.hasPermission()) {
      setState(() => _error = 'Microphone permission denied.');
      return;
    }

    final dir = await getTemporaryDirectory();
    final path =
        '${dir.path}/sahayakai_${DateTime.now().millisecondsSinceEpoch}.m4a';
    await _recorder.start(const RecordConfig(), path: path);
    setState(() {
      _recording = true;
      _activePath = path;
      _transcript = '';
      _error = null;
    });
  }

  Future<void> _transcribe(String path) async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final bytes = await File(path).readAsBytes();
      final text = await SahayakAI.instance
          .transcribe(bytes, mimeType: 'audio/mp4');
      setState(() => _transcript = text);
    } catch (e) {
      setState(() => _error = e.toString());
    } finally {
      setState(() => _loading = false);
    }
  }

  @override
  void dispose() {
    _recorder.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Voice to text')),
      body: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            FilledButton.icon(
              onPressed: _loading ? null : _toggle,
              icon: Icon(_recording ? Icons.stop : Icons.mic),
              label: Text(_recording ? 'Stop' : 'Start recording'),
            ),
            const SizedBox(height: 16),
            if (_loading) const LinearProgressIndicator(),
            if (_error != null)
              Container(
                padding: const EdgeInsets.all(12),
                color: Colors.red.shade50,
                child: Text(
                  _error!,
                  style: TextStyle(color: Colors.red.shade900),
                ),
              ),
            if (_transcript.isNotEmpty)
              Card(
                child: Padding(
                  padding: const EdgeInsets.all(12),
                  child: Text(_transcript),
                ),
              ),
            if (_activePath != null)
              Padding(
                padding: const EdgeInsets.only(top: 12),
                child: Text(
                  'Last clip: $_activePath',
                  style: const TextStyle(fontSize: 11, color: Colors.grey),
                ),
              ),
          ],
        ),
      ),
    );
  }
}
