// ---------------------------------------------------------------------------
// SPIKE ONLY — delete with the spike. Not a regression gate.
//
// The control half of the PDF Indic spike: Flutter renders the SAME eleven
// lines, from the SAME docs/flutter/spike/pdf_indic/samples.json, in the SAME
// bundled faces, at the same point sizes and the same page geometry as
// tool/spike/pdf_indic_spike.dart.
//
// It exists so that "the PDF is wrong" is a comparison rather than an
// assertion. Flutter shapes Indic text with HarfBuzz; the Dart `pdf` package
// does not shape at all. Putting the two renderings side by side is the only
// way a founder can judge the difference without taking my word for it.
//
// Regenerate:
//   flutter test test/golden/pdf_indic_spike_render_test.dart \
//     --tags golden --update-goldens
//
// Tagged `golden` so the normal ladder (`flutter test --exclude-tags golden`)
// skips it: like every other golden in this suite it is macOS-specific and
// would go red on ubuntu CI for reasons that say nothing about Indic text.
// ---------------------------------------------------------------------------
@Tags(['golden'])
library;

import 'dart:convert';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

/// Geometry mirrored from `tool/spike/pdf_indic_spike.dart`.
///
/// 820 x 1180 logical px at devicePixelRatio 2 gives 1640 x 2360 real pixels;
/// the PDF page is 820 x 1180 PostScript points rasterised at 144 dpi, which is
/// the same 1640 x 2360. Neither image is resampled to sit beside the other, so
/// a difference in the comparison strip is a difference in the rendering.
const double _pageWidth = 820;
const double _pageHeight = 1180;
const double _margin = 40;
const double _sampleFontSize = 22;
const double _labelFontSize = 10;

void main() {
  testWidgets('flutter reference render of the Indic spike lines', (
    tester,
  ) async {
    final samples = _loadSamples();
    expect(samples, hasLength(11), reason: 'one line per supported locale');

    tester.view
      ..physicalSize = const Size(_pageWidth * 2, _pageHeight * 2)
      ..devicePixelRatio = 2.0;
    addTearDown(tester.view.reset);

    await tester.pumpWidget(_SpikeSheet(samples: samples));
    await tester.pumpAndSettle();

    await expectLater(
      find.byType(_SpikeSheet),
      matchesGoldenFile(
        '../../docs/flutter/spike/pdf_indic/flutter_reference_render.png',
      ),
    );
  });
}

/// Reads the shared sample set. Deliberately not a Dart constant: if the two
/// renderers each held their own copy of the strings, a typo in one would look
/// exactly like a shaping bug in the other.
List<Map<String, dynamic>> _loadSamples() {
  final file = File('docs/flutter/spike/pdf_indic/samples.json');
  if (!file.existsSync()) {
    throw StateError(
      'missing ${file.path} — `flutter test` runs from the package root, so '
      'this path is relative to it.',
    );
  }
  final decoded = jsonDecode(file.readAsStringSync()) as Map<String, dynamic>;
  return (decoded['samples'] as List<dynamic>).cast<Map<String, dynamic>>();
}

/// A bare sheet, not an app screen: no theme, no scaffold, no localisation.
///
/// The app's own typography ramp is deliberately NOT used here. This page is
/// answering one question — does the glyph shaping survive the trip through a
/// PDF writer — and a font size the design system happens to prefer, or a
/// fallback chain that quietly substitutes a different face, would confound
/// that. Each line names its face explicitly, the same file the PDF embeds.
class _SpikeSheet extends StatelessWidget {
  const _SpikeSheet({required this.samples});

  final List<Map<String, dynamic>> samples;

  @override
  Widget build(BuildContext context) {
    return Directionality(
      textDirection: TextDirection.ltr,
      child: MediaQuery(
        data: const MediaQueryData(),
        child: ColoredBox(
          color: const Color(0xFFFFFFFF),
          child: SizedBox(
            width: _pageWidth,
            height: _pageHeight,
            child: Padding(
              padding: const EdgeInsets.all(_margin),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    'Flutter (HarfBuzz) — same lines, same faces',
                    style: TextStyle(
                      fontFamily: 'Inter',
                      fontSize: 16,
                      fontWeight: FontWeight.bold,
                      color: Color(0xFF000000),
                    ),
                  ),
                  const SizedBox(height: 4),
                  const Text(
                    'Control render for the PDF spike. Identical strings, '
                    'identical assets/fonts/ files.',
                    style: TextStyle(
                      fontFamily: 'Inter',
                      fontSize: _labelFontSize,
                      color: Color(0xFF616161),
                    ),
                  ),
                  const SizedBox(height: 18),
                  for (final sample in samples) _row(sample),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _row(Map<String, dynamic> sample) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            '${sample['code']}  ${sample['language']}  (${sample['script']})',
            style: const TextStyle(
              fontFamily: 'Inter',
              fontSize: _labelFontSize,
              color: Color(0xFF757575),
            ),
          ),
          const SizedBox(height: 2),
          Text(
            sample['text'] as String,
            style: TextStyle(
              fontFamily: sample['family'] as String,
              fontSize: _sampleFontSize,
              height: 1.45,
              color: const Color(0xFF000000),
            ),
          ),
        ],
      ),
    );
  }
}
