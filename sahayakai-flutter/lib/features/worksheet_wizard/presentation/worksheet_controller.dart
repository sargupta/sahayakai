import 'dart:async';

import 'package:riverpod_annotation/riverpod_annotation.dart';

import '../data/worksheet_repository.dart';
import '../domain/worksheet.dart';

part 'worksheet_controller.g.dart';

/// Drives the worksheet screen through `AsyncValue<Worksheet?>`:
///   - `AsyncData(null)`       -> empty / idle (initial),
///   - `AsyncLoading`          -> long-running skeleton (server maxDuration 120 s),
///   - `AsyncError`            -> typed `ApiException` the view maps to the right UI,
///   - `AsyncData(worksheet)`  -> the rendered worksheet.
@riverpod
class WorksheetController extends _$WorksheetController {
  @override
  FutureOr<Worksheet?> build() => null;

  Future<void> generate(WorksheetRequest request) async {
    state = const AsyncValue<Worksheet?>.loading();
    state = await AsyncValue.guard<Worksheet?>(
      () => ref.read(worksheetRepositoryProvider).generate(request),
    );
  }

  /// Return to the empty/idle state.
  void clear() => state = const AsyncValue<Worksheet?>.data(null);
}
