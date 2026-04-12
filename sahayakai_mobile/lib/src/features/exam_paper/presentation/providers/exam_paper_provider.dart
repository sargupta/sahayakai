import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../data/exam_paper_repository.dart';
import '../../domain/exam_paper_models.dart';

// ─────────────────── State holders ───────────────────

final examPaperResultProvider = StateProvider<ExamPaperOutput?>((ref) => null);

final examPaperLoadingProvider = StateProvider<bool>((ref) => false);

final examPaperErrorProvider = StateProvider<String?>((ref) => null);

/// History of all locally stored papers (for My Library screen).
final examPaperHistoryProvider = FutureProvider.autoDispose
    <List<ExamPaperOutput>>((ref) async {
  final repo = ref.read(examPaperRepositoryProvider);
  return repo.getAllLocalPapers();
});

// ─────────────────── Controller ───────────────────

class ExamPaperNotifier extends StateNotifier<void> {
  final ExamPaperRepository _repo;
  final Ref _ref;

  ExamPaperNotifier(this._repo, this._ref) : super(null);

  Future<void> generate(ExamPaperInput input) async {
    _ref.read(examPaperLoadingProvider.notifier).state = true;
    _ref.read(examPaperErrorProvider.notifier).state = null;
    _ref.read(examPaperResultProvider.notifier).state = null;

    try {
      final output = await _repo.generateExamPaper(input);
      _ref.read(examPaperResultProvider.notifier).state = output;
    } catch (e) {
      _ref.read(examPaperErrorProvider.notifier).state =
          _friendlyError(e.toString());
    } finally {
      _ref.read(examPaperLoadingProvider.notifier).state = false;
    }
  }

  Future<String?> saveToLibrary(ExamPaperOutput output) {
    return _repo.saveToLibrary(output);
  }

  void clearResult() {
    _ref.read(examPaperResultProvider.notifier).state = null;
    _ref.read(examPaperErrorProvider.notifier).state = null;
  }

  String _friendlyError(String raw) {
    if (raw.contains('403')) {
      return 'This feature requires a plan upgrade.';
    }
    if (raw.contains('429')) {
      return 'Monthly limit reached. Please upgrade your plan.';
    }
    if (raw.contains('SocketException') ||
        raw.contains('network') ||
        raw.contains('Connection')) {
      return 'No internet connection. Showing your last saved paper.';
    }
    return 'Could not generate exam paper. Please try again.';
  }
}

final examPaperControllerProvider =
    StateNotifierProvider<ExamPaperNotifier, void>((ref) {
  return ExamPaperNotifier(
    ref.read(examPaperRepositoryProvider),
    ref,
  );
});
