import 'dart:async';

import 'package:riverpod_annotation/riverpod_annotation.dart';

import '../data/parent_message_repository.dart';
import '../domain/parent_message.dart';

part 'parent_message_controller.g.dart';

/// Drives the Parent Message screen through `AsyncValue<ParentMessage?>`:
///   - `AsyncData(null)`      -> empty / idle (initial),
///   - `AsyncLoading`         -> generation skeleton,
///   - `AsyncError`           -> typed `ApiException` the view maps to the right
///                               UI (401 sign-in, 403 upgrade, 429 limit, 503
///                               busy, 400 missing-required...),
///   - `AsyncData(message)`   -> the drafted parent message.
@riverpod
class ParentMessageController extends _$ParentMessageController {
  @override
  FutureOr<ParentMessage?> build() => null;

  Future<void> draft(ParentMessageRequest request) async {
    state = const AsyncValue<ParentMessage?>.loading();
    state = await AsyncValue.guard<ParentMessage?>(
      () => ref.read(parentMessageRepositoryProvider).draft(request),
    );
  }

  /// Return to the empty/idle state.
  void clear() => state = const AsyncValue<ParentMessage?>.data(null);
}
