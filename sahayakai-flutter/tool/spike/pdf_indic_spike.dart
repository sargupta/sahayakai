// ---------------------------------------------------------------------------
// SPIKE ONLY — not app code, not imported by anything under lib/.
//
// Question this answers: if SahayakAI shipped "export worksheet as PDF" using
// the Dart `pdf` package, what would a Hindi / Tamil / Odia teacher actually
// receive?
//
// Run:
//   dart run tool/spike/pdf_indic_spike.dart
//
// Writes docs/flutter/spike/pdf_indic/pdf_package_render.pdf. Rasterise it and
// diff it against the Flutter reference render — see the FINDINGS.md in that
// directory for the full pipeline.
//
// Deliberately plain Dart, not a Flutter test: `pdf` is pure Dart, which is the
// whole reason it can sit in dev_dependencies rather than dependencies.
// ---------------------------------------------------------------------------

import 'dart:convert';
import 'dart:io';

import 'package:pdf/pdf.dart';
import 'package:pdf/widgets.dart' as pw;

/// Page geometry, in PostScript points.
///
/// Shared with the Flutter reference render, which uses the same numbers as
/// logical pixels at devicePixelRatio 2 while this page is rasterised at
/// 144 dpi (2x of 72). Both sides therefore land at 1640 x 2360 real pixels and
/// can be laid side by side without either being resampled.
const double kPageWidth = 820;
const double kPageHeight = 1180;
const double kMargin = 40;
const double kSampleFontSize = 22;
const double kLabelFontSize = 10;

Future<int> main() async {
  final root = Directory.current;
  final spikeDir = Directory('${root.path}/docs/flutter/spike/pdf_indic');
  final samplesFile = File('${spikeDir.path}/samples.json');

  if (!samplesFile.existsSync()) {
    stderr.writeln('missing ${samplesFile.path} — run from the package root');
    return 1;
  }

  final decoded = jsonDecode(await samplesFile.readAsString());
  final samples =
      ((decoded as Map<String, dynamic>)['samples'] as List<dynamic>)
          .cast<Map<String, dynamic>>();

  // Load one face per sample. A face that fails to parse is recorded rather
  // than thrown on: "the pdf package cannot even open our bundled variable
  // TTF" would itself be the answer to the spike, and swallowing it behind a
  // stack trace would lose which font failed.
  final fonts = <String, pw.Font>{};
  final fontErrors = <String, String>{};
  for (final sample in samples) {
    final filename = sample['font'] as String;
    if (fonts.containsKey(filename) || fontErrors.containsKey(filename)) {
      continue;
    }
    final file = File('${root.path}/assets/fonts/$filename');
    if (!file.existsSync()) {
      fontErrors[filename] = 'not found at ${file.path}';
      continue;
    }
    try {
      final bytes = await file.readAsBytes();
      fonts[filename] = pw.Font.ttf(bytes.buffer.asByteData());
    } on Exception catch (e) {
      fontErrors[filename] = '$e';
    }
  }

  final latin = fonts['Inter-Variable.ttf'];

  final doc = pw.Document();
  final rowErrors = <String, String>{};

  doc.addPage(
    pw.Page(
      pageFormat: const PdfPageFormat(
        kPageWidth,
        kPageHeight,
        marginAll: kMargin,
      ),
      build: (context) => pw.Column(
        crossAxisAlignment: pw.CrossAxisAlignment.start,
        children: [
          pw.Text(
            'Dart pdf package — Indic script rendering spike',
            style: pw.TextStyle(
              font: latin,
              fontSize: 16,
              fontWeight: pw.FontWeight.bold,
            ),
          ),
          pw.SizedBox(height: 4),
          pw.Text(
            'One line per supported script, rendered with the bundled '
            'assets/fonts/ faces. Nothing was fetched.',
            style: pw.TextStyle(
              font: latin,
              fontSize: kLabelFontSize,
              color: PdfColors.grey700,
            ),
          ),
          pw.SizedBox(height: 18),
          for (final sample in samples)
            _row(sample, fonts, fontErrors, latin, rowErrors),
        ],
      ),
    ),
  );

  final out = File('${spikeDir.path}/pdf_package_render.pdf');
  await out.writeAsBytes(await doc.save());

  final log = StringBuffer()
    ..writeln('wrote ${out.path} (${out.lengthSync()} bytes)')
    ..writeln('faces parsed OK: ${fonts.length}');
  if (fontErrors.isNotEmpty) {
    log.writeln('FACE PARSE FAILURES:');
    fontErrors.forEach((k, v) => log.writeln('  $k: $v'));
  }
  if (rowErrors.isNotEmpty) {
    log.writeln('ROW LAYOUT FAILURES:');
    rowErrors.forEach((k, v) => log.writeln('  $k: $v'));
  }
  stdout.write(log.toString());
  return 0;
}

/// One sample: a small Latin label, then the line in its own script.
///
/// The label is always Inter so that a script whose face failed to load still
/// shows *which* script the blank line belongs to.
pw.Widget _row(
  Map<String, dynamic> sample,
  Map<String, pw.Font> fonts,
  Map<String, String> fontErrors,
  pw.Font? latin,
  Map<String, String> rowErrors,
) {
  final code = sample['code'] as String;
  final filename = sample['font'] as String;
  final font = fonts[filename];
  final text = sample['text'] as String;

  pw.Widget body;
  if (font == null) {
    rowErrors[code] = 'face unavailable: ${fontErrors[filename]}';
    body = pw.Text(
      '[face failed to load: ${fontErrors[filename]}]',
      style: pw.TextStyle(font: latin, fontSize: 12, color: PdfColors.red),
    );
  } else {
    body = pw.Text(
      text,
      style: pw.TextStyle(font: font, fontSize: kSampleFontSize),
    );
  }

  return pw.Container(
    width: double.infinity,
    padding: const pw.EdgeInsets.only(bottom: 14),
    child: pw.Column(
      crossAxisAlignment: pw.CrossAxisAlignment.start,
      children: [
        pw.Text(
          '$code  ${sample['language']}  (${sample['script']})',
          style: pw.TextStyle(
            font: latin,
            fontSize: kLabelFontSize,
            color: PdfColors.grey600,
          ),
        ),
        pw.SizedBox(height: 2),
        body,
      ],
    ),
  );
}
