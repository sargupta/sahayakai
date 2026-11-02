import 'dart:typed_data';
import 'dart:ui' as ui;

import 'package:flutter/painting.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/theme/app_theme.dart';
import '../../../shared/media/image_input.dart';

/// What the topic page says: the spoken topic, the class it is for, and a line
/// telling the worksheet model there is no textbook page behind it.
class TopicPageContent {
  const TopicPageContent({
    required this.topic,
    required this.details,
    required this.note,
    required this.titleStyle,
    required this.bodyStyle,
  });

  /// The topic, as the teacher said it ("Photosynthesis").
  final String topic;

  /// "Class 7 · Science", or empty when neither was named.
  final String details;

  /// "No textbook page was given…", in the teacher's language.
  final String note;

  /// The app's display and body styles (their families and Indic fallbacks);
  /// sizes and colours are set here.
  final TextStyle titleStyle;
  final TextStyle bodyStyle;
}

/// Draws a [TopicPageContent] into an image the worksheet endpoint accepts.
typedef TopicPageRenderer = Future<PickedImage> Function(TopicPageContent);

/// The renderer the Worksheet Wizard uses when VIDYA asks for a worksheet with
/// no textbook photo. A provider so tests can swap the canvas work for a fixed
/// image.
final topicPageRendererProvider = Provider<TopicPageRenderer>(
  (ref) => renderTopicPage,
);

/// The page's size in pixels (a portrait sheet, 3:4).
const double _pageWidth = 900;
const double _pageHeight = 1200;
const double _margin = 72;

/// Renders [content] as a plain printed page (a saffron rule, the topic large,
/// the class, then the note) and encodes it as a PNG data URI.
///
/// The worksheet endpoint builds from a page image and rejects a request with
/// none. When the teacher asks VIDYA for a worksheet by topic alone, this page
/// stands in for the textbook: it carries the topic in words the model reads,
/// and says plainly that there is no textbook page, so the worksheet is built
/// from the standard syllabus for that topic. The teacher sees this page on
/// the form and can swap in a real photo.
Future<PickedImage> renderTopicPage(TopicPageContent content) async {
  final recorder = ui.PictureRecorder();
  final canvas = Canvas(recorder);
  const page = Rect.fromLTWH(0, 0, _pageWidth, _pageHeight);
  canvas
    ..drawRect(page, Paint()..color = AppColors.surfaceCard)
    ..drawRect(
      const Rect.fromLTWH(0, 0, _pageWidth, 18),
      Paint()..color = AppColors.saffron500,
    );

  const width = _pageWidth - _margin * 2;
  var y = 150.0;
  for (final (text, style, gap) in [
    (
      content.topic,
      content.titleStyle.copyWith(
        fontSize: 68,
        height: 1.15,
        fontWeight: FontWeight.w700,
        color: AppColors.textStrong,
      ),
      36.0,
    ),
    if (content.details.isNotEmpty)
      (
        content.details,
        content.bodyStyle.copyWith(
          fontSize: 38,
          height: 1.3,
          color: AppColors.textBody,
        ),
        64.0,
      ),
    (
      content.note,
      content.bodyStyle.copyWith(
        fontSize: 32,
        height: 1.45,
        color: AppColors.textMuted,
      ),
      0.0,
    ),
  ]) {
    final painter = TextPainter(
      text: TextSpan(text: text, style: style),
      textDirection: TextDirection.ltr,
      maxLines: 6,
      ellipsis: '…',
    )..layout(maxWidth: width);
    painter.paint(canvas, Offset(_margin, y));
    y += painter.height + gap;
    painter.dispose();
  }

  final picture = recorder.endRecording();
  final image = await picture.toImage(_pageWidth.toInt(), _pageHeight.toInt());
  picture.dispose();
  final data = await image.toByteData(format: ui.ImageByteFormat.png);
  image.dispose();
  if (data == null) throw StateError('could not encode the topic page');
  return PickedImage.fromRaw(
    RawPickedImage(
      bytes: Uint8List.view(data.buffer),
      mimeType: 'image/png',
      name: 'topic.png',
    ),
  );
}
