import 'package:flutter/material.dart';
import 'package:lucide_icons/lucide_icons.dart';

import '../../../../core/i18n/l10n_ext.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../shared/widgets/ai_text.dart';
import '../../../../shared/widgets/app_badge.dart';
import '../../../../shared/widgets/app_card.dart';
import '../../domain/video_storyteller.dart';

/// One curated video, as a tappable card: a 16:9 thumbnail (with a play
/// affordance, an optional duration pill, and a NEVER-a-red-X fallback), the
/// title over at most two lines, the channel + duration meta, and — for
/// recognised official sources — an accent badge. Tapping anywhere on the card
/// opens the video via the injected [onOpen] seam (YouTube, outside the app).
///
/// The card is an [AppCard] with zero padding so the thumbnail runs to the
/// rounded edges; the text block below carries its own inset. The muted meta
/// (channel / duration) sits on the card's WHITE `surface` fill, where
/// `onSurfaceVariant` clears WCAG AA (4.70:1) — it must never move onto a
/// `surfaceContainer*` tint, where the same role drops below 4.5.
class VideoCard extends StatelessWidget {
  const VideoCard({super.key, required this.video, required this.onOpen});

  final Video video;

  /// Opens [Video.watchUrl] outside the app. Injected (not a raw `launchUrl`)
  /// so the widget test can fake it and never hit a platform channel / a real
  /// URL.
  final VoidCallback onOpen;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final text = Theme.of(context).textTheme;

    final title = video.title.isNotEmpty ? video.title : video.channelTitle;

    return Semantics(
      button: true,
      label: title,
      hint: l10n.videoStorytellerOpensExternally,
      child: AppCard(
        onTap: onOpen,
        padding: EdgeInsets.zero,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          mainAxisSize: MainAxisSize.min,
          children: [
            _Thumbnail(video: video),
            Padding(
              padding: const EdgeInsets.all(AppSpacing.space4),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    title,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: text.titleMedium,
                  ),
                  const SizedBox(height: AppSpacing.space2),
                  _MetaRow(video: video),
                  if (video.isOfficialSource) ...[
                    const SizedBox(height: AppSpacing.space3),
                    AppBadge(
                      icon: LucideIcons.badgeCheck,
                      label: l10n.videoStorytellerOfficialSource,
                      tone: AppBadgeTone.accent,
                      size: AppBadgeSize.small,
                    ),
                  ],
                  // Not emitted by the current endpoint (local ranking drops the
                  // reason), so this is normally absent — but when a build
                  // surfaces it, the prose renders matra-safe through AiText.
                  if (video.reason != null) ...[
                    const SizedBox(height: AppSpacing.space3),
                    AiText(video.reason!, muted: true),
                  ],
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// The channel name, then the duration when the server gave one — muted meta on
/// the card's white surface (AA-clear). The channel flexes and ellipsizes so a
/// long name never pushes the duration off the row.
class _MetaRow extends StatelessWidget {
  const _MetaRow({required this.video});

  final Video video;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final text = Theme.of(context).textTheme;
    final metaStyle =
        text.bodySmall?.copyWith(color: scheme.onSurfaceVariant);

    return Row(
      children: [
        Flexible(
          child: Text(
            video.channelTitle,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: metaStyle,
          ),
        ),
        if (video.duration != null) ...[
          const SizedBox(width: AppSpacing.space2),
          Text('·', style: metaStyle),
          const SizedBox(width: AppSpacing.space2),
          Text(video.duration!, style: metaStyle),
        ],
      ],
    );
  }
}

/// The 16:9 thumbnail. A neutral base fills the frame first, then the network
/// image paints over it; while it loads (or if it fails, or in a test with no
/// network) the base shows through a labelled fallback instead of a broken-image
/// red X. A play glyph sits centre in a scrim so it reads over any thumbnail,
/// and a duration pill (when present) anchors bottom-right.
class _Thumbnail extends StatelessWidget {
  const _Thumbnail({required this.video});

  final Video video;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;

    return AspectRatio(
      aspectRatio: 16 / 9,
      child: DecoratedBox(
        decoration: BoxDecoration(color: scheme.surfaceContainer),
        child: Stack(
          fit: StackFit.expand,
          children: [
            Image.network(
              video.thumbnailUrl,
              fit: BoxFit.cover,
              gaplessPlayback: true,
              excludeFromSemantics: true,
              loadingBuilder: (context, child, progress) =>
                  progress == null ? child : _ThumbFallback(video: video),
              errorBuilder: (context, error, stack) =>
                  _ThumbFallback(video: video),
            ),
            const Center(child: _PlayGlyph()),
            if (video.duration != null)
              Positioned(
                right: AppSpacing.space2,
                bottom: AppSpacing.space2,
                child: _DurationPill(duration: video.duration!),
              ),
          ],
        ),
      ),
    );
  }
}

/// The letterbox fallback when the thumbnail is still loading, failed, or — in a
/// widget test — cannot reach the network. A neutral video glyph over the
/// channel name (full ink, so it clears AA on the `surfaceContainer` fill the
/// same way the drawing-frame caption does), never a red error box.
class _ThumbFallback extends StatelessWidget {
  const _ThumbFallback({required this.video});

  final Video video;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final text = Theme.of(context).textTheme;
    return ColoredBox(
      color: scheme.surfaceContainer,
      child: Padding(
        padding: const EdgeInsets.all(AppSpacing.space4),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(
              LucideIcons.video,
              size: AppIconSize.standalone,
              color: scheme.onSurfaceVariant,
            ),
            if (video.channelTitle.isNotEmpty) ...[
              const SizedBox(height: AppSpacing.space2),
              Text(
                video.channelTitle,
                textAlign: TextAlign.center,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                // Full ink, not muted: this label IS the content of the failed
                // frame, so it must clear AA on the surfaceContainer fill where
                // onSurfaceVariant would fall below 4.5.
                style: text.labelMedium?.copyWith(color: scheme.onSurface),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

/// The centred play affordance: a white play triangle in a dark scrim circle, so
/// it stays legible over both bright and dark thumbnails. Non-text, so the scrim
/// only needs to carry the glyph, not meet the text ratio.
class _PlayGlyph extends StatelessWidget {
  const _PlayGlyph();

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 48,
      height: 48,
      decoration: BoxDecoration(
        color: Colors.black.withValues(alpha: 0.55),
        shape: BoxShape.circle,
      ),
      alignment: Alignment.center,
      child: const Icon(
        LucideIcons.play,
        size: AppIconSize.standalone,
        color: Colors.white,
      ),
    );
  }
}

/// The duration overlay: white text on a solid dark scrim pill, anchored over
/// the image. White on black@0.66 clears AA comfortably.
class _DurationPill extends StatelessWidget {
  const _DurationPill({required this.duration});

  final String duration;

  @override
  Widget build(BuildContext context) {
    final text = Theme.of(context).textTheme;
    return Container(
      padding: const EdgeInsets.symmetric(
        horizontal: AppSpacing.space2,
        vertical: AppSpacing.space1,
      ),
      decoration: ShapeDecoration(
        color: Colors.black.withValues(alpha: 0.66),
        shape: const StadiumBorder(),
      ),
      child: Text(
        duration,
        style: text.labelSmall?.copyWith(color: Colors.white),
      ),
    );
  }
}
