// ============================================================================
// FEATURE CONTRACT (per Quality DNA rule 2: contract before code)
// ----------------------------------------------------------------------------
// What: Bootstraps Firebase + AI Logic SDK and renders the Phase T home shell.
// Why:  Hybrid inference (Gemini Nano on-device + cloud fallback) requires
//       Firebase to initialise before any model is constructed. Centralising
//       the init here keeps the screens free of bootstrap concerns.
// Inputs:  none (env vars baked at build time per Cloud Run pattern)
// Outputs: a `MaterialApp` rooted at HomeScreen with three navigable agents.
// Failure: if Firebase init fails the app shows a recoverable error widget
//          rather than a white screen — offline-first apps must degrade.
// ============================================================================

import 'package:firebase_app_check/firebase_app_check.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:flutter/material.dart';

import 'screens/instant_answer_screen.dart';
import 'screens/vidya_classifier_screen.dart';
import 'screens/voice_to_text_screen.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // Firebase init guard — App Check runs Play Integrity on Android and
  // DeviceCheck on iOS. Debug provider used only in non-release builds.
  try {
    await Firebase.initializeApp();
    await FirebaseAppCheck.instance.activate(
      androidProvider: AndroidProvider.playIntegrity,
      appleProvider: AppleProvider.deviceCheck,
    );
  } catch (e) {
    runApp(_BootError(error: e.toString()));
    return;
  }

  runApp(const SahayakApp());
}

class SahayakApp extends StatelessWidget {
  const SahayakApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'SahayakAI',
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(seedColor: const Color(0xFFFF6B00)),
        useMaterial3: true,
      ),
      home: const HomeScreen(),
    );
  }
}

class HomeScreen extends StatelessWidget {
  const HomeScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('SahayakAI — Phase T'),
      ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          const Text(
            'Hybrid inference agents (on-device + cloud fallback)',
            style: TextStyle(fontWeight: FontWeight.w600),
          ),
          const SizedBox(height: 12),
          _Tile(
            label: 'Instant Answer',
            subtitle: 'Cached topics on-device, fresh facts in the cloud.',
            onTap: () => Navigator.of(context).push(
              MaterialPageRoute(
                builder: (_) => const InstantAnswerScreen(),
              ),
            ),
          ),
          _Tile(
            label: 'VIDYA classifier',
            subtitle: '11-way intent classifier — runs on-device.',
            onTap: () => Navigator.of(context).push(
              MaterialPageRoute(
                builder: (_) => const VidyaClassifierScreen(),
              ),
            ),
          ),
          _Tile(
            label: 'Voice to text',
            subtitle: 'Short utterances on-device, long ones cloud.',
            onTap: () => Navigator.of(context).push(
              MaterialPageRoute(
                builder: (_) => const VoiceToTextScreen(),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _Tile extends StatelessWidget {
  const _Tile({
    required this.label,
    required this.subtitle,
    required this.onTap,
  });

  final String label;
  final String subtitle;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: ListTile(
        title: Text(label),
        subtitle: Text(subtitle),
        trailing: const Icon(Icons.chevron_right),
        onTap: onTap,
      ),
    );
  }
}

class _BootError extends StatelessWidget {
  const _BootError({required this.error});
  final String error;
  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      home: Scaffold(
        body: Padding(
          padding: const EdgeInsets.all(24),
          child: Center(
            child: Text(
              'Firebase init failed.\n\n$error\n\n'
              'Run `flutterfire configure` to wire the project.',
            ),
          ),
        ),
      ),
    );
  }
}
