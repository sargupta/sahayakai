import 'package:flutter/foundation.dart';

/// A pure, dependency-free parser for the subset of Markdown the Instant
/// Answer flow actually emits: headings, paragraphs, bullet and numbered
/// lists, fenced code, thematic breaks, and inline bold / italic / code /
/// links.
///
/// WHY NOT A PACKAGE. `flutter_markdown` is discontinued, and every
/// third-party renderer styles through its own sheet — which would have to be
/// re-derived from `AppText` anyway to satisfy DESIGN_RUBRIC §3 (every
/// `TextStyle.height` >= 1.4, AI prose at 1.7, `applyHeightToFirstAscent` /
/// `applyHeightToLastDescent` so Indic matras and vowel signs never clip, and
/// the `kIndicFallback` font stack on every span). Parsing here and rendering
/// through the theme keeps one type system, adds no dependency, and makes the
/// parse directly unit-testable without pumping a widget.
///
/// The parser is deliberately lenient: the input is model-generated, so
/// anything it does not recognise degrades to plain text. It never throws.

/// One run of inline text with its emphasis flags.
@immutable
class MarkdownSpan {
  const MarkdownSpan(
    this.text, {
    this.bold = false,
    this.italic = false,
    this.code = false,
  });

  final String text;
  final bool bold;
  final bool italic;
  final bool code;

  @override
  bool operator ==(Object other) =>
      other is MarkdownSpan &&
      other.text == text &&
      other.bold == bold &&
      other.italic == italic &&
      other.code == code;

  @override
  int get hashCode => Object.hash(text, bold, italic, code);

  @override
  String toString() =>
      'MarkdownSpan("$text", bold: $bold, italic: $italic, code: $code)';
}

/// A block-level element. Sealed so the renderer's switch is exhaustive.
@immutable
sealed class MarkdownBlock {
  const MarkdownBlock();
}

/// `# Heading`. [level] is clamped to 1..3 — the model occasionally emits
/// `####+`, and four distinct heading sizes inside a card is noise.
class MarkdownHeading extends MarkdownBlock {
  const MarkdownHeading({required this.level, required this.spans});

  final int level;
  final List<MarkdownSpan> spans;
}

/// A run of prose.
class MarkdownParagraph extends MarkdownBlock {
  const MarkdownParagraph(this.spans);

  final List<MarkdownSpan> spans;
}

/// `- item` / `* item` / `+ item`.
class MarkdownBullet extends MarkdownBlock {
  const MarkdownBullet(this.spans);

  final List<MarkdownSpan> spans;
}

/// `1. item`. [number] is the model's own, so a list starting at 3 stays at 3.
class MarkdownNumbered extends MarkdownBlock {
  const MarkdownNumbered({required this.number, required this.spans});

  final int number;
  final List<MarkdownSpan> spans;
}

/// A fenced code block. Kept verbatim — never emphasis-parsed.
class MarkdownCodeBlock extends MarkdownBlock {
  const MarkdownCodeBlock(this.text);

  final String text;
}

/// `---` / `***` / `___`.
class MarkdownDivider extends MarkdownBlock {
  const MarkdownDivider();
}

final RegExp _headingRe = RegExp(r'^(#{1,6})\s+(.*)$');
final RegExp _dividerRe = RegExp(r'^\s*(?:-{3,}|\*{3,}|_{3,})\s*$');
final RegExp _bulletRe = RegExp(r'^\s{0,3}[-*+]\s+(.*)$');
final RegExp _numberedRe = RegExp(r'^\s{0,3}(\d{1,3})[.)]\s+(.*)$');
final RegExp _fenceRe = RegExp(r'^\s*```');

/// Inline emphasis, in precedence order. Code wins first so its contents stay
/// literal; bold before italic so `**x**` is not read as two italics.
final RegExp _inlineRe = RegExp(
  r'`([^`]+)`' // 1 code
  r'|\*\*([^*]+)\*\*' // 2 bold
  r'|__([^_]+)__' // 3 bold
  r'|\*([^*]+)\*' // 4 italic
  r'|_([^_]+)_' // 5 italic
  r'|\[([^\]]*)\]\([^)]*\)', // 6 link label (the URL is dropped: see below)
);

/// Parses [source] into renderable blocks. Returns an empty list for blank or
/// whitespace-only input, which the result view reads as "no answer".
List<MarkdownBlock> parseAnswerMarkdown(String source) {
  final blocks = <MarkdownBlock>[];
  final paragraph = <String>[];
  final fence = <String>[];
  var inFence = false;

  void flushParagraph() {
    if (paragraph.isEmpty) return;
    // Markdown soft-wrap: consecutive prose lines are one paragraph.
    final text = paragraph.join(' ').trim();
    paragraph.clear();
    if (text.isNotEmpty) blocks.add(MarkdownParagraph(parseInlineMarkdown(text)));
  }

  for (final rawLine in source.split('\n')) {
    final line = rawLine.trimRight();

    if (_fenceRe.hasMatch(line)) {
      if (inFence) {
        blocks.add(MarkdownCodeBlock(fence.join('\n')));
        fence.clear();
        inFence = false;
      } else {
        flushParagraph();
        inFence = true;
      }
      continue;
    }
    if (inFence) {
      fence.add(rawLine);
      continue;
    }

    if (line.trim().isEmpty) {
      flushParagraph();
      continue;
    }

    // A divider must be checked before the bullet rule, or `---` reads as an
    // empty bullet.
    if (_dividerRe.hasMatch(line)) {
      flushParagraph();
      blocks.add(const MarkdownDivider());
      continue;
    }

    final heading = _headingRe.firstMatch(line);
    if (heading != null) {
      flushParagraph();
      final level = heading.group(1)!.length.clamp(1, 3);
      blocks.add(
        MarkdownHeading(
          level: level,
          spans: parseInlineMarkdown(heading.group(2)!.trim()),
        ),
      );
      continue;
    }

    final numbered = _numberedRe.firstMatch(line);
    if (numbered != null) {
      flushParagraph();
      blocks.add(
        MarkdownNumbered(
          number: int.tryParse(numbered.group(1)!) ?? 1,
          spans: parseInlineMarkdown(numbered.group(2)!.trim()),
        ),
      );
      continue;
    }

    final bullet = _bulletRe.firstMatch(line);
    if (bullet != null) {
      flushParagraph();
      blocks.add(MarkdownBullet(parseInlineMarkdown(bullet.group(1)!.trim())));
      continue;
    }

    paragraph.add(line.trim());
  }

  flushParagraph();
  // An unterminated fence still has to render, not vanish.
  if (inFence && fence.isNotEmpty) blocks.add(MarkdownCodeBlock(fence.join('\n')));

  return List<MarkdownBlock>.unmodifiable(blocks);
}

/// Splits one line into emphasis runs. Unmatched markers stay as literal text
/// rather than swallowing the rest of the line.
///
/// Link URLs are dropped and only the label is kept: the answer is
/// model-generated, so an inline URL is unverified, and a tappable link buried
/// in prose is not a target a teacher can reliably hit anyway. The one link
/// this screen does honour is `videoSuggestionUrl`, which gets a real 48dp
/// card of its own.
List<MarkdownSpan> parseInlineMarkdown(String text) {
  if (text.isEmpty) return const <MarkdownSpan>[];

  final spans = <MarkdownSpan>[];
  var cursor = 0;

  void addPlain(String value) {
    if (value.isNotEmpty) spans.add(MarkdownSpan(value));
  }

  for (final match in _inlineRe.allMatches(text)) {
    addPlain(text.substring(cursor, match.start));
    cursor = match.end;

    if (match.group(1) != null) {
      spans.add(MarkdownSpan(match.group(1)!, code: true));
    } else if (match.group(2) != null) {
      spans.add(MarkdownSpan(match.group(2)!, bold: true));
    } else if (match.group(3) != null) {
      spans.add(MarkdownSpan(match.group(3)!, bold: true));
    } else if (match.group(4) != null) {
      spans.add(MarkdownSpan(match.group(4)!, italic: true));
    } else if (match.group(5) != null) {
      spans.add(MarkdownSpan(match.group(5)!, italic: true));
    } else if (match.group(6) != null) {
      addPlain(match.group(6)!);
    }
  }
  addPlain(text.substring(cursor));

  return List<MarkdownSpan>.unmodifiable(spans);
}
