import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';

import 'package:sahayakai_mobile/src/features/organizations/data/org_repository.dart';
import '../helpers/mocks.dart';

void main() {
  late OrgRepository repo;
  late MockDio mockDio;

  setUp(() {
    final mocks = createMockApiClient();
    mockDio = mocks.dio;
    repo = OrgRepository(mocks.apiClient);
  });

  group('OrgRepository', () {
    test('getOrganization returns org with members', () async {
      when(() => mockDio.get('/organizations'))
          .thenAnswer((_) async => successResponse({
                'id': 'org-1',
                'name': 'Delhi Public School',
                'type': 'school',
                'plan': 'gold',
                'totalSeats': 50,
                'members': [
                  {
                    'uid': 'u1',
                    'displayName': 'Priya Sharma',
                    'role': 'admin',
                  },
                  {
                    'uid': 'u2',
                    'phoneNumber': '+919876543210',
                    'role': 'teacher',
                  },
                ],
              }));

      final org = await repo.getOrganization();
      expect(org, isNotNull);
      expect(org!.name, 'Delhi Public School');
      expect(org.members.length, 2);
      expect(org.members[0].displayName, 'Priya Sharma');
      expect(org.members[1].role, 'teacher');
    });

    test('getOrganization returns null on error', () async {
      when(() => mockDio.get('/organizations'))
          .thenAnswer((_) async => successResponse(null, statusCode: 404));

      final org = await repo.getOrganization();
      expect(org, isNull);
    });

    test('createOrganization sends correct data', () async {
      when(() => mockDio.post(
            '/organizations',
            data: any(named: 'data'),
          )).thenAnswer((_) async => successResponse({
            'id': 'new-org',
            'name': 'Test School',
            'type': 'school',
            'plan': 'gold',
            'totalSeats': 30,
            'members': [],
          }));

      final org = await repo.createOrganization(
        name: 'Test School',
        type: 'school',
        plan: 'gold',
        totalSeats: 30,
      );

      expect(org.id, 'new-org');
    });

    test('inviteTeacher sends phone number', () async {
      when(() => mockDio.post(
            '/organizations/invite',
            data: any(named: 'data'),
          )).thenAnswer((_) async => successResponse({'success': true}));

      await repo.inviteTeacher('+919876543210', 'teacher');

      verify(() => mockDio.post(
            '/organizations/invite',
            data: {'phoneNumber': '+919876543210', 'role': 'teacher'},
          )).called(1);
    });
  });
}
