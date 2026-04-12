import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../data/instant_answer_repository.dart';
import '../../domain/instant_answer_models.dart';

final instantAnswerLoadingProvider = StateProvider<bool>((ref) => false);

final instantAnswerResultProvider =
    StateProvider<InstantAnswerOutput?>((ref) => null);

final instantAnswerErrorProvider = StateProvider<String?>((ref) => null);

final instantAnswerControllerProvider =
    Provider<InstantAnswerController>((ref) {
  return InstantAnswerController(ref);
});

class InstantAnswerController {
  final Ref _ref;

  InstantAnswerController(this._ref);

  Future<void> getAnswer(InstantAnswerInput input) async {
    _ref.read(instantAnswerLoadingProvider.notifier).state = true;
    _ref.read(instantAnswerResultProvider.notifier).state = null;
    _ref.read(instantAnswerErrorProvider.notifier).state = null;

    try {
      final result =
          await _ref.read(instantAnswerRepositoryProvider).getAnswer(input);
      _ref.read(instantAnswerResultProvider.notifier).state = result;
    } on InstantAnswerException catch (e) {
      _ref.read(instantAnswerErrorProvider.notifier).state = e.message;
    } catch (e) {
      _ref.read(instantAnswerErrorProvider.notifier).state =
          'Failed to get answer. Please check your connection and try again.';
    } finally {
      _ref.read(instantAnswerLoadingProvider.notifier).state = false;
    }
  }

  void reset() {
    _ref.read(instantAnswerResultProvider.notifier).state = null;
    _ref.read(instantAnswerErrorProvider.notifier).state = null;
  }
}
