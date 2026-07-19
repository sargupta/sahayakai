import 'package:flutter/material.dart';
import 'package:lucide_icons/lucide_icons.dart';

import '../../../../core/i18n/l10n_ext.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../shared/widgets/ai_text.dart';
import '../../../../shared/widgets/app_badge.dart';
import '../../domain/chat_message.dart';
import 'staffroom_avatar.dart';

/// One message in the Staff Room / group chat (SPEC §A3.2). Unlike the Pro Inbox
/// thread (a 1:1 exchange), this is a SHARED multi-author room, so every
/// non-own message carries an author header:
///
///   • **OWN** (`authorId == myUid`) → a saffron `primaryContainer` bubble with
///     full-ink [AiText], aligned **end**, NO author header.
///   • **OTHERS** → a white `surface` bubble aligned **start** WITH an author
///     header (a [StaffroomAvatar] + the author name in a saffron `overline` +
///     a timestamp).
///   • **AI PERSONA** (`isDemoPersona`, from the persona-pulse) → a distinct,
///     honestly-labelled bubble: a sparkles glyph + the persona name + a small
///     "AI teacher" [AppBadge]. It is a real bubble, but never posing as a real
///     teacher.
///
/// WCAG AA, computed vs the ACTUAL fill (never `#E0924D` routed as text):
///   • **own body** = `onSurface` on `primaryContainer` (saffron-100 light /
///     #3D2A15 dark) = **15.2:1** light / **12.4:1** dark. `primaryContainer` is
///     the lighter tint (not the `#E0924D` fill, only ~2.5:1 with dark ink); ink
///     reads cleanly on it.
///   • **own timestamp** = `onPrimaryContainer` (#8B330E light / #FFCE9E dark) =
///     **6.9:1** / **9.5:1**. The muted `onSurfaceVariant` is NOT used on the
///     saffron tint (only ~3.99:1 there).
///   • **others body** = `onSurface` on white `surface` = ~**16.7:1**.
///   • **others / persona name** = the saffron-text `overline` token (#AC4815
///     light / #EB9447 dark) on the white card = **5.7:1**.
///   • **others timestamp** = muted `onSurfaceVariant` on white = **4.70:1**
///     (muted only on a white card — this IS one).
///   • **persona "AI teacher" badge** = [AppBadge] accent = saffron-text on the
///     `primary@0.12` tint = **5.14:1**.
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
        child: Container(
          margin: const EdgeInsets.symmetric(vertical: AppSpacing.space1),
          padding: const EdgeInsets.symmetric(
            horizontal: AppSpacing.space4,
            vertical: AppSpacing.space3,
          ),
          decoration: BoxDecoration(
            color: _mine ? scheme.primaryContainer : scheme.surface,
            borderRadius: AppRadius.rCard,
            border: _mine ? null : Border.all(color: scheme.outline, width: 1),
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
              // Server / persona prose, rendered as-is (Indic matra-safe, never
              // re-translated — it is already in the author's language).
              AiText(message.text),
              if (_mine) ...[
                const SizedBox(height: AppSpacing.space1),
                _OwnMeta(message: message),
              ],
            ],
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
