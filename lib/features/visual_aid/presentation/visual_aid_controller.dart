import 'dart:async';

import 'package:riverpod_annotation/riverpod_annotation.dart';

import '../data/visual_aid_repository.dart';
import '../domain/visual_aid.dart';

part 'visual_aid_controller.g.dart';

/// Drives the Visual Aid screen through `AsyncValue<VisualAid?>`:
///   - `AsyncData(null)`   -> empty / idle (initial),
///   - `AsyncLoading`      -> image-shaped skeleton,
///   - `AsyncError`        -> typed `ApiException` the view maps to the right
///                            UI (401 signed-out, 403 upgrade, 429 daily/monthly
///                            limit, 422 empty generation, 504/5xx busy),
///   - `AsyncData(aid)`    -> the rendered drawing.
@riverpod
class VisualAidController extends _$VisualAidController {
  @override
  FutureOr<VisualAid?> build() => null;

  Future<void> generate(VisualAidRequest request) async {
    state = const AsyncValue<VisualAid?>.loading();
    state = await AsyncValue.guard<VisualAid?>(
      () => ref.read(visualAidRepositoryProvider).generate(request),
    );
  }

  /// Return to the empty/idle state.
  void clear() => state = const AsyncValue<VisualAid?>.data(null);
}
