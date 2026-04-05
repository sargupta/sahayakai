import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../core/providers/language_provider.dart';
import '../core/services/tts_service.dart';

/// A reusable play/stop button for text-to-speech.
///
/// Reads the current language from [languageProvider] and calls the
/// backend TTS endpoint (Sarvam Bulbul v3 → Google fallback).
///
/// Usage:
/// ```dart
/// TTSPlayButton(text: lessonPlan.objectives.join('. '))
/// ```
class TTSPlayButton extends ConsumerStatefulWidget {
  final String text;
  final double size;

  const TTSPlayButton({
    super.key,
    required this.text,
    this.size = 40,
  });

  @override
  ConsumerState<TTSPlayButton> createState() => _TTSPlayButtonState();
}

class _TTSPlayButtonState extends ConsumerState<TTSPlayButton> {
  bool _isPlaying = false;
  bool _isLoading = false;
  StreamSubscription<bool>? _playbackSub;

  @override
  void initState() {
    super.initState();
    // Listen to playback state changes via stream (no polling).
    _playbackSub = TTSService.instance.playbackState.listen((playing) {
      if (mounted) {
        setState(() => _isPlaying = playing);
      }
    });
  }

  @override
  void dispose() {
    _playbackSub?.cancel();
    super.dispose();
  }

  Future<void> _toggle() async {
    final tts = TTSService.instance;

    if (_isPlaying) {
      await tts.stop();
      return;
    }

    if (widget.text.trim().isEmpty) return;

    setState(() => _isLoading = true);

    try {
      final langName = ref.read(languageProvider);
      final langCode = getBcp47Code(langName) ?? 'en-IN'; // Default to English

      await tts.speak(widget.text, languageCode: langCode);
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Could not play audio')),
        );
      }
    } finally {
      if (mounted) {
        setState(() => _isLoading = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: widget.size,
      height: widget.size,
      child: _isLoading
          ? const Padding(
              padding: EdgeInsets.all(8),
              child: CircularProgressIndicator(strokeWidth: 2),
            )
          : IconButton(
              onPressed: _toggle,
              icon: Icon(
                _isPlaying
                    ? Icons.stop_circle_rounded
                    : Icons.volume_up_rounded,
                color: _isPlaying ? Colors.redAccent : Colors.deepOrange,
              ),
              iconSize: widget.size * 0.6,
              tooltip: _isPlaying ? 'Stop' : 'Listen',
            ),
    );
  }
}
