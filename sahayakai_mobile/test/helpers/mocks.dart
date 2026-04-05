import 'package:dio/dio.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:mocktail/mocktail.dart';

import 'package:sahayakai_mobile/src/core/network/api_client.dart';
import 'package:sahayakai_mobile/src/features/attendance/data/attendance_repository.dart';
import 'package:sahayakai_mobile/src/features/attendance/data/parent_message_repository.dart';
import 'package:sahayakai_mobile/src/features/auth/data/auth_repository.dart';
import 'package:sahayakai_mobile/src/features/billing/data/billing_repository.dart';
import 'package:sahayakai_mobile/src/features/chat/data/chat_repository.dart';
import 'package:sahayakai_mobile/src/features/content/data/content_repository.dart';
import 'package:sahayakai_mobile/src/features/exam_paper/data/exam_paper_repository.dart';
import 'package:sahayakai_mobile/src/features/export/data/export_repository.dart';
import 'package:sahayakai_mobile/src/features/feedback/data/feedback_repository.dart';
import 'package:sahayakai_mobile/src/features/impact/data/teacher_health_repository.dart';
import 'package:sahayakai_mobile/src/features/lesson_plan/data/lesson_plan_repository.dart';
import 'package:sahayakai_mobile/src/features/organizations/data/org_repository.dart';
import 'package:sahayakai_mobile/src/features/performance/data/performance_repository.dart';
import 'package:sahayakai_mobile/src/features/quiz/data/quiz_repository.dart';
import 'package:sahayakai_mobile/src/features/rubric/data/rubric_repository.dart';
import 'package:sahayakai_mobile/src/features/sarkar/data/sarkar_repository.dart';
import 'package:sahayakai_mobile/src/features/tools/data/tool_repository.dart';
import 'package:sahayakai_mobile/src/features/training/data/training_repository.dart';
import 'package:sahayakai_mobile/src/features/usage/data/usage_repository.dart';
import 'package:sahayakai_mobile/src/features/user/data/user_repository.dart';
import 'package:sahayakai_mobile/src/features/video/data/video_repository.dart';
import 'package:sahayakai_mobile/src/features/vidya/data/vidya_repository.dart';
import 'package:sahayakai_mobile/src/features/virtual_field_trip/data/field_trip_repository.dart';
import 'package:sahayakai_mobile/src/features/visual_aid/data/visual_aid_repository.dart';
import 'package:sahayakai_mobile/src/features/worksheet/data/worksheet_repository.dart';

// ─── Mock Classes ────────────────────────────────────────────────────────────

class MockDio extends Mock implements Dio {}

class MockApiClient extends Mock implements ApiClient {}

class MockFirebaseAuth extends Mock implements FirebaseAuth {}

class MockUser extends Mock implements User {}

class MockUserCredential extends Mock implements UserCredential {}

// ─── Repository Mocks ───────────────────────────────────────────────────────

class MockAttendanceRepository extends Mock implements AttendanceRepository {}
class MockParentMessageRepository extends Mock implements ParentMessageRepository {}
class MockAuthRepository extends Mock implements AuthRepository {}
class MockBillingRepository extends Mock implements BillingRepository {}
class MockChatRepository extends Mock implements ChatRepository {}
class MockContentRepository extends Mock implements ContentRepository {}
class MockExamPaperRepository extends Mock implements ExamPaperRepository {}
class MockExportRepository extends Mock implements ExportRepository {}
class MockFeedbackRepository extends Mock implements FeedbackRepository {}
class MockTeacherHealthRepository extends Mock implements TeacherHealthRepository {}
class MockLessonPlanRepository extends Mock implements LessonPlanRepository {}
class MockOrgRepository extends Mock implements OrgRepository {}
class MockPerformanceRepository extends Mock implements PerformanceRepository {}
class MockQuizRepository extends Mock implements QuizRepository {}
class MockRubricRepository extends Mock implements RubricRepository {}
class MockSarkarRepository extends Mock implements SarkarRepository {}
class MockToolRepository extends Mock implements ToolRepository {}
class MockTrainingRepository extends Mock implements TrainingRepository {}
class MockUsageRepository extends Mock implements UsageRepository {}
class MockUserRepository extends Mock implements UserRepository {}
class MockVideoRepository extends Mock implements VideoRepository {}
class MockVidyaRepository extends Mock implements VidyaRepository {}
class MockFieldTripRepository extends Mock implements FieldTripRepository {}
class MockVisualAidRepository extends Mock implements VisualAidRepository {}
class MockWorksheetRepository extends Mock implements WorksheetRepository {}

// ─── Fake Classes (for registerFallbackValue) ────────────────────────────────

class FakeRequestOptions extends Fake implements RequestOptions {}

class FakeOptions extends Fake implements Options {}

class FakeFormData extends Fake implements FormData {}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/// Creates a mock Dio that returns [data] for any request.
MockDio createMockDio() {
  final mockDio = MockDio();

  // Register fallbacks for argument matchers.
  registerFallbackValue(FakeRequestOptions());
  registerFallbackValue(FakeOptions());
  registerFallbackValue(FakeFormData());
  registerFallbackValue(<String, dynamic>{});

  return mockDio;
}

/// Creates a successful Dio Response.
Response<T> successResponse<T>(T data, {int statusCode = 200}) {
  return Response<T>(
    data: data,
    statusCode: statusCode,
    requestOptions: RequestOptions(path: ''),
  );
}

/// Creates a Dio error response.
DioException dioError({
  int statusCode = 500,
  Map<String, dynamic>? data,
  DioExceptionType type = DioExceptionType.badResponse,
}) {
  return DioException(
    requestOptions: RequestOptions(path: ''),
    response: Response(
      statusCode: statusCode,
      data: data ?? {'error': 'Test error'},
      requestOptions: RequestOptions(path: ''),
    ),
    type: type,
  );
}

/// Creates a mock ApiClient backed by a MockDio.
/// Returns both so tests can stub the Dio and inject the ApiClient.
({MockDio dio, MockApiClient apiClient}) createMockApiClient() {
  final mockDio = createMockDio();
  final mockApiClient = MockApiClient();
  when(() => mockApiClient.client).thenReturn(mockDio);
  return (dio: mockDio, apiClient: mockApiClient);
}

/// Creates a ProviderContainer with the apiClientProvider overridden.
ProviderContainer createTestContainer({
  required MockApiClient apiClient,
  List<Override> overrides = const [],
}) {
  return ProviderContainer(
    overrides: [
      apiClientProvider.overrideWithValue(apiClient),
      ...overrides,
    ],
  );
}
