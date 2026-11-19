import 'package:flutter/foundation.dart';

/// A Daily Briefing post, read back into its stories.
///
/// The server writes the briefing body in a fixed shape
/// (`api/jobs/daily-briefing`): an opener line, then one blank-line-separated
/// block per story — `"<emoji> <headline>"`, an indented summary, and an
/// indented source line:
///
/// ```text
/// 🗓 Daily Briefing — Thu, 19 Nov
///
/// 🤖 Cambridge report: teachers should shape India's AI policy
///    A new report highlights …
///    ↪ Rediff · rediff.com
/// ```
///
/// Older briefings opened with 🗞 instead of 🗓. Anything else is not a
/// briefing, and the card shows it as an ordinary post.
@immutable
class DailyBriefing {
  const DailyBriefing({required this.opener, required this.headlines});

  /// The first line, e.g. "🗓 Daily Briefing — Thu, 19 Nov".
  final String opener;

  /// Each story's headline, in order, without its leading emoji.
  final List<String> headlines;
}

/// Reads [content] as a Daily Briefing, or null when it is not one (so the
/// caller renders the post as written). Never throws.
DailyBriefing? parseDailyBriefing(String content) {
  final blocks = content
      .split(RegExp(r'\n[ \t]*\n'))
      .map((block) => block.trim())
      .where((block) => block.isNotEmpty)
      .toList(growable: false);
  if (blocks.length < 2) return null;

  final opener = blocks.first.split('\n').first.trim();
  if (!opener.startsWith('🗓') && !opener.startsWith('🗞')) return null;

  // Strip the leading emoji (any run of non-letter, non-digit characters),
  // whatever script the headline itself is in.
  final lead = RegExp(r'^[^\p{L}\p{N}]+', unicode: true);
  final headlines = <String>[
    for (final block in blocks.skip(1))
      if (block.split('\n').first.replaceFirst(lead, '').trim()
          case final headline when headline.isNotEmpty)
        headline,
  ];
  if (headlines.isEmpty) return null;
  return DailyBriefing(opener: opener, headlines: headlines);
}
