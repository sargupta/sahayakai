import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons/lucide_icons.dart';

import '../../../core/i18n/gen/app_localizations.dart';
import '../../../core/i18n/l10n_ext.dart';
import '../../../core/i18n/locale_provider.dart';
import '../../../core/platform/share_service.dart';
import '../../../core/router/routes.dart';
import '../../../core/theme/app_theme.dart';
import '../../../shared/voice/tts_speaker.dart';
import '../../../shared/widgets/glass_surface.dart';
import '../domain/deliverable.dart';
import 'deliverables_controller.dart';

/// The one deliver tray (v3 screen 08) — every output, whatever tool made it,
/// lands in the same sheet: a green orb header, a grid of destinations, the
/// "nothing leaves the phone until you tap send" promise, and one Send. Opened
/// from the orb's green ready state (or a result's Deliver action).
///
/// Every tile does something real: the share destinations go through the OS
/// share sheet (where WhatsApp, print and save-as-PDF actually live), Save to
/// class runs the result's own save-to-library seam, Post to Community opens the
/// staffroom, and Read aloud speaks the text. Delivering clears the result from
/// the orb's ready count.
Future<void> showDeliverTray(BuildContext context, Deliverable deliverable) {
  return showModalBottomSheet<void>(
    context: context,
    backgroundColor: Colors.transparent,
    elevation: 0,
    isScrollControlled: true,
    builder: (_) => DeliverTray(deliverable: deliverable),
  );
}

class DeliverTray extends ConsumerWidget {
  const DeliverTray({super.key, required this.deliverable});

  final Deliverable deliverable;

  static final BorderRadius _sheetRadius = BorderRadius.only(
    topLeft: AppRadius.rHero.topLeft,
    topRight: AppRadius.rHero.topRight,
  );

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = context.l10n;
    final scheme = Theme.of(context).colorScheme;
    final text = Theme.of(context).textTheme;
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Padding(
      padding: EdgeInsets.only(bottom: MediaQuery.viewInsetsOf(context).bottom),
      child: DecoratedBox(
        decoration: BoxDecoration(
          borderRadius: _sheetRadius,
          boxShadow: isDark ? AppShadows.dKey : AppShadows.e4,
        ),
        child: GlassSurface(
          borderRadius: _sheetRadius,
          padding: EdgeInsets.zero,
          child: SafeArea(
            top: false,
            child: Padding(
              padding: const EdgeInsets.fromLTRB(
                AppSpacing.space4,
                AppSpacing.space3,
                AppSpacing.space4,
                AppSpacing.space4,
              ),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Center(
                    child: Container(
                      width: 36,
                      height: 4,
                      decoration: ShapeDecoration(
                        color: scheme.outlineVariant,
                        shape: const StadiumBorder(),
                      ),
                    ),
                  ),
                  const SizedBox(height: AppSpacing.space4),
                  _Header(deliverable: deliverable),
                  const SizedBox(height: AppSpacing.space4),
                  _grid(context, ref, l10n, scheme),
                  const SizedBox(height: AppSpacing.space3),
                  // The promise, in a saffron-tinted note.
                  Container(
                    padding: const EdgeInsets.all(AppSpacing.space3),
                    decoration: BoxDecoration(
                      color: scheme.primaryContainer.withValues(alpha: 0.5),
                      borderRadius: AppRadius.rMd,
                    ),
                    child: Row(
                      children: [
                        Icon(
                          LucideIcons.lock,
                          size: AppIconSize.inline,
                          color: scheme.onSurfaceVariant,
                        ),
                        const SizedBox(width: AppSpacing.space2),
                        Expanded(
                          child: Text(
                            l10n.deliverPrivacyNote,
                            style: text.bodySmall?.copyWith(
                              color: scheme.onSurfaceVariant,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: AppSpacing.space4),
                  FilledButton.icon(
                    onPressed: () => _run(
                      context,
                      ref,
                      () => ref
                          .read(shareServiceProvider)
                          .shareText(
                            deliverable.text,
                            subject: deliverable.shareSubject,
                          ),
                    ),
                    icon: const Icon(LucideIcons.send, size: AppIconSize.inline),
                    label: Text(l10n.deliverSend),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _grid(
    BuildContext context,
    WidgetRef ref,
    AppLocalizations l10n,
    ColorScheme scheme,
  ) {
    final tiles = <Widget>[
      _DeliverTile(
        icon: LucideIcons.messageCircle,
        label: l10n.deliverParentGroup,
        meta: l10n.deliverParentGroupMeta,
        highlight: true,
        onTap: () => _run(
          context,
          ref,
          () => ref
              .read(shareServiceProvider)
              .shareText(deliverable.text, subject: deliverable.shareSubject),
        ),
      ),
      _DeliverTile(
        icon: LucideIcons.printer,
        label: l10n.deliverPrint,
        meta: l10n.deliverPrintMeta,
        onTap: () => _run(
          context,
          ref,
          () => ref
              .read(shareServiceProvider)
              .shareText(deliverable.text, subject: deliverable.shareSubject),
        ),
      ),
      _DeliverTile(
        icon: LucideIcons.folderInput,
        label: l10n.deliverSaveToClass,
        meta: l10n.deliverSaveToClassMeta,
        enabled: deliverable.onSave != null,
        onTap: () => _run(context, ref, () async {
          await deliverable.onSave?.call();
        }),
      ),
      _DeliverTile(
        icon: LucideIcons.users,
        label: l10n.deliverPostCommunity,
        meta: l10n.deliverPostCommunityMeta,
        onTap: () {
          _clear(ref);
          final router = GoRouter.of(context);
          Navigator.of(context).pop();
          router.push(Routes.staffroom);
        },
      ),
      _DeliverTile(
        icon: LucideIcons.download,
        label: l10n.deliverDownloadPdf,
        meta: l10n.deliverDownloadPdfMeta,
        onTap: () => _run(
          context,
          ref,
          () => ref
              .read(shareServiceProvider)
              .shareText(deliverable.text, subject: deliverable.shareSubject),
        ),
      ),
      _DeliverTile(
        icon: LucideIcons.volume2,
        label: l10n.deliverReadAloud,
        meta: l10n.deliverReadAloudMeta,
        onTap: () => _run(context, ref, () async {
          final language =
              deliverable.language ?? ref.read(localeControllerProvider).code;
          await ref
              .read(ttsSpeakerProvider)
              .speak(deliverable.text, language: language);
        }),
      ),
    ];

    // Two columns, content-driven row heights (no fixed heights — Indic + 1.3).
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        for (var i = 0; i < tiles.length; i += 2) ...[
          if (i > 0) const SizedBox(height: AppSpacing.space2),
          // IntrinsicHeight bounds the row's height (to the taller tile) so the
          // stretch gives both tiles equal height instead of an unbounded one.
          IntrinsicHeight(
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Expanded(child: tiles[i]),
                const SizedBox(width: AppSpacing.space2),
                Expanded(
                  child: i + 1 < tiles.length
                      ? tiles[i + 1]
                      : const SizedBox.shrink(),
                ),
              ],
            ),
          ),
        ],
      ],
    );
  }

  /// Run a delivery action, then clear the result from the ready count and close
  /// the sheet. Navigator/notifier are captured before the await so nothing
  /// touches a defunct context after it.
  Future<void> _run(
    BuildContext context,
    WidgetRef ref,
    Future<void> Function() action,
  ) async {
    final navigator = Navigator.of(context);
    _clear(ref);
    await action();
    if (navigator.canPop()) navigator.pop();
  }

  void _clear(WidgetRef ref) =>
      ref.read(deliverablesControllerProvider.notifier).remove(deliverable.id);
}

class _Header extends StatelessWidget {
  const _Header({required this.deliverable});

  final Deliverable deliverable;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final scheme = Theme.of(context).colorScheme;
    final text = Theme.of(context).textTheme;
    return Row(
      children: [
        // The green "ready" orb, matching the overlay's ready state.
        Container(
          width: 36,
          height: 36,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            gradient: RadialGradient(
              center: const Alignment(-0.35, -0.4),
              radius: 0.95,
              colors: [
                Color.lerp(scheme.secondary, Colors.white, 0.6)!,
                scheme.secondary,
              ],
            ),
          ),
        ),
        const SizedBox(width: AppSpacing.space3),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(l10n.deliverTrayTitle, style: text.titleMedium),
              Text(
                deliverable.subtitle ?? deliverable.title,
                style: text.bodySmall?.copyWith(color: scheme.onSurfaceVariant),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
            ],
          ),
        ),
      ],
    );
  }
}

/// One destination tile: an icon, a label and a one-line meta. The highlighted
/// tile (the recommended destination) carries a green tint.
class _DeliverTile extends StatelessWidget {
  const _DeliverTile({
    required this.icon,
    required this.label,
    required this.meta,
    required this.onTap,
    this.highlight = false,
    this.enabled = true,
  });

  final IconData icon;
  final String label;
  final String meta;
  final VoidCallback onTap;
  final bool highlight;
  final bool enabled;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final text = Theme.of(context).textTheme;
    final bg = highlight
        ? scheme.secondaryContainer.withValues(alpha: 0.6)
        : scheme.surface;
    final border = highlight ? scheme.secondary : scheme.outline;
    return Opacity(
      opacity: enabled ? 1 : 0.4,
      child: Material(
        color: bg,
        borderRadius: AppRadius.rMd,
        child: InkWell(
          borderRadius: AppRadius.rMd,
          onTap: enabled ? onTap : null,
          child: Container(
            padding: const EdgeInsets.all(AppSpacing.space3),
            decoration: BoxDecoration(
              borderRadius: AppRadius.rMd,
              border: Border.all(color: border),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(icon, size: AppIconSize.inline, color: scheme.onSurface),
                const SizedBox(height: AppSpacing.space2),
                Text(label, style: text.labelLarge),
                const SizedBox(height: AppSpacing.space1),
                Text(
                  meta,
                  style: text.bodySmall?.copyWith(
                    color: scheme.onSurfaceVariant,
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
