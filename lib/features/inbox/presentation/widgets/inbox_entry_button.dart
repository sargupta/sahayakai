import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons/lucide_icons.dart';

import '../../../../core/i18n/l10n_ext.dart';
import '../../../../core/router/routes.dart';
import '../../../../core/theme/app_theme.dart';
import '../../data/messages_stream_provider.dart';

/// The Pro Inbox entry — a messages [IconButton] carrying a live unread badge,
/// hung in an app bar (the voice-home). Tapping opens [Routes.inbox].
///
/// The badge watches [unreadConversationsProvider] (the same `onSnapshot`-backed
/// `sum(unreadCount[me])` the app-shell tab badge will use); while Firebase is
/// gated the deferred transport streams `awaitingFirebase(0)`, so the badge is
/// hidden and only the plain messages glyph shows. The count is white
/// on a solid saffron pill (5.4:1), so it reads on the warm page wash.
///
/// This is the reachable entry for U-SI1; the full **Network** surface
/// (staffroom + inbox + notifications) as a nav tab is deferred to U-SI2.
class InboxEntryButton extends ConsumerWidget {
  const InboxEntryButton({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = context.l10n;
    final unread = ref
        .watch(unreadConversationsProvider)
        .maybeWhen(
          data: (snapshot) => snapshot.isReady ? snapshot.data : 0,
          orElse: () => 0,
        );

    final button = IconButton(
      icon: const Icon(LucideIcons.messageCircle),
      tooltip: l10n.inboxTitle,
      onPressed: () => context.push(Routes.inbox),
    );

    if (unread <= 0) return button;

    final count = unread > 99 ? '99+' : '$unread';
    return Stack(
      clipBehavior: Clip.none,
      children: [
        button,
        PositionedDirectional(
          top: 2,
          end: 0,
          // The badge is decorative over the button — let taps fall through to
          // the IconButton beneath it.
          child: IgnorePointer(
            child: Semantics(
              label: l10n.inboxUnreadLabel(unread),
              child: _UnreadDot(count: count),
            ),
          ),
        ),
      ],
    );
  }
}

/// The unread count: white on a solid saffron pill, ringed in the card colour
/// so it stands clear of the glyph and of the warm page wash behind it (white
/// on saffron-600 is 5.4:1). It sits on the icon's top-right corner instead of
/// over the bubble, so the number is never drawn on top of the outline.
class _UnreadDot extends StatelessWidget {
  const _UnreadDot({required this.count});

  final String count;

  @override
  Widget build(BuildContext context) {
    return Container(
      key: const ValueKey('inbox-unread-badge'),
      constraints: const BoxConstraints(minWidth: 20, minHeight: 20),
      padding: const EdgeInsets.symmetric(horizontal: 5),
      decoration: BoxDecoration(
        color: AppColors.accentFill,
        borderRadius: AppRadius.rPill,
        border: Border.all(color: AppColors.milk50, width: 2),
      ),
      alignment: Alignment.center,
      child: ExcludeSemantics(
        child: Text(
          count,
          style: Theme.of(context).textTheme.labelSmall?.copyWith(
            fontSize: 11,
            height: 1.1,
            fontWeight: FontWeight.w700,
            color: AppColors.textOnAccent,
          ),
        ),
      ),
    );
  }
}
