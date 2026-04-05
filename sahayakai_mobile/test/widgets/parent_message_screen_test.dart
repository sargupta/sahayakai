import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:mocktail/mocktail.dart';

import 'package:sahayakai_mobile/src/core/network/api_client.dart';
import 'package:sahayakai_mobile/src/features/attendance/presentation/screens/parent_message_screen.dart';
import '../helpers/mocks.dart';
import '../helpers/test_utils.dart';

void main() {
  group('ParentMessageScreen', () {
    testWidgets('renders form fields', (tester) async {
      final mocks = createMockApiClient();
      await pumpTestApp(
        tester,
        const ParentMessageScreen(),
        overrides: [
          apiClientProvider.overrideWithValue(mocks.apiClient),
        ],
      );

      expect(find.text('Parent Message'), findsOneWidget);
      expect(find.text('STUDENT NAME (OPTIONAL)'), findsOneWidget);
      expect(find.text('CONTEXT'), findsOneWidget);
      expect(find.text('Generate Message'), findsOneWidget);
    });
  });
}
