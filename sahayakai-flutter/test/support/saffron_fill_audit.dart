import 'package:flutter/rendering.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sahayakai/core/theme/app_colors.dart';

/// The labels the current frame paints on a solid `saffron-500` fill.
///
/// Design system, decided 26 Oct 2026: white text never sits on saffron-500
/// (3.77:1); a saffron fill that carries a label is `accent-fill`
/// (saffron-600, 5.28:1). saffron-500 stays for icon-only discs, the orb,
/// dots, bars and focus edges, so icon glyphs are not labels here.
///
/// Walks the render tree once, collecting every opaque saffron-500 fill
/// (a decorated or coloured box, or a Material's physical shape) and every text
/// paragraph, then reports each paragraph whose centre falls inside a fill.
/// Geometry rather than ancestry, because a fill is often a sibling painted
/// behind its label (a segmented control's sliding pill).
List<String> labelsOnSaffron500(WidgetTester tester) {
  final fills = <Rect>[];
  final labels = <(Rect, String)>[];

  Rect globalRect(RenderBox box) => MatrixUtils.transformRect(
    box.getTransformTo(null),
    Offset.zero & box.size,
  );

  bool isSaffron500(Color? c) =>
      c != null && c.toARGB32() == AppColors.saffron500.toARGB32();

  void visit(RenderObject node) {
    if (node is RenderBox && node.hasSize && node.attached) {
      Color? fill;
      if (node is RenderDecoratedBox) {
        final d = node.decoration;
        if (d is BoxDecoration && d.gradient == null) fill = d.color;
        if (d is ShapeDecoration && d.gradient == null) fill = d.color;
      } else if (node is RenderPhysicalShape) {
        fill = node.color;
      } else if (node is RenderPhysicalModel) {
        fill = node.color;
      } else if (node.runtimeType.toString() == '_RenderColoredBox') {
        // `Container(color:)` / `ColoredBox` paint through a private class.
        fill = (node as dynamic).color as Color;
      }
      if (isSaffron500(fill)) fills.add(globalRect(node));

      if (node is RenderParagraph) {
        final family = node.text.style?.fontFamily ?? '';
        final isIcon =
            family.contains('Lucide') ||
            family.contains('MaterialIcons') ||
            family.contains('CupertinoIcons');
        final text = node.text.toPlainText().trim();
        if (!isIcon && text.isNotEmpty) {
          labels.add((globalRect(node), text));
        }
      }
    }
    node.visitChildren(visit);
  }

  for (final view in tester.binding.renderViews) {
    visit(view);
  }

  return [
    for (final (rect, text) in labels)
      if (fills.any((f) => f.contains(rect.center))) text,
  ];
}
