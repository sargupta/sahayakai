import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:mocktail/mocktail.dart';

import 'package:sahayakai_mobile/src/core/network/api_client.dart';
import 'package:sahayakai_mobile/src/features/user/presentation/screens/edit_profile_screen.dart';
import '../helpers/mocks.dart';
import '../helpers/test_utils.dart';

void main() {
  group('EditProfileScreen', () {
    testWidgets('renders all form fields', (tester) async {
      final mocks = createMockApiClient();
      await pumpTestApp(
        tester,
        const EditProfileScreen(),
        overrides: [
          apiClientProvider.overrideWithValue(mocks.apiClient),
        ],
      );

      expect(find.text('Edit Profile'), findsOneWidget);
      expect(find.text('YEARS OF EXPERIENCE'), findsOneWidget);
      expect(find.text('ADMINISTRATIVE ROLE'), findsOneWidget);
      expect(find.text('QUALIFICATIONS'), findsOneWidget);
      expect(find.text('Save Changes'), findsOneWidget);
    });

    testWidgets('shows qualification chips', (tester) async {
      final mocks = createMockApiClient();
      await pumpTestApp(
        tester,
        const EditProfileScreen(),
        overrides: [
          apiClientProvider.overrideWithValue(mocks.apiClient),
        ],
      );

      expect(find.text('B.Ed'), findsOneWidget);
      expect(find.text('M.Ed'), findsOneWidget);
      expect(find.text('Ph.D'), findsOneWidget);
      expect(find.text('CTET'), findsOneWidget);
    });

    testWidgets('qualification chip toggles on tap', (tester) async {
      final mocks = createMockApiClient();
      await pumpTestApp(
        tester,
        const EditProfileScreen(),
        overrides: [
          apiClientProvider.overrideWithValue(mocks.apiClient),
        ],
      );

      await tester.tap(find.text('B.Ed'));
      await tester.pump();

      // Second tap deselects
      await tester.tap(find.text('B.Ed'));
      await tester.pump();
    });
  });
}
