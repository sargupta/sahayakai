import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sahayakai/core/network/api_exception.dart';
import 'package:sahayakai/features/parent_hotline/data/dto/outreach_dtos.dart';
import 'package:sahayakai/features/parent_hotline/data/parent_hotline_errors.dart';
import 'package:sahayakai/features/parent_hotline/data/parent_hotline_repository.dart';
import 'package:sahayakai/features/parent_hotline/domain/call_summary.dart';
import 'package:sahayakai/features/parent_hotline/domain/parent_outreach.dart';

import '../../support/fake_api_client.dart';

/// The Parent Hotline route contracts through the repository layer. Nothing
/// opens a socket — [FakeApiClient] stands in. Each error branch proves the
/// transport `ApiException` is translated into the branchable
/// `ParentHotlineException` the U-PH2 controller switches on (and that **401
/// auth stays an `ApiException`**, like every other repository).
void main() {
  // A representative outreach request (built the way U-PH3 will).
  CreateOutreachRequestDto request({
    OutreachReason reason = OutreachReason.consecutiveAbsences,
    DeliveryMethod delivery = DeliveryMethod.twilioCall,
    String parentLanguage = 'Kannada',
  }) => CreateOutreachRequestDto.build(
    classId: 'c1',
    className: 'Class 6A',
    studentId: 's1',
    studentName: 'Asha',
    parentLanguage: parentLanguage,
    reason: reason,
    generatedMessage: 'Namaste...',
    deliveryMethod: delivery,
  );

  // Builds the exact 429 the outreach route returns — structured body
  // `{ error, retryAfterSeconds }` + a `Retry-After` header — through the real
  // `ApiException.fromDio` mapper, so the test exercises the parsing end-to-end.
  ApiException dedup429({int retryAfterSeconds = 240}) {
    final ro = RequestOptions(path: '/api/attendance/outreach');
    return ApiException.fromDio(
      DioException(
        requestOptions: ro,
        type: DioExceptionType.badResponse,
        response: Response<dynamic>(
          requestOptions: ro,
          statusCode: 429,
          data: {
            'error': 'Recent outreach already exists for this student',
            'retryAfterSeconds': retryAfterSeconds,
          },
          headers: Headers.fromMap({
            'retry-after': ['$retryAfterSeconds'],
          }),
        ),
      ),
    );
  }

  const unauthorized = ApiException(
    ApiErrorKind.unauthorized,
    'Please sign in again.',
    statusCode: 401,
  );

  // A full call-summary body, shared by the GET tests.
  Map<String, dynamic> callSummaryBody({String status = 'completed'}) => {
    'callStatus': status,
    'callDurationSeconds': 132,
    'answeredBy': 'human',
    'turnCount': 4,
    'transcript': [
      {
        'role': 'agent',
        'text': 'Namaste.',
        'timestamp': '2026-07-18T10:00:00.000Z',
      },
      {
        'role': 'parent',
        'text': 'Haan ji.',
        'timestamp': '2026-07-18T10:00:12.000Z',
      },
    ],
    'callSummary': {
      'parentResponse': 'Grateful and engaged.',
      'actionItemsForTeacher': ['Share worksheets'],
      'parentSentiment': 'grateful',
      'callQuality': 'productive',
      'followUpNeeded': false,
    },
  };

  group('createOutreach — POST /api/attendance/outreach', () {
    test(
      'happy path returns the outreachId and posts the right body',
      () async {
        final client = FakeApiClient(postResponse: {'outreachId': 'o-123'});
        final id = await ParentHotlineRepository(
          client,
        ).createOutreach(request());

        expect(id, 'o-123');
        expect(client.posts.single.path, '/api/attendance/outreach');
        final body = client.posts.single.data as Map<String, dynamic>;
        expect(body['deliveryMethod'], 'twilio_call');
        expect(body['reason'], 'consecutive_absences');
        expect(body.containsKey('parentPhone'), isFalse); // F9-001
      },
    );

    test('an empty id in the 200 body is treated as malformed', () async {
      final client = FakeApiClient(postResponse: {'outreachId': ''});
      expect(
        () => ParentHotlineRepository(client).createOutreach(request()),
        throwsA(
          isA<ApiException>().having(
            (e) => e.kind,
            'kind',
            ApiErrorKind.badResponse,
          ),
        ),
      );
    });

    test('403 PREMIUM_REQUIRED → PremiumRequiredException', () async {
      final client = FakeApiClient(
        postError: const ApiException(
          ApiErrorKind.forbidden,
          'PREMIUM_REQUIRED',
          statusCode: 403,
          errorCode: 'PREMIUM_REQUIRED',
        ),
      );
      expect(
        () => ParentHotlineRepository(client).createOutreach(request()),
        throwsA(isA<PremiumRequiredException>()),
      );
    });

    test(
      'a non-premium 403 (ownership Forbidden) is NOT wrapped as premium',
      () async {
        final client = FakeApiClient(
          postError: const ApiException(
            ApiErrorKind.forbidden,
            'You do not have access to this.',
            statusCode: 403,
            errorCode: 'Forbidden',
          ),
        );
        expect(
          () => ParentHotlineRepository(client).createOutreach(request()),
          throwsA(
            isA<ApiException>().having((e) => e.statusCode, 'statusCode', 403),
          ),
        );
      },
    );

    test('422 no-phone → NoParentPhoneException', () async {
      final client = FakeApiClient(
        postError: const ApiException(
          ApiErrorKind.badResponse,
          'Student has no parent phone on record',
          statusCode: 422,
          errorCode: 'Student has no parent phone on record',
        ),
      );
      expect(
        () => ParentHotlineRepository(client).createOutreach(request()),
        throwsA(isA<NoParentPhoneException>()),
      );
    });

    test(
      '429 → OutreachDedupException with retryAfterSeconds parsed',
      () async {
        // Prove the ApiException parsed the structured 429 first...
        final parsed = dedup429(retryAfterSeconds: 240);
        expect(parsed.statusCode, 429);
        expect(parsed.kind, ApiErrorKind.rateLimited);
        expect(parsed.retryAfterSeconds, 240);

        // ...then that the repository surfaces it as the typed dedup error.
        final client = FakeApiClient(postError: parsed);
        await expectLater(
          () => ParentHotlineRepository(client).createOutreach(request()),
          throwsA(
            isA<OutreachDedupException>().having(
              (e) => e.retryAfterSeconds,
              'retryAfterSeconds',
              240,
            ),
          ),
        );
      },
    );

    test(
      '401 → stays an auth ApiException (not a ParentHotlineException)',
      () async {
        final client = FakeApiClient(postError: unauthorized);
        await expectLater(
          () => ParentHotlineRepository(client).createOutreach(request()),
          throwsA(isA<ApiException>().having((e) => e.isAuth, 'isAuth', true)),
        );
      },
    );
  });

  group('placeCall — POST /api/attendance/call', () {
    test('happy path returns the callSid and posts ONLY {outreachId, '
        'parentLanguage}', () async {
      final client = FakeApiClient(postResponse: {'callSid': 'CA-1'});
      final sid = await ParentHotlineRepository(
        client,
      ).placeCall(outreachId: 'o-123', parentLanguage: 'Kannada');

      expect(sid, 'CA-1');
      expect(client.posts.single.path, '/api/attendance/call');
      expect(client.posts.single.data, {
        'outreachId': 'o-123',
        'parentLanguage': 'Kannada',
      });
      expect(
        (client.posts.single.data as Map).containsKey('parentPhone'),
        isFalse,
      ); // F9-001
    });

    test(
      '422 unsupported-language → UnsupportedCallLanguageException(language)',
      () async {
        final client = FakeApiClient(
          postError: const ApiException(
            ApiErrorKind.badResponse,
            'Auto-call not supported for Odia. Use WhatsApp copy instead.',
            statusCode: 422,
          ),
        );
        await expectLater(
          () => ParentHotlineRepository(
            client,
          ).placeCall(outreachId: 'o-1', parentLanguage: 'Odia'),
          throwsA(
            isA<UnsupportedCallLanguageException>().having(
              (e) => e.language,
              'language',
              'Odia',
            ),
          ),
        );
      },
    );

    test(
      '422 no-valid-phone → NoParentPhoneException (disambiguated by msg)',
      () async {
        final client = FakeApiClient(
          postError: const ApiException(
            ApiErrorKind.badResponse,
            'Outreach record has no valid parent phone',
            statusCode: 422,
          ),
        );
        expect(
          () => ParentHotlineRepository(
            client,
          ).placeCall(outreachId: 'o-1', parentLanguage: 'Kannada'),
          throwsA(isA<NoParentPhoneException>()),
        );
      },
    );

    test('502 → CallPlacementFailedException', () async {
      final client = FakeApiClient(
        postError: const ApiException(
          ApiErrorKind.badResponse,
          'Failed to initiate call',
          statusCode: 502,
        ),
      );
      expect(
        () => ParentHotlineRepository(
          client,
        ).placeCall(outreachId: 'o-1', parentLanguage: 'Kannada'),
        throwsA(isA<CallPlacementFailedException>()),
      );
    });

    test('503 → TwilioNotConfiguredException', () async {
      final client = FakeApiClient(
        postError: const ApiException(
          ApiErrorKind.server,
          'Something went wrong on our side.',
          statusCode: 503,
          errorCode: 'Twilio not configured',
        ),
      );
      expect(
        () => ParentHotlineRepository(
          client,
        ).placeCall(outreachId: 'o-1', parentLanguage: 'Kannada'),
        throwsA(isA<TwilioNotConfiguredException>()),
      );
    });

    test('401 → stays an auth ApiException', () async {
      final client = FakeApiClient(postError: unauthorized);
      await expectLater(
        () => ParentHotlineRepository(
          client,
        ).placeCall(outreachId: 'o-1', parentLanguage: 'Kannada'),
        throwsA(isA<ApiException>().having((e) => e.isAuth, 'isAuth', true)),
      );
    });
  });

  group('pollSummary — GET /api/attendance/call-summary', () {
    test('decodes the call result and queries by outreachId', () async {
      final client = FakeApiClient(getResponse: callSummaryBody());
      final result = await ParentHotlineRepository(client).pollSummary('o-123');

      expect(client.gets.single.path, '/api/attendance/call-summary');
      expect(client.gets.single.query, {'outreachId': 'o-123'});
      expect(result.callStatus, CallStatus.completed);
      expect(result.turnCount, 4);
      expect(result.callSummary?.parentSentiment, ParentSentiment.grateful);
    });

    test('a 401 surfaces as the auth ApiException', () async {
      final client = FakeApiClient(error: unauthorized);
      expect(
        () => ParentHotlineRepository(client).pollSummary('o-1'),
        throwsA(same(unauthorized)),
      );
    });
  });

  group('latestForStudent — GET /api/attendance/outreach-latest', () {
    test('a resumable outreach decodes to LatestOutreach and queries by '
        'studentId', () async {
      final client = FakeApiClient(
        getResponse: {'outreachId': 'o-777', ...callSummaryBody()},
      );
      final latest = await ParentHotlineRepository(
        client,
      ).latestForStudent('s1');

      expect(client.gets.single.path, '/api/attendance/outreach-latest');
      expect(client.gets.single.query, {'studentId': 's1'});
      expect(latest, isNotNull);
      expect(latest!.outreachId, 'o-777');
      expect(latest.result.callStatus, CallStatus.completed);
    });

    test('{ outreachId: null } → null (nothing to resume)', () async {
      final client = FakeApiClient(getResponse: {'outreachId': null});
      expect(
        await ParentHotlineRepository(client).latestForStudent('s1'),
        isNull,
      );
    });

    test('a 401 surfaces as the auth ApiException', () async {
      final client = FakeApiClient(error: unauthorized);
      expect(
        () => ParentHotlineRepository(client).latestForStudent('s1'),
        throwsA(same(unauthorized)),
      );
    });
  });
}
