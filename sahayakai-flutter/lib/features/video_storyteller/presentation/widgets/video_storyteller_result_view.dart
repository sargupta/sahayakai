import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons/lucide_icons.dart';

import '../../../../core/i18n/gen/app_localizations.dart';
import '../../../../core/i18n/l10n_ext.dart';
import '../../../../core/platform/link_opener.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../shared/motion/animated_entrance.dart';
import '../../../../shared/widgets/empty_view.dart';
import '../../../../shared/widgets/note_banner.dart';
import '../../../../shared/widgets/section_label.dart';
import '../../domain/video_storyteller.dart';
import 'video_card.dart';

/// Renders a [VideoRecommendations] as a curated BROWSE result: the model's
/// supportive [VideoRecommendations.personalizedMessage] (a tinted note), then
/// each non-empty bucket as a labelled section of tappable [VideoCard]s, in the
/// canonical order the web app uses (Top recommended, Storytelling, Pedagogy,
/// Government updates, Teacher training).
///
/// This is not a generated document — there is no masthead or copy/regenerate
/// bar. Each section inks in on the reveal (reduce-motion degrades to a static
/// frame), and every card opens its video through the injected
/// [linkOpenerProvider] seam.
///
/// The per-section [_maxVideosPerCategory] cap keeps the eager scroll view
/// bounded: the endpoint ranks each bucket and can return up to 60, so the top
/// slice is the strongest browse without building hundreds of cards.
class VideoStorytellerResultView extends ConsumerWidget {
  const VideoStorytellerResultView({super.key, required this.recommendations});

  final VideoRecommendations recommendations;

  static const int _maxVideosPerCategory = 6;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = context.l10n;

    // Every bucket came back empty (a profile-less browse against a cold cache):
    // an empty state the teacher can act on, not a wall of bare headers.
    if (!recommendations.hasVideos) {
      return EmptyView(
        message: l10n.videoStorytellerNoResults,
        icon: LucideIcons.video,
      );
    }

    final opener = ref.read(linkOpenerProvider);

    final blocks = <Widget>[
      if (recommendations.personalizedMessage.isNotEmpty)
        NoteBanner(
          icon: LucideIcons.sparkles,
          body: recommendations.personalizedMessage,
        ),
      for (final section in recommendations.sections)
        _CategorySection(
          section: section,
          onOpen: (video) => opener.open(video.watchUrl),
        ),
    ];

    // Ink-settle: each block fades + rises in turn, so the browse assembles
    // itself. Degrades to the static composed frame under reduce-motion.
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      mainAxisSize: MainAxisSize.min,
      children: <Widget>[
        for (var i = 0; i < blocks.length; i++) ...[
          if (i > 0) const SizedBox(height: AppSpacing.sectionGap),
          inkSettle(context, blocks[i], index: i),
        ],
      ],
    );
  }
}

/// One bucket: its localized label + glyph, then its ranked video cards (capped).
class _CategorySection extends StatelessWidget {
  const _CategorySection({required this.section, required this.onOpen});

  final VideoCategorySection section;
  final void Function(Video video) onOpen;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final videos = section.videos
        .take(VideoStorytellerResultView._maxVideosPerCategory)
        .toList();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      mainAxisSize: MainAxisSize.min,
      children: <Widget>[
        SectionLabel(
          _categoryLabel(section.category, l10n),
          icon: _categoryIcon(section.category),
        ),
        for (var i = 0; i < videos.length; i++) ...[
          const SizedBox(height: AppSpacing.space4),
          VideoCard(video: videos[i], onOpen: () => onOpen(videos[i])),
        ],
      ],
    );
  }
}

/// The fixed glyph per bucket, mirroring the web category header icons.
IconData _categoryIcon(VideoCategory category) {
  switch (category) {
    case VideoCategory.topRecommended:
      return LucideIcons.star;
    case VideoCategory.storytelling:
      return LucideIcons.bookOpen;
    case VideoCategory.pedagogy:
      return LucideIcons.graduationCap;
    case VideoCategory.govtUpdates:
      return LucideIcons.bell;
    case VideoCategory.courses:
      return LucideIcons.school;
  }
}

/// The localized section label per bucket (resolved from the ARB, never
/// hardcoded English).
String _categoryLabel(VideoCategory category, AppLocalizations l10n) {
  switch (category) {
    case VideoCategory.topRecommended:
      return l10n.videoStorytellerCategoryTopRecommended;
    case VideoCategory.storytelling:
      return l10n.videoStorytellerCategoryStorytelling;
    case VideoCategory.pedagogy:
      return l10n.videoStorytellerCategoryPedagogy;
    case VideoCategory.govtUpdates:
      return l10n.videoStorytellerCategoryGovtUpdates;
    case VideoCategory.courses:
      return l10n.videoStorytellerCategoryCourses;
  }
}
