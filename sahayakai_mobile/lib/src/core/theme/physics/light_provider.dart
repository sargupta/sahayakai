import 'dart:async';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'light_engine.dart';

/// Provides a time-ticked stream of LightConfig.
/// Updates every minute to ensure smooth transitions between phases.
final lightEngineProvider = StreamProvider<LightConfig>((ref) {
  // Emit initial state
  final controller = StreamController<LightConfig>();

  void update() {
    controller.add(LightConfig.fromTime(DateTime.now()));
  }

  update();

  // Tick every minute
  final timer = Timer.periodic(const Duration(minutes: 1), (_) => update());

  ref.onDispose(() {
    timer.cancel();
    controller.close();
  });

  return controller.stream;
});
