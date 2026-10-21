import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons/lucide_icons.dart';

import '../../../../core/i18n/l10n_ext.dart';
import '../../../../core/router/routes.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../shared/widgets/app_badge.dart';
import '../../data/messages_stream_provider.dart';

/// The Pro Inbox entry — a messages [IconButton] carrying a live unread badge,
/// hung in an app bar (the voice-home). Tapping opens [Routes.inbox].
///
/// The badge watches [unreadConversationsProvider] (the same `onSnapshot`-backed
/// `sum(unreadCount[me])` the app-shell tab badge will use); while Firebase is
/// gated the deferred transport streams `awaitingFirebase(0)`, so the badge is
/// hidden and only the plain messages glyph shows. It reuses the AA-fixed
/// [AppBadge.count] pill (saffron-text on the saffron tint, ~5.14:1).
///
/// This is the reachable entry for U-SI1; the full **Network** surface
/// (staffroom + inbox + notifications) as a nav tab is deferred to U-SI2.
class InboxEntryButton extends ConsumerWidget {
  const InboxEntryButton({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = context.l10n;
    final unread = ref.watch(unreadConversationsProvider).maybeWhen(
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
        Positioned(
          top: AppSpacing.space1,
          right: AppSpacing.space1,
          // The badge is decorative over the button — let taps fall through to
          // the IconButton beneath it.
          child: IgnorePointer(
            child: Semantics(
              label: l10n.inboxUnreadLabel(unread),
              child: AppBadge.count(count),
            ),
          ),
        ),
      ],
    );
  }
}
