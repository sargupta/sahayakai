import 'package:flutter/material.dart';
import 'package:flutter_sound/flutter_sound.dart';
import 'package:permission_handler/permission_handler.dart';
import 'package:flutter_animate/flutter_animate.dart';

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

  @override
  void initState() {
    super.initState();
    _initRecorder();
  }

  Future<void> _initRecorder() async {
    final status = await Permission.microphone.request();
    if (status != PermissionStatus.granted) {
      throw RecordingPermissionException('Microphone permission not granted');
    }
    await _recorder.openRecorder();
    _isRecorderInitialised = true;
  }

  @override
  void dispose() {
    _recorder.closeRecorder();
    super.dispose();
  }

  Future<void> _toggleRecording() async {
    if (!_isRecorderInitialised) return;

    if (_isRecording) {
      await _recorder.stopRecorder();
      setState(() => _isRecording = false);
      // SIMULATION: In a real app, send the audio file to Google STT API here.
      // For this MVP, we simulate a successful transcription after a delay.
      _simulateTranscription();
    } else {
      await _recorder.startRecorder(toFile: 'audio_input.aac');
      setState(() => _isRecording = true);
    }
  }

  Future<void> _simulateTranscription() async {
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('Processing Audio...')),
    );
    await Future.delayed(const Duration(seconds: 2));
    widget.onResult("Photosynthesis in Plants");
    ScaffoldMessenger.of(context).hideCurrentSnackBar();
  }

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: _toggleRecording,
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: _isRecording ? Colors.redAccent : const Color(0xFF16A34A),
          shape: BoxShape.circle,
          boxShadow: [
            BoxShadow(
              color: (_isRecording ? Colors.redAccent : Colors.green).withOpacity(0.4),
              blurRadius: 10,
              spreadRadius: 2,
            )
          ],
        ),
        child: Icon(
          _isRecording ? Icons.stop : Icons.mic,
          color: Colors.white,
          size: 32,
        ),
      ).animate(target: _isRecording ? 1 : 0)
       .scale(begin: const Offset(1, 1), end: const Offset(1.2, 1.2), duration: 500.ms, curve: Curves.easeInOut)
       .then(delay: 500.ms)
       .scale(begin: const Offset(1.2, 1.2), end: const Offset(1, 1), duration: 500.ms), 
    );
  }
}
