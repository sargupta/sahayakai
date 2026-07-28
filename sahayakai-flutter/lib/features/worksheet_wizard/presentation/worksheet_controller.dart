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

/// Drives the "Save to Library" action independently of the generate state, so
/// saving a worksheet never disturbs the rendered result (mirrors
/// `ExamPaperSaveController`):
///   - `AsyncData(null)`         -> idle (not yet saved),
///   - `AsyncLoading`            -> saving,
///   - `AsyncData(contentId)`    -> saved (non-empty id),
///   - `AsyncError`              -> save failed (offer retry).
@riverpod
class WorksheetSaveController extends _$WorksheetSaveController {
  @override
  FutureOr<String?> build() => null;

  Future<void> save({
    required Worksheet worksheet,
    required String prompt,
    String? gradeLevel,
    String? language,
  }) async {
    state = const AsyncValue<String?>.loading();
    state = await AsyncValue.guard<String?>(
      () => ref.read(worksheetRepositoryProvider).save(
            worksheet: worksheet,
            prompt: prompt,
            gradeLevel: gradeLevel,
            language: language,
          ),
    );
  }

  /// Reset to idle (called when a fresh worksheet is generated).
  void reset() => state = const AsyncValue<String?>.data(null);
}
