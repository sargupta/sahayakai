import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';

import 'package:sahayakai_mobile/src/features/exam_paper/data/exam_paper_repository.dart';
import 'package:sahayakai_mobile/src/features/exam_paper/domain/exam_paper_models.dart';
import 'package:sahayakai_mobile/src/features/exam_paper/presentation/providers/exam_paper_provider.dart';
import '../helpers/mocks.dart';

class FakeExamPaperInput extends Fake implements ExamPaperInput {}

class FakeExamPaperOutput extends Fake implements ExamPaperOutput {
  @override
  Map<String, dynamic> toJson() => {'title': 'fake'};
}

void main() {
  late MockExamPaperRepository mockRepo;
  late ProviderContainer container;

  const testInput = ExamPaperInput(
    board: 'CBSE',
    gradeLevel: 'Grade 10',
    subject: 'Science',
  );

  final testOutput = ExamPaperOutput(
    title: 'CBSE Science Grade 10',
    board: 'CBSE',
    subject: 'Science',
    gradeLevel: 'Grade 10',
    duration: '3 hours',
    maxMarks: '80',
    generalInstructions: ['Read carefully'],
    sections: [],
  );

  setUpAll(() {
    registerFallbackValue(FakeExamPaperInput());
    registerFallbackValue(FakeExamPaperOutput());
  });

  setUp(() {
    mockRepo = MockExamPaperRepository();
    container = ProviderContainer(
      overrides: [
        examPaperRepositoryProvider.overrideWithValue(mockRepo),
      ],
    );
  });

  tearDown(() => container.dispose());

  group('ExamPaperNotifier.generate', () {
    test('sets result on success', () async {
      when(() => mockRepo.generateExamPaper(any()))
          .thenAnswer((_) async => testOutput);

      final ctrl = container.read(examPaperControllerProvider.notifier);
      await ctrl.generate(testInput);

      expect(container.read(examPaperResultProvider), isNotNull);
      expect(container.read(examPaperResultProvider)!.title,
          'CBSE Science Grade 10');
      expect(container.read(examPaperLoadingProvider), false);
      expect(container.read(examPaperErrorProvider), isNull);
    });

    test('sets loading true during generation and false after', () async {
      when(() => mockRepo.generateExamPaper(any())).thenAnswer((_) async {
        expect(container.read(examPaperLoadingProvider), true);
        return testOutput;
      });

      final ctrl = container.read(examPaperControllerProvider.notifier);
      await ctrl.generate(testInput);

      expect(container.read(examPaperLoadingProvider), false);
    });

    test('sets friendly error on 403', () async {
      when(() => mockRepo.generateExamPaper(any()))
          .thenThrow(Exception('HTTP 403 Forbidden'));

      final ctrl = container.read(examPaperControllerProvider.notifier);
      await ctrl.generate(testInput);

      expect(container.read(examPaperErrorProvider),
          'This feature requires a plan upgrade.');
      expect(container.read(examPaperResultProvider), isNull);
      expect(container.read(examPaperLoadingProvider), false);
    });

    test('sets friendly error on 429', () async {
      when(() => mockRepo.generateExamPaper(any()))
          .thenThrow(Exception('HTTP 429 Too Many Requests'));

      final ctrl = container.read(examPaperControllerProvider.notifier);
      await ctrl.generate(testInput);

      expect(container.read(examPaperErrorProvider),
          'Monthly limit reached. Please upgrade your plan.');
    });

    test('sets friendly error on SocketException', () async {
      when(() => mockRepo.generateExamPaper(any()))
          .thenThrow(Exception('SocketException: Connection refused'));

      final ctrl = container.read(examPaperControllerProvider.notifier);
      await ctrl.generate(testInput);

      expect(container.read(examPaperErrorProvider),
          'No internet connection. Showing your last saved paper.');
    });

    test('sets friendly error on network keyword', () async {
      when(() => mockRepo.generateExamPaper(any()))
          .thenThrow(Exception('network error'));

      final ctrl = container.read(examPaperControllerProvider.notifier);
      await ctrl.generate(testInput);

      expect(container.read(examPaperErrorProvider),
          'No internet connection. Showing your last saved paper.');
    });

    test('sets friendly error on Connection keyword', () async {
      when(() => mockRepo.generateExamPaper(any()))
          .thenThrow(Exception('Connection timed out'));

      final ctrl = container.read(examPaperControllerProvider.notifier);
      await ctrl.generate(testInput);

      expect(container.read(examPaperErrorProvider),
          'No internet connection. Showing your last saved paper.');
    });

    test('sets generic error for unknown errors', () async {
      when(() => mockRepo.generateExamPaper(any()))
          .thenThrow(Exception('Something random'));

      final ctrl = container.read(examPaperControllerProvider.notifier);
      await ctrl.generate(testInput);

      expect(container.read(examPaperErrorProvider),
          'Could not generate exam paper. Please try again.');
    });

    test('clears previous result and error before generating', () async {
      container.read(examPaperErrorProvider.notifier).state = 'old error';
      container.read(examPaperResultProvider.notifier).state = testOutput;

      when(() => mockRepo.generateExamPaper(any()))
          .thenAnswer((_) async {
        expect(container.read(examPaperErrorProvider), isNull);
        expect(container.read(examPaperResultProvider), isNull);
        return testOutput;
      });

      final ctrl = container.read(examPaperControllerProvider.notifier);
      await ctrl.generate(testInput);
    });
  });

  group('ExamPaperNotifier.clearResult', () {
    test('clears both result and error', () {
      container.read(examPaperResultProvider.notifier).state = testOutput;
      container.read(examPaperErrorProvider.notifier).state = 'some error';

      final ctrl = container.read(examPaperControllerProvider.notifier);
      ctrl.clearResult();

      expect(container.read(examPaperResultProvider), isNull);
      expect(container.read(examPaperErrorProvider), isNull);
    });
  });

  group('ExamPaperNotifier.saveToLibrary', () {
    test('delegates to repository', () async {
      when(() => mockRepo.saveToLibrary(any()))
          .thenAnswer((_) async => 'content-id-123');

      final ctrl = container.read(examPaperControllerProvider.notifier);
      final result = await ctrl.saveToLibrary(testOutput);

      expect(result, 'content-id-123');
      verify(() => mockRepo.saveToLibrary(testOutput)).called(1);
    });

    test('returns null when repository returns null', () async {
      when(() => mockRepo.saveToLibrary(any()))
          .thenAnswer((_) async => null);

      final ctrl = container.read(examPaperControllerProvider.notifier);
      final result = await ctrl.saveToLibrary(testOutput);

      expect(result, isNull);
    });
  });

  group('_friendlyError branch coverage', () {
    test('403 embedded in longer string is detected', () async {
      when(() => mockRepo.generateExamPaper(any()))
          .thenThrow(Exception('DioError: status code 403, detail: forbidden'));

      final ctrl = container.read(examPaperControllerProvider.notifier);
      await ctrl.generate(testInput);

      expect(container.read(examPaperErrorProvider),
          'This feature requires a plan upgrade.');
    });

    test('429 embedded in longer string is detected', () async {
      when(() => mockRepo.generateExamPaper(any()))
          .thenThrow(Exception('Rate limit 429 exceeded'));

      final ctrl = container.read(examPaperControllerProvider.notifier);
      await ctrl.generate(testInput);

      expect(container.read(examPaperErrorProvider),
          'Monthly limit reached. Please upgrade your plan.');
    });
  });
}
