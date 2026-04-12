import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:sahayakai_mobile/src/core/services/plan_gate_handler.dart';

void main() {
  group('PlanGateHandler', () {
    test('returns false for non-DioException', () {
      final handled = PlanGateHandler.handleApiError(
        _MockBuildContext(),
        Exception('random error'),
      );
      expect(handled, false);
    });

    test('returns false for DioException without response', () {
      final error = DioException(
        requestOptions: RequestOptions(path: ''),
        type: DioExceptionType.connectionTimeout,
      );
      final handled = PlanGateHandler.handleApiError(
        _MockBuildContext(),
        error,
      );
      expect(handled, false);
    });

    // 403 and 429 dialog tests require a real BuildContext from a widget test.
    // Testing the detection logic here; dialog rendering is tested in widget tests.

    testWidgets('shows upgrade dialog on 403', (tester) async {
      await tester.pumpWidget(MaterialApp(
        home: Builder(
          builder: (context) {
            // Trigger in next frame to have valid context.
            WidgetsBinding.instance.addPostFrameCallback((_) {
              final error = DioException(
                requestOptions: RequestOptions(path: ''),
                response: Response(
                  statusCode: 403,
                  data: {'requiredPlan': 'Pro', 'currentPlan': 'free'},
                  requestOptions: RequestOptions(path: ''),
                ),
                type: DioExceptionType.badResponse,
              );
              PlanGateHandler.handleApiError(context, error);
            });
            return const Scaffold(body: Text('Test'));
          },
        ),
      ));

      await tester.pumpAndSettle();

      expect(find.text('Upgrade Required'), findsOneWidget);
      expect(find.text('View Plans'), findsOneWidget);
    });

    testWidgets('shows limit dialog on 429', (tester) async {
      await tester.pumpWidget(MaterialApp(
        home: Builder(
          builder: (context) {
            WidgetsBinding.instance.addPostFrameCallback((_) {
              final error = DioException(
                requestOptions: RequestOptions(path: ''),
                response: Response(
                  statusCode: 429,
                  data: {'limit': 25, 'used': 25},
                  requestOptions: RequestOptions(path: ''),
                ),
                type: DioExceptionType.badResponse,
              );
              PlanGateHandler.handleApiError(context, error);
            });
            return const Scaffold(body: Text('Test'));
          },
        ),
      ));

      await tester.pumpAndSettle();

      expect(find.text('Limit Reached'), findsOneWidget);
      expect(find.textContaining('25 of 25'), findsOneWidget);
    });
  });
}

// Minimal mock for non-widget tests (won't render dialogs).
class _MockBuildContext extends Fake implements BuildContext {}
