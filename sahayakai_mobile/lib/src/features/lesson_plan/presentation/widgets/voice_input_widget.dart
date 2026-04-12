import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_sound/flutter_sound.dart';
import 'package:path_provider/path_provider.dart';
import 'package:permission_handler/permission_handler.dart';
import 'package:flutter_animate/flutter_animate.dart';

import '../../../../core/services/stt_service.dart';

/// Microphone button that records audio and sends it to the backend
/// for Sarvam STT transcription.
///
/// Used as a suffix icon in text fields across all feature screens.
class VoiceInputWidget extends StatefulWidget {
  final Function(String) onResult;

  const VoiceInputWidget({super.key, required this.onResult});

  @override
  State<VoiceInputWidget> createState() => _VoiceInputWidgetState();
}

class _VoiceInputWidgetState extends State<VoiceInputWidget> {
  final FlutterSoundRecorder _recorder = FlutterSoundRecorder();
  bool _isRecorderInitialised = false;
  bool _isRecording = false;
  bool _isProcessing = false;
  bool _isBusy = false; // Guard against rapid taps
  bool _isDisposed = false;
  String? _recordingPath;

  @override
  void initState() {
    super.initState();
    _initRecorder();
  }

  Future<void> _initRecorder() async {
    final status = await Permission.microphone.request();
    if (status != PermissionStatus.granted) {
      debugPrint('[VoiceInput] Microphone permission not granted');
      return;
    }
    await _recorder.openRecorder();
    if (!_isDisposed) {
      _isRecorderInitialised = true;
    }
  }

  @override
  void dispose() {
    _isDisposed = true;
    if (_isRecorderInitialised) {
      _recorder.closeRecorder().catchError((_) {});
    }
    super.dispose();
  }

  Future<void> _toggleRecording() async {
    if (!_isRecorderInitialised || _isProcessing || _isBusy || _isDisposed) {
      return;
    }

    // Re-check permission before every recording attempt.
    final permStatus = await Permission.microphone.status;
    if (!permStatus.isGranted) {
      _showError('Microphone permission denied. Please enable it in Settings.');
      return;
    }

    _isBusy = true;
    try {
      if (_isRecording) {
        // Stop recording → send to backend STT.
        final path = await _recorder.stopRecorder();
        if (_isDisposed) return;
        setState(() => _isRecording = false);

        if (path == null || path.isEmpty) {
          _showError('Recording failed. Please try again.');
          return;
        }

        // Validate file size — reject very short or very large recordings.
        final file = File(path);
        if (await file.exists()) {
          final bytes = await file.length();
          if (bytes < 4000) {
            _showError('Recording too short. Please speak for at least 1 second.');
            try { await file.delete(); } catch (_) {}
            return;
          }
          if (bytes > 25 * 1024 * 1024) {
            _showError('Recording too long. Please keep it under 5 minutes.');
            try { await file.delete(); } catch (_) {}
            return;
          }
        }

        await _transcribeAudio(path);
      } else {
        // Dismiss keyboard before recording so mic animation is visible.
        FocusScope.of(context).unfocus();

        // Start recording to a temp file.
        // Try OGG Opus first (Sarvam preferred), fall back to AAC if unsupported.
        final tempDir = await getTemporaryDirectory();

        try {
          _recordingPath = '${tempDir.path}/voice_input.opus';
          await _recorder.startRecorder(
            toFile: _recordingPath,
            codec: Codec.opusOGG,
          );
        } catch (_) {
          // OGG Opus not supported on this device — fall back to AAC.
          debugPrint('[VoiceInput] opusOGG unsupported, falling back to AAC');
          _recordingPath = '${tempDir.path}/voice_input.aac';
          await _recorder.startRecorder(
            toFile: _recordingPath,
            codec: Codec.aacADTS,
          );
        }
        if (!_isDisposed) {
          setState(() => _isRecording = true);
        }
      }
    } catch (e) {
      debugPrint('[VoiceInput] Toggle error: $e');
      if (!_isDisposed) {
        setState(() => _isRecording = false);
        _showError('Recording failed. Please try again.');
      }
    } finally {
      _isBusy = false;
    }
  }

  Future<void> _transcribeAudio(String filePath) async {
    if (_isDisposed) return;
    setState(() => _isProcessing = true);

    try {
      final result = await STTService.transcribe(filePath);

      if (!_isDisposed && result.text.isNotEmpty) {
        widget.onResult(result.text);
      } else if (!_isDisposed) {
        _showError('Could not understand the audio.', showRetry: true);
      }
    } catch (e) {
      debugPrint('[VoiceInput] Transcription error: $e');
      if (!_isDisposed) {
        _showError('Voice transcription failed.', showRetry: true);
      }
    } finally {
      if (!_isDisposed) {
        setState(() => _isProcessing = false);
      }
      // Clean up temp file.
      try {
        final file = File(filePath);
        if (await file.exists()) await file.delete();
      } catch (_) {}
    }
  }

  void _showError(String message, {bool showRetry = false}) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).hideCurrentSnackBar();
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(message),
        action: showRetry
            ? SnackBarAction(
                label: 'Retry',
                onPressed: _toggleRecording,
              )
            : null,
        duration: showRetry
            ? const Duration(seconds: 5)
            : const Duration(seconds: 3),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final Color bgColor;
    final IconData icon;

    if (_isProcessing) {
      bgColor = Colors.orange;
      icon = Icons.hourglass_top_rounded;
    } else if (_isRecording) {
      bgColor = Colors.redAccent;
      icon = Icons.stop;
    } else {
      bgColor = const Color(0xFF16A34A);
      icon = Icons.mic;
    }

    // Compact size for use as TextField suffixIcon.
    return SizedBox(
      width: 48,
      height: 48,
      child: GestureDetector(
        onTap: _toggleRecording,
        child: Container(
          padding: const EdgeInsets.all(10),
          decoration: BoxDecoration(
            color: bgColor,
            shape: BoxShape.circle,
            boxShadow: [
              BoxShadow(
                color: bgColor.withOpacity(0.4),
                blurRadius: 8,
                spreadRadius: 1,
              ),
            ],
          ),
          child: _isProcessing
              ? const SizedBox(
                  width: 24,
                  height: 24,
                  child: CircularProgressIndicator(
                    color: Colors.white,
                    strokeWidth: 2.5,
                  ),
                )
              : Icon(icon, color: Colors.white, size: 24),
        )
            .animate(target: _isRecording ? 1 : 0)
            .scale(
              begin: const Offset(1, 1),
              end: const Offset(1.15, 1.15),
              duration: 500.ms,
              curve: Curves.easeInOut,
            )
            .then(delay: 500.ms)
            .scale(
              begin: const Offset(1.15, 1.15),
              end: const Offset(1, 1),
              duration: 500.ms,
            ),
      ),
    );
  }
}
