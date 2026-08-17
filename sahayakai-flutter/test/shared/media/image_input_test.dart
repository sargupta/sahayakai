import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sahayakai/core/i18n/gen/app_localizations.dart';
import 'package:sahayakai/core/theme/app_theme.dart';
import 'package:sahayakai/shared/media/image_input.dart';

import 'image_input_fixtures.dart';

/// The shared camera/gallery image input — the seam the Worksheet Wizard and
/// (later) Assess Assignment both post through. Covers the encoding contract,
/// the size counter, the oversized-image reject, the permission-denied path,
/// and the overflow gates. No test opens a real camera: the pick source is a
/// [FakeImagePickerService] injected through the provider.

const Size _narrow = Size(360, 900);

void main() {
  group('PickedImage encoding + size (matches the server cap)', () {
    test('the cap constant matches WorksheetWizardInputSchema.max', () {
      // z.string().max(14_000_000) on the imageDataUri.
      expect(kMaxImageDataUriBytes, 14000000);
    });

    test('fromRaw builds a data URI and sizeBytes is the URI length', () {
      final picked = PickedImage.fromRaw(
        RawPickedImage(bytes: kTinyPng, mimeType: 'image/png', name: 'p.png'),
      );

      expect(picked.dataUri, startsWith('data:image/png;base64,'));
      // The counter measures the exact string the server measures.
      expect(picked.sizeBytes, picked.dataUri.length);
      expect(picked.isOverLimit, isFalse);
      expect(picked.mimeType, 'image/png');
      expect(picked.name, 'p.png');
    });

    test('isOverLimit trips exactly at the cap boundary', () {
      final atLimit = PickedImage(
        bytes: kTinyPng,
        dataUri: 'a' * kMaxImageDataUriBytes,
        mimeType: 'image/jpeg',
      );
      final overLimit = PickedImage(
        bytes: kTinyPng,
        dataUri: 'a' * (kMaxImageDataUriBytes + 1),
        mimeType: 'image/jpeg',
      );

      expect(atLimit.isOverLimit, isFalse);
      expect(overLimit.isOverLimit, isTrue);
    });
  });

  group('empty state', () {
    testWidgets('shows the prompt and both source buttons', (tester) async {
      await _pumpInput(tester, service: FakeImagePickerService());

      expect(
        find.text('Add a clear photo of the textbook page.'),
        findsOneWidget,
      );
      expect(find.text('Take photo'), findsOneWidget);
      expect(find.text('Choose from gallery'), findsOneWidget);
    });
  });

  group('picking', () {
    testWidgets('a camera pick reports a data-URI PickedImage upward', (
      tester,
    ) async {
      final service = FakeImagePickerService(result: tinyRaw());
      final host = await _pumpInput(tester, service: service);

      await tester.tap(find.text('Take photo'));
      await tester.pumpAndSettle();

      expect(service.calls, [ImageInputSource.camera]);
      expect(host.value, isNotNull);
      expect(host.value!.dataUri, startsWith('data:image/jpeg;base64,'));
      // The picked state renders the size counter + a Remove action.
      expect(find.textContaining('of 14 MB'), findsOneWidget);
      expect(find.text('Remove photo'), findsOneWidget);
    });

    testWidgets('a gallery pick uses the gallery source', (tester) async {
      final service = FakeImagePickerService(result: tinyRaw());
      await _pumpInput(tester, service: service);

      await tester.tap(find.text('Choose from gallery'));
      await tester.pumpAndSettle();

      expect(service.calls, [ImageInputSource.gallery]);
    });

    testWidgets('cancelling the picker leaves the value untouched', (
      tester,
    ) async {
      // result == null models the user backing out of the picker.
      final service = FakeImagePickerService(result: null);
      final host = await _pumpInput(tester, service: service);

      await tester.tap(find.text('Take photo'));
      await tester.pumpAndSettle();

      expect(service.calls, [ImageInputSource.camera]);
      expect(host.value, isNull);
      expect(find.text('Remove photo'), findsNothing);
    });

    testWidgets('Remove clears the picked image', (tester) async {
      final service = FakeImagePickerService(result: tinyRaw());
      final host = await _pumpInput(tester, service: service);

      await tester.tap(find.text('Take photo'));
      await tester.pumpAndSettle();
      expect(host.value, isNotNull);

      await tester.tap(find.text('Remove photo'));
      await tester.pumpAndSettle();

      expect(host.value, isNull);
      expect(
        find.text('Add a clear photo of the textbook page.'),
        findsOneWidget,
      );
    });
  });

  group('the size counter', () {
    testWidgets('reads the encoded size against the 14 MB cap', (tester) async {
      final service = FakeImagePickerService(result: tinyRaw());
      await _pumpInput(tester, service: service);

      await tester.tap(find.text('Take photo'));
      await tester.pumpAndSettle();

      // A 1x1 PNG encodes to well under 1 KB, so it reads in KB, of 14 MB.
      expect(find.textContaining('of 14 MB'), findsOneWidget);
      expect(find.byType(LinearProgressIndicator), findsOneWidget);
    });
  });

  group('oversized-image rejection', () {
    testWidgets('an image over the cap is rejected, not sent upward', (
      tester,
    ) async {
      final service = FakeImagePickerService(result: oversizedRaw());
      final host = await _pumpInput(tester, service: service);

      await tester.tap(find.text('Take photo'));
      await tester.pumpAndSettle();

      // The oversized picture never becomes the value...
      expect(host.value, isNull);
      // ...and the teacher is told why, with the cap named.
      expect(
        find.text('This photo is too large. Please choose one under 14 MB.'),
        findsOneWidget,
      );
      expect(tester.takeException(), isNull);
    });
  });

  group('permission denied', () {
    testWidgets('shows the permission message and reports nothing upward', (
      tester,
    ) async {
      final service = FakeImagePickerService(
        error: const ImageInputException(ImageInputErrorKind.permissionDenied),
      );
      final host = await _pumpInput(tester, service: service);

      await tester.tap(find.text('Take photo'));
      await tester.pumpAndSettle();

      expect(host.value, isNull);
      expect(find.textContaining('needs permission'), findsOneWidget);
      expect(tester.takeException(), isNull);
    });

    testWidgets('a platform failure shows the generic failure message', (
      tester,
    ) async {
      final service = FakeImagePickerService(
        error: const ImageInputException(ImageInputErrorKind.failed),
      );
      await _pumpInput(tester, service: service);

      await tester.tap(find.text('Choose from gallery'));
      await tester.pumpAndSettle();

      expect(
        find.text('We could not open that image. Please try again.'),
        findsOneWidget,
      );
    });
  });

  group('form-required error', () {
    testWidgets('surfaces the parent errorText when empty', (tester) async {
      await _pumpInput(
        tester,
        service: FakeImagePickerService(),
        errorText: 'Please add a photo of the textbook page.',
      );

      expect(
        find.text('Please add a photo of the textbook page.'),
        findsOneWidget,
      );
    });

    testWidgets('a pick-time error outranks the form errorText', (
      tester,
    ) async {
      await _pumpInput(
        tester,
        service: FakeImagePickerService(
          error: const ImageInputException(
            ImageInputErrorKind.permissionDenied,
          ),
        ),
        errorText: 'Please add a photo of the textbook page.',
      );

      await tester.tap(find.text('Take photo'));
      await tester.pumpAndSettle();

      expect(find.textContaining('needs permission'), findsOneWidget);
      expect(
        find.text('Please add a photo of the textbook page.'),
        findsNothing,
      );
    });
  });

  group('overflow gates (DESIGN_RUBRIC §12.9, §12.10, §12.13)', () {
    for (final brightness in Brightness.values) {
      for (final scale in <double>[1.0, 1.3]) {
        testWidgets('empty at 360dp, textScale $scale, ${brightness.name}', (
          tester,
        ) async {
          tester.view.physicalSize = _narrow;
          tester.view.devicePixelRatio = 1.0;
          addTearDown(tester.view.reset);

          await _pumpInput(
            tester,
            service: FakeImagePickerService(),
            brightness: brightness,
            textScale: scale,
          );

          expect(tester.takeException(), isNull);
          expect(find.text('Take photo'), findsOneWidget);
        });

        testWidgets('picked at 360dp, textScale $scale, ${brightness.name}', (
          tester,
        ) async {
          tester.view.physicalSize = _narrow;
          tester.view.devicePixelRatio = 1.0;
          addTearDown(tester.view.reset);

          await _pumpInput(
            tester,
            service: FakeImagePickerService(),
            brightness: brightness,
            textScale: scale,
            initialValue: tinyPicked(),
          );

          expect(tester.takeException(), isNull);
          expect(find.text('Remove photo'), findsOneWidget);
          expect(find.textContaining('of 14 MB'), findsOneWidget);
        });
      }
    }
  });
}

/// Hosts [ImageInput] as a controlled field, capturing the value the way the
/// real form does. Returns the host state so a test can read the last value.
Future<_HostState> _pumpInput(
  WidgetTester tester, {
  required ImagePickerService service,
  Brightness brightness = Brightness.light,
  double textScale = 1.0,
  String? errorText,
  PickedImage? initialValue,
}) async {
  await tester.pumpWidget(
    ProviderScope(
      overrides: [imagePickerServiceProvider.overrideWithValue(service)],
      child: MaterialApp(
        theme: brightness == Brightness.dark
            ? AppTheme.dark()
            : AppTheme.light(),
        locale: const Locale('en'),
        localizationsDelegates: AppLocalizations.localizationsDelegates,
        supportedLocales: AppLocalizations.supportedLocales,
        builder: (context, child) => MediaQuery(
          data: MediaQuery.of(
            context,
          ).copyWith(textScaler: TextScaler.linear(textScale)),
          child: child!,
        ),
        home: Scaffold(
          body: SingleChildScrollView(
            padding: AppSpacing.pagePadding,
            child: _Host(errorText: errorText, initial: initialValue),
          ),
        ),
      ),
    ),
  );
  await tester.pumpAndSettle();
  return tester.state<_HostState>(find.byType(_Host));
}

/// A controlled wrapper that owns the value, mirroring the real form's
/// FormField integration.
class _Host extends StatefulWidget {
  const _Host({this.errorText, this.initial});

  final String? errorText;
  final PickedImage? initial;

  @override
  State<_Host> createState() => _HostState();
}

class _HostState extends State<_Host> {
  PickedImage? value;

  @override
  void initState() {
    super.initState();
    value = widget.initial;
  }

  @override
  Widget build(BuildContext context) {
    return ImageInput(
      value: value,
      errorText: widget.errorText,
      onChanged: (picked) => setState(() => value = picked),
    );
  }
}
