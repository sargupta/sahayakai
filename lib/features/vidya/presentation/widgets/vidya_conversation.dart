import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons/lucide_icons.dart';

import '../../../../core/i18n/l10n_ext.dart';
import '../../../../core/theme/app_theme.dart';
import '../vidya_controller.dart';

/// The "End" pill that closes a VIDYA conversation: a white pill with a
/// hairline, a small square and the word, in a 48dp touch cell. Shown wherever
/// a conversation is visible (the sheet header, the "Mic on" capsule).
class VidyaEndButton extends ConsumerWidget {
  const VidyaEndButton({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final label = context.l10n.vidyaEndConversation;
    void end() => ref.read(vidyaControllerProvider.notifier).endConversation();
    return Semantics(
      button: true,
      label: label,
      excludeSemantics: true,
      onTap: end,
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: end,
        child: ConstrainedBox(
          constraints: const BoxConstraints(minHeight: 48),
          child: Center(
            widthFactor: 1,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
              decoration: const ShapeDecoration(
                color: Colors.white,
                shape: StadiumBorder(
                  side: BorderSide(color: AppColors.borderHairline),
                ),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Icon(
                    LucideIcons.square,
                    size: 12,
                    color: AppColors.danger,
                  ),
                  const SizedBox(width: 6),
                  Text(
                    label,
                    style: Theme.of(context).textTheme.labelMedium?.copyWith(
                      fontWeight: FontWeight.w700,
                      color: AppColors.textStrong,
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

/// "Mic on · End": what a conversation looks like once VIDYA's sheet has
/// closed (she opened a screen and is listening for the next command). A leaf
/// capsule saying the mic is open, with End beside it, so the teacher can
/// always see it and always stop it (design guide 02: no unseen listening).
/// Renders nothing while no conversation is on.
class VidyaMicOnCapsule extends ConsumerWidget {
  const VidyaMicOnCapsule({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final conversing = ref.watch(
      vidyaControllerProvider.select((s) => s.conversing),
    );
    if (!conversing) return const SizedBox.shrink();
    final status = ref.watch(vidyaControllerProvider.select((s) => s.status));
    final listening =
        status == VidyaStatus.listening ||
        status == VidyaStatus.requestingPermission;
    final l10n = context.l10n;

    return DecoratedBox(
      decoration: const BoxDecoration(
        color: AppColors.surfaceTabBar,
        borderRadius: AppRadius.rPill,
        boxShadow: [AppShadows.tabBar],
      ),
      child: Padding(
        padding: const EdgeInsetsDirectional.only(start: 12, end: 4),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 8,
              height: 8,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: listening ? AppColors.leaf500 : AppColors.textFaint,
              ),
            ),
            const SizedBox(width: 8),
            Text(
              listening ? l10n.vidyaMicOn : l10n.vidyaStateThinking,
              style: Theme.of(context).textTheme.labelMedium?.copyWith(
                fontWeight: FontWeight.w700,
                color: listening ? AppColors.leaf700 : AppColors.textBody,
              ),
            ),
            const SizedBox(width: 4),
            const VidyaEndButton(),
          ],
        ),
      ),
    );
  }
}
