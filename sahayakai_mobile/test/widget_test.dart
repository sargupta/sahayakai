import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sahayakai_mobile/main.dart';
import 'package:sahayakai_mobile/src/features/home/presentation/home_screen.dart';

void main() {
  testWidgets('App starts and displays home screen', (WidgetTester tester) async {
    // Build our app and trigger a frame.
    await tester.pumpWidget(const ProviderScope(child: SahayakApp()));

    // Verify that the HomeScreen is displayed.
    expect(find.byType(HomeScreen), findsOneWidget);
  });
}
