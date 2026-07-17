import 'package:flutter/material.dart';

import '../../../../core/theme/app_theme.dart';
import '../../domain/answer_markdown.dart';

/// Renders parsed Markdown blocks through the app theme.
///
/// Every text run is AI-authored prose, so all of it carries line-height 1.7
/// with the height applied to the first ascent and the last descent — Indic
/// top matras and bottom vowel signs are never cropped — and always soft-wraps
/// so a long compound word breaks instead of scrolling the page sideways.
/// See DESIGN_RUBRIC §3 / §8 / §12.4 / §12.11.
class AnswerMarkdownView extends StatelessWidget {
  const AnswerMarkdownView({super.key, required this.source});

  /// The model's raw Markdown. Parsed on build; the parse is pure and cheap,
  /// and lives in `domain/answer_markdown.dart` where it is unit-tested.
  final String source;

  @override
  Widget build(BuildContext context) {
    final items = parseAnswerMarkdown(source);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        for (var i = 0; i < items.length; i++) ...[
          if (i > 0) SizedBox(height: _gapBefore(items[i])),
          _BlockView(block: items[i]),
        ],
      ],
    );
  }

  /// Headings open a new idea, so they get the section gap; everything else
  /// sits on the internal card gap. Both are 4dp-grid members (§1).
  double _gapBefore(MarkdownBlock block) => switch (block) {
        MarkdownHeading() => AppSpacing.space6,
        MarkdownDivider() => AppSpacing.space6,
        MarkdownCodeBlock() => AppSpacing.space4,
        _ => AppSpacing.space3,
      };
}

class _BlockView extends StatelessWidget {
  const _BlockView({required this.block});

  final MarkdownBlock block;

  @override
  Widget build(BuildContext context) {
    return switch (block) {
      MarkdownHeading(:final level, :final spans) =>
        _Prose(spans: spans, style: _headingStyle(context, level)),
      MarkdownParagraph(:final spans) => _Prose(spans: spans),
      MarkdownBullet(:final spans) => _ListRow(marker: _BulletDot(), spans: spans),
      MarkdownNumbered(:final number, :final spans) =>
        _ListRow(marker: _NumberMarker(number: number), spans: spans),
      MarkdownCodeBlock(:final text) => _CodeBlock(text: text),
      MarkdownDivider() => const Divider(height: 1),
    };
  }

  TextStyle _headingStyle(BuildContext context, int level) {
    final text = Theme.of(context).textTheme;
    // Headings are the model's own text too, so they keep AI prose's 1.7 rather
    // than the tighter display heights: one rule, no clipped matras (§12.4).
    final base = switch (level) {
      1 => text.titleLarge,
      2 => text.titleMedium,
      _ => text.titleSmall,
    };
    return (base ?? text.titleMedium!).copyWith(height: 1.7, letterSpacing: 0);
  }
}

/// A styled run of inline spans. The single place AI prose type is decided.
class _Prose extends StatelessWidget {
  const _Prose({required this.spans, this.style});

  final List<MarkdownSpan> spans;
  final TextStyle? style;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final theme = Theme.of(context).textTheme;
    final base = (style ?? theme.bodyMedium!).copyWith(
      height: 1.7,
      color: style?.color ?? scheme.onSurface,
    );

    // The base sits on the root span so every child inherits the 1.7 height and
    // the Indic fallback stack, and each child only carries its own delta.
    return Text.rich(
      TextSpan(
        style: base,
        children: [
          for (final span in spans) _toSpan(context, span, base),
        ],
      ),
      softWrap: true,
      textHeightBehavior: const TextHeightBehavior(
        applyHeightToFirstAscent: true,
        applyHeightToLastDescent: true,
      ),
    );
  }

  InlineSpan _toSpan(BuildContext context, MarkdownSpan span, TextStyle base) {
    final scheme = Theme.of(context).colorScheme;

    // Inline code keeps the body family on a tinted chip rather than pulling in
    // a monospace family: DESIGN_RUBRIC §0 sanctions Outfit + Inter only, and a
    // third google_fonts family would also mean another runtime fetch.
    if (span.code) {
      return WidgetSpan(
        alignment: PlaceholderAlignment.middle,
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: AppSpacing.space1),
          decoration: BoxDecoration(
            color: scheme.surfaceContainerHigh,
            borderRadius: AppRadius.rSm,
          ),
          child: Text(
            span.text,
            style: base.copyWith(
              fontWeight: FontWeight.w600,
              color: scheme.onSurface,
            ),
          ),
        ),
      );
    }

    // Only the delta: the root span already carries the base.
    if (!span.bold && !span.italic) return TextSpan(text: span.text);
    return TextSpan(
      text: span.text,
      style: TextStyle(
        fontWeight: span.bold ? FontWeight.w700 : null,
        fontStyle: span.italic ? FontStyle.italic : null,
      ),
    );
  }
}

/// A list row: a fixed-width marker column plus the wrapping text, so a long
/// Indic item wraps under itself instead of overflowing (§12.11).
class _ListRow extends StatelessWidget {
  const _ListRow({required this.marker, required this.spans});

  final Widget marker;
  final List<MarkdownSpan> spans;

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        marker,
        const SizedBox(width: AppSpacing.space3),
        Expanded(child: _Prose(spans: spans)),
      ],
    );
  }
}

class _BulletDot extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final base = Theme.of(context).textTheme.bodyMedium!;
    // Sized off the real line box so the dot tracks the first line at any
    // textScale instead of drifting.
    final lineHeight = (base.fontSize ?? 14) * 1.7;
    return SizedBox(
      width: AppSpacing.space2,
      height: MediaQuery.textScalerOf(context).scale(lineHeight),
      child: Center(
        child: Container(
          width: 5,
          height: 5,
          decoration: BoxDecoration(
            color: scheme.primary,
            shape: BoxShape.circle,
          ),
        ),
      ),
    );
  }
}

class _NumberMarker extends StatelessWidget {
  const _NumberMarker({required this.number});

  final int number;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final base = Theme.of(context).textTheme.bodyMedium!;
    return ConstrainedBox(
      constraints: const BoxConstraints(minWidth: 20),
      child: Text(
        '$number.',
        textAlign: TextAlign.end,
        style: base.copyWith(
          height: 1.7,
          fontWeight: FontWeight.w700,
          color: scheme.primary,
        ),
        textHeightBehavior: const TextHeightBehavior(
          applyHeightToFirstAscent: true,
          applyHeightToLastDescent: true,
        ),
      ),
    );
  }
}

/// A fenced block. Scrolls inside its own box so a long line never scrolls the
/// page (§12.11) — code is the one kind of text that must not be re-wrapped.
class _CodeBlock extends StatelessWidget {
  const _CodeBlock({required this.text});

  final String text;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final base = Theme.of(context).textTheme.bodyMedium!;
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(AppSpacing.space3),
      decoration: BoxDecoration(
        color: scheme.surfaceContainerHigh,
        borderRadius: AppRadius.rMd,
        border: Border.all(color: scheme.outlineVariant),
      ),
      child: SingleChildScrollView(
        scrollDirection: Axis.horizontal,
        child: Text(
          text,
          style: base.copyWith(height: 1.7, fontWeight: FontWeight.w500),
          textHeightBehavior: const TextHeightBehavior(
            applyHeightToFirstAscent: true,
            applyHeightToLastDescent: true,
          ),
        ),
      ),
    );
  }
}
