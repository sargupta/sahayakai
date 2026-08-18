import 'package:flutter/material.dart';
import 'package:lucide_icons/lucide_icons.dart';

import '../../../../core/i18n/l10n_ext.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../shared/widgets/ai_text.dart';
import '../../../../shared/widgets/app_badge.dart';
import '../../../../shared/widgets/glass_surface.dart';
import '../../domain/chat_message.dart';
import 'staffroom_avatar.dart';

/// One message in the Staff Room / group chat (SPEC §A3.2). Unlike the Pro Inbox
/// thread (a 1:1 exchange), this is a SHARED multi-author room, so every
/// non-own message carries an author header. All three variants render
/// through [GlassSurface.flat] (App-wide Glassmorphism Reskin, GL-4) — the
/// cheap NO-BLUR path, never real `BackdropFilter`: this bubble lives inside
/// a scrolling `ListView`, exactly the case GL-1's docs say must never get a
/// real blur pass.
///
///   • **OWN** (`authorId == myUid`, and never the demo persona — see `_mine`)
///     → the neutral flat-glass fill PLUS a translucent saffron
///     (`primaryContainer`) wash layered on top (see below), full-ink
///     [AiText], aligned **end**, NO author header.
///   • **OTHERS** → the bare neutral flat-glass fill (no wash), aligned
///     **start** WITH an author header (a [StaffroomAvatar] + the author name
///     in a saffron `overline` + a timestamp).
///   • **AI PERSONA** (`isDemoPersona`, from the persona-pulse) → the SAME
///     bare neutral flat-glass fill as "others" (it is never "mine" — see
///     `_mine`/`_persona` below — and visually it should read as an incoming
///     message, not a saffron-tinted one), but with a distinct,
///     honestly-labelled header: a sparkles glyph + the persona name + a
///     small "AI teacher" [AppBadge]. That badge is untouched by this reskin
///     (`app_badge.dart` is GL-3, out of scope here) and is the ENTIRE trust
///     cue for this variant — it must survive exactly as legible as before,
///     which it does: the badge paints on top of the bubble content, same as
///     pre-reskin, so its own glass treatment (already landed in GL-3) is
///     unaffected by the fill swap below. A real bubble, but never posing as
///     a real teacher.
///
/// GLASS TREATMENT — "own" vs "others"/"persona": `GlassSurface.flat`'s own
/// fill/border/sheen are deliberately NEUTRAL (the shared flat-glass family
/// `AppCard`/`AppSegmented` already use). The saffron identity that used to
/// live in a raw `BoxDecoration.color: primaryContainer` for "own" messages
/// is layered back on as a translucent `primaryContainer` wash (alpha 0.85)
/// painted UNDER the message content but ON TOP of the glass fill/sheen —
/// still real translucency, automatically clipped to the same squircle as
/// the fill/border by `GlassSurface`'s own `ClipPath`. Net effect: every
/// bubble is visibly the same glass MATERIAL (identical border ring, corner
/// shape, sheen); "own" keeps its own distinct saffron FILL on top of that
/// shared material — alignment + the author header's absence remain the
/// primary "this is mine" cues, the tint is the reinforcing one, matching the
/// pre-reskin relationship rather than flattening every bubble into sameness.
///
/// WCAG AA, computed vs the ACTUAL DOUBLE composite (the wash sits on top of
/// the already-composited glass fill, not a single layer — `Color.alphaBlend`
/// applied twice, same math `theme_contrast_test.dart` locks in the
/// `GL-4 mine-bubble wash` group):
///   • **own body** = `onSurface` on the primaryContainer-washed glass fill =
///     **15.5:1** light / **12.9:1** dark — clear of 4.5 with wide margin.
///   • **own timestamp** = `onPrimaryContainer` (#8B330E light / #FFCE9E
///     dark) on that same composite = **7.08:1** light / **9.82:1** dark —
///     also clear of 4.5. (An earlier pass on this doc comment mislabelled
///     these timestamp numbers as the BODY ratio, computed against the wrong
///     token — caught by the GL-4 design review and corrected here, with the
///     locked test below so it can't drift silently again.) The muted
///     `onSurfaceVariant` is still NOT used on it.
///   • **others/persona body** = `onSurface` on the neutral flat-glass fill —
///     the same composite `theme_contrast_test.dart` already asserts passes
///     AA, effectively unchanged from the old solid white `surface`
///     (~16.7:1) since the composite sits within ~2 RGB units of pure white.
///   • **others / persona name** = the saffron-text `overline` token (#AC4815
///     light / #EB9447 dark) on that near-white composite = still ~5.7:1.
///   • **others timestamp** = muted `onSurfaceVariant` on the near-white
///     composite = still ~4.70:1.
///   • **persona "AI teacher" badge** = [AppBadge] accent, unchanged by this
///     unit (GL-3) = saffron-text on the `primary@0.12` tint = **5.14:1**.
class ChatBubble extends StatelessWidget {
  const ChatBubble({super.key, required this.message, required this.myUid});

  final ChatMessage message;
  final String myUid;

  /// An AI persona message is never "mine", even if the demo reuses my uid.
  bool get _mine => message.authorId == myUid && !message.isDemoPersona;
  bool get _persona => message.isDemoPersona;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final width = MediaQuery.sizeOf(context).width;

    return Align(
      alignment: _mine ? Alignment.centerRight : Alignment.centerLeft,
      child: ConstrainedBox(
        constraints: BoxConstraints(maxWidth: width * 0.82),
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: AppSpacing.space1),
          child: GlassSurface.flat(
            radius: AppRadius.card,
            // padding: borderWidth, NOT zero — same fix `AppCard` needed: an
            // edge-flush opaque child (our "own" wash, or dense text) would
            // otherwise occlude the border ring's strongest point.
            padding: const EdgeInsets.all(AppGlass.borderWidth),
            child: Stack(
              children: [
                // "Own" saffron wash — see class doc. Auto-clipped to the
                // same squircle as the glass fill/border by GlassSurface's
                // own ClipPath, so no extra corner handling needed here.
                // Others/persona get the bare neutral fill — no wash.
                if (_mine)
                  Positioned.fill(
                    child: DecoratedBox(
                      decoration: BoxDecoration(
                        color:
                            scheme.primaryContainer.withValues(alpha: 0.85),
                      ),
                    ),
                  ),
                Padding(
                  padding: const EdgeInsets.symmetric(
                    horizontal: AppSpacing.space4,
                    vertical: AppSpacing.space3,
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      if (_persona)
                        _PersonaHeader(message: message)
                      else if (!_mine)
                        _AuthorHeader(message: message),
                      if (!_mine) const SizedBox(height: AppSpacing.space2),
                      // Server / persona prose, rendered as-is (Indic
                      // matra-safe, never re-translated — it is already in
                      // the author's language).
                      AiText(message.text),
                      if (_mine) ...[
                        const SizedBox(height: AppSpacing.space1),
                        _OwnMeta(message: message),
                      ],
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// The other-teacher header: avatar + name (saffron overline) + timestamp.
class _AuthorHeader extends StatelessWidget {
  const _AuthorHeader({required this.message});

  final ChatMessage message;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final extras = AppTextExtras.of(context);
    final timestamp = _clock(message.createdAt);

    return Row(
      crossAxisAlignment: CrossAxisAlignment.center,
      children: [
        StaffroomAvatar(
          name: message.authorName,
          photoUrl: message.authorPhotoURL,
          size: 36,
        ),
        const SizedBox(width: AppSpacing.space3),
        Flexible(
          child: Text(
            message.authorName.trim(),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: extras.overline,
          ),
        ),
        if (timestamp.isNotEmpty) ...[
          const SizedBox(width: AppSpacing.space2),
          Text(
            timestamp,
            // Muted is legal here: this is a white surface card (4.70:1).
            style: extras.dataMedium
                .copyWith(color: scheme.onSurfaceVariant, fontSize: 12),
          ),
        ],
      ],
    );
  }
}

/// The AI-persona header: a sparkles glyph (clearly synthetic, not a photo) + the
/// persona name + an honest "AI teacher" badge. Never impersonates a teacher.
class _PersonaHeader extends StatelessWidget {
  const _PersonaHeader({required this.message});

  final ChatMessage message;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final extras = AppTextExtras.of(context);
    final l10n = context.l10n;
    final name = message.authorName.trim();

    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // A saffron-tint well with a sparkles glyph — an honest AI mark, not the
        // initial/photo a real teacher's StaffroomAvatar would show.
        Container(
          width: 36,
          height: 36,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            gradient: LinearGradient(
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
              colors: [
                scheme.primary.withValues(alpha: 0.16),
                scheme.primary.withValues(alpha: 0.06),
              ],
            ),
          ),
          alignment: Alignment.center,
          child: Icon(
            LucideIcons.sparkles,
            size: AppIconSize.inline,
            color: scheme.primary,
          ),
        ),
        const SizedBox(width: AppSpacing.space3),
        // Name over the honest badge (a Column inside Expanded), so neither the
        // long persona name nor the "AI teacher" label crowds the row at
        // textScale 1.3 in a wide-script locale — the header can never overflow.
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              if (name.isNotEmpty) ...[
                Text(
                  name,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: extras.overline,
                ),
                const SizedBox(height: AppSpacing.space1),
              ],
              // The honest label — accent AppBadge (saffron-text on tint, 5.14:1).
              Align(
                alignment: Alignment.centerLeft,
                child: AppBadge(
                  label: l10n.staffroomChatAiBadge,
                  icon: LucideIcons.sparkles,
                  tone: AppBadgeTone.accent,
                  size: AppBadgeSize.small,
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

/// The own-bubble meta line: a compact timestamp in `onPrimaryContainer` (6.9:1
/// on the saffron tint — the muted token is not used here).
class _OwnMeta extends StatelessWidget {
  const _OwnMeta({required this.message});

  final ChatMessage message;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final extras = AppTextExtras.of(context);
    final timestamp = _clock(message.createdAt);
    if (timestamp.isEmpty) return const SizedBox.shrink();
    return Align(
      alignment: Alignment.centerRight,
      child: Text(
        timestamp,
        style: extras.dataMedium
            .copyWith(color: scheme.onPrimaryContainer, fontSize: 12),
      ),
    );
  }
}

/// A short local clock time (HH:MM) for an ISO timestamp; empty when the message
/// has no server timestamp yet (an in-flight optimistic send).
String _clock(String? iso) {
  if (iso == null || iso.isEmpty) return '';
  final at = DateTime.tryParse(iso);
  if (at == null) return '';
  final local = at.toLocal();
  final h = local.hour.toString().padLeft(2, '0');
  final m = local.minute.toString().padLeft(2, '0');
  return '$h:$m';
}
