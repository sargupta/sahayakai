// ignore_for_file: prefer_const_constructors
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/i18n/gen/app_localizations.dart';
import '../../../core/i18n/l10n_ext.dart';
import '../../../core/i18n/locale_provider.dart';
import '../../../core/platform/share_service.dart';
import '../../../core/router/routes.dart';
import '../../../core/theme/app_theme.dart';
import '../../../shared/voice/tts_speaker.dart';
import '../domain/deliverable.dart';
import 'deliverables_controller.dart';
import 'vidya_sheet.dart';

/// The one deliver tray (v3 Screen 08) — every output, whatever tool made it,
/// lands in the same sheet: an opaque milk sheet with a green orb header, a
/// 2-col grid of icon-less destination tiles, the "nothing leaves the phone
/// until you tap send" promise, and one primary CTA: "Send to parent group".
/// Opened from the orb's green ready state (or a result's Deliver action).
///
/// Every tile does something real: the share destinations go through the OS
/// share sheet (WhatsApp, print, save-as-PDF), Save to class runs the
/// result's own save-to-library seam, Post to Community opens the staffroom,
/// and Read aloud speaks the text. Delivering clears the result from the
/// orb's ready count.
Future<void> showDeliverTray(BuildContext context, Deliverable deliverable) {
  final container = ProviderScope.containerOf(context, listen: false);
  container.read(vidyaSheetOpenProvider.notifier).state = true;
  // Guard: if `showModalBottomSheet` throws synchronously (e.g. the context
  // has no Navigator), reset the flag so the orb is never latched off behind a
  // tray that never appeared. Same failure mode as [showVidyaSheet].
  late final Future<void> tray;
  try {
    tray = showModalBottomSheet<void>(
      context: context,
      backgroundColor: Colors.transparent,
      elevation: 0,
      isScrollControlled: true,
      // v3 Screen 08: the page behind recedes under a light ink scrim.
      barrierColor: AppColors.ink900.withValues(alpha: 0.18),
      builder: (_) => DeliverTray(deliverable: deliverable),
    );
  } catch (_) {
    container.read(vidyaSheetOpenProvider.notifier).state = false;
    rethrow;
  }
  return tray.whenComplete(() {
    container.read(vidyaSheetOpenProvider.notifier).state = false;
  });
}

class DeliverTray extends ConsumerWidget {
  const DeliverTray({super.key, required this.deliverable});

  final Deliverable deliverable;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = context.l10n;
    final text = Theme.of(context).textTheme;

    // OPAQUE MILK SHEET (design): #FFFDF9 fill, 26px top radius,
    // 0 -14px 40px rgba(23,19,16,.18) lift — not glass.
    return Padding(
      padding: EdgeInsets.only(bottom: MediaQuery.viewInsetsOf(context).bottom),
      child: ConstrainedBox(
        constraints: BoxConstraints(
          maxHeight: MediaQuery.sizeOf(context).height * 0.72,
        ),
        child: DecoratedBox(
          decoration: const BoxDecoration(
            color: AppColors.milk50,
            borderRadius: AppRadius.rSheet,
            boxShadow: [AppShadows.sheet],
          ),
          child: SafeArea(
            top: false,
            child: Padding(
              padding: AppSpacing.sheetPadding, // 14 / 18 / 20 (design)
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  const _GrabHandle(),
                  const SizedBox(height: AppSpacing.space3),
                  _Header(deliverable: deliverable),
                  const SizedBox(height: AppSpacing.space3),
                  _grid(context, ref, l10n),
                  const SizedBox(height: AppSpacing.space3),
                  // Privacy promise — saffron-tinted note, no icon.
                  Container(
                    padding: const EdgeInsets.all(AppSpacing.space3),
                    decoration: BoxDecoration(
                      color: AppColors.saffron500.withValues(alpha: 0.08),
                      border: Border.all(
                        color: AppColors.saffron500.withValues(alpha: 0.20),
                      ),
                      borderRadius: AppRadius.rRow,
                    ),
                    child: Text(
                      l10n.deliverPrivacyNote,
                      style: text.bodySmall?.copyWith(
                        color: AppColors.textMuted,
                      ),
                    ),
                  ),
                  const SizedBox(height: AppSpacing.space3),
                  // Primary CTA: 50px pill, saffron500, 0 8 20 saffron@.34 lift.
                  DecoratedBox(
                    decoration: BoxDecoration(
                      borderRadius: BorderRadius.circular(9999),
                      boxShadow: [
                        BoxShadow(
                          color: AppColors.saffron500.withValues(alpha: 0.34), // rgba(201,106,40,.34)
                          offset: Offset(0, 8),
                          blurRadius: 20,
                        ),
                      ],
                    ),
                    child: FilledButton(
                      onPressed: () => _run(
                        context,
                        ref,
                        () => ref.read(shareServiceProvider).shareText(
                              deliverable.text,
                              subject: deliverable.shareSubject,
                            ),
                      ),
                      style: FilledButton.styleFrom(
                        backgroundColor: AppColors.accentFill,
                        foregroundColor: Colors.white,
                        minimumSize: const Size.fromHeight(50),
                        padding: EdgeInsets.zero,
                        elevation: 0,
                        shape: const RoundedRectangleBorder(
                          borderRadius: BorderRadius.all(Radius.circular(9999)),
                        ),
                      ),
                      child: Text(
                        l10n.deliverSendToParentGroup,
                        style: text.titleMedium?.copyWith(
                          fontSize: 14,
                          fontWeight: FontWeight.w600,
                          color: Colors.white,
                        ),
                      ),
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

  Widget _grid(
    BuildContext context,
    WidgetRef ref,
    AppLocalizations l10n,
  ) {
    final tiles = <Widget>[
      _DeliverTile(
        label: l10n.deliverParentGroup,
        meta: l10n.deliverParentGroupMeta,
        highlight: true,
        onTap: () => _run(
          context,
          ref,
          () => ref.read(shareServiceProvider).shareText(
                deliverable.text,
                subject: deliverable.shareSubject,
              ),
        ),
      ),
      _DeliverTile(
        label: l10n.deliverPrint,
        meta: l10n.deliverPrintMeta,
        onTap: () => _run(
          context,
          ref,
          () => ref.read(shareServiceProvider).shareText(
                deliverable.text,
                subject: deliverable.shareSubject,
              ),
        ),
      ),
      _DeliverTile(
        label: l10n.deliverSaveToClass,
        meta: l10n.deliverSaveToClassMeta,
        enabled: deliverable.onSave != null,
        onTap: () => _run(context, ref, () async {
          await deliverable.onSave?.call();
        }),
      ),
      _DeliverTile(
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
        label: l10n.deliverDownloadPdf,
        meta: l10n.deliverDownloadPdfMeta,
        onTap: () => _run(
          context,
          ref,
          () => ref.read(shareServiceProvider).shareText(
                deliverable.text,
                subject: deliverable.shareSubject,
              ),
        ),
      ),
      _DeliverTile(
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

    // Two columns, gap 8 (design), content-driven row heights (no fixed
    // heights — Indic scripts + 1.3 text scale).
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        for (var i = 0; i < tiles.length; i += 2) ...[
          if (i > 0) const SizedBox(height: AppSpacing.space2),
          // IntrinsicHeight bounds the row to the taller tile so the stretch
          // gives both tiles equal height instead of an unbounded one.
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

  /// Run a delivery action, then clear the result from the ready count and
  /// close the sheet. Navigator/notifier are captured before the await so
  /// nothing touches a defunct context after it.
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
    final text = Theme.of(context).textTheme;

    // 36px green "ready" orb: leaf100 → leaf500 radial highlight,
    // 0 5px 14px leaf500@.30 lift — the same green the overlay shows ready.
    final orb = Container(
      width: 36,
      height: 36,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        gradient: RadialGradient(
          center: Alignment(-0.34, -0.4),
          radius: 0.95,
          colors: [AppColors.leaf100, AppColors.leaf500],
          stops: [0.0, 0.74],
        ),
        boxShadow: [
          BoxShadow(
            color: AppColors.leaf500.withValues(alpha: 0.3), // leaf500 @ .30
            offset: Offset(0, 5),
            blurRadius: 14,
          ),
        ],
      ),
    );

    return Row(
      children: [
        orb,
        const SizedBox(width: AppSpacing.space3 - 1), // design's 11px
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              // "Deliver" — 13px/600 Bricolage.
              Text(l10n.deliverTrayTitle, style: text.titleMedium),
              const SizedBox(height: 1),
              // Subtitle 11px, muted ink.
              Text(
                deliverable.subtitle ?? deliverable.title,
                style: text.bodySmall?.copyWith(color: AppColors.textMuted),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
            ],
          ),
        ),
        const SizedBox(width: AppSpacing.space2),
        // "Preview" badge: saffron600 on saffron@.12, pill.
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
          decoration: BoxDecoration(
            color: AppColors.saffron500.withValues(alpha: 0.12),
            borderRadius: BorderRadius.circular(9999),
          ),
          child: Text(
            l10n.deliverPreview,
            style: text.labelSmall?.copyWith(
              fontWeight: FontWeight.w600,
              color: AppColors.saffron600,
            ),
          ),
        ),
      ],
    );
  }
}

/// One destination tile: label + meta, no icon (design's icon-less grid).
/// The highlighted tile (recommended destination) carries a leaf tint;
/// normal tiles are milk300 behind an ink hairline.
class _DeliverTile extends StatelessWidget {
  const _DeliverTile({
    required this.label,
    required this.meta,
    required this.onTap,
    this.highlight = false,
    this.enabled = true,
  });

  final String label;
  final String meta;
  final VoidCallback onTap;
  final bool highlight;
  final bool enabled;

  @override
  Widget build(BuildContext context) {
    final text = Theme.of(context).textTheme;
    final bg = highlight
        ? AppColors.leaf100.withValues(alpha: 0.10)
        : AppColors.milk300;
    final border = highlight
        ? AppColors.leaf500.withValues(alpha: 0.24)
        : AppColors.ink900.withValues(alpha: 0.10);

    return Opacity(
      opacity: enabled ? 1 : 0.4,
      child: Material(
        color: bg,
        borderRadius: AppRadius.rField,
        child: InkWell(
          borderRadius: AppRadius.rField,
          onTap: enabled ? onTap : null,
          child: Container(
            padding: const EdgeInsets.all(AppSpacing.space3),
            decoration: BoxDecoration(
              borderRadius: AppRadius.rField,
              border: Border.all(color: border),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                // Label 12px/600.
                Text(
                  label,
                  style: text.labelMedium?.copyWith(
                    fontWeight: FontWeight.w600,
                    fontSize: 12,
                  ),
                ),
                const SizedBox(height: 2),
                // Meta 10px/400, muted ink.
                Text(
                  meta,
                  style: text.labelSmall?.copyWith(
                    fontWeight: FontWeight.w400,
                    color: AppColors.textMuted,
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

class _GrabHandle extends StatelessWidget {
  const _GrabHandle();

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Container(
        width: 44,
        height: 4,
        decoration: ShapeDecoration(
          color: AppColors.ink900.withValues(alpha: 0.14),
          shape: const StadiumBorder(),
        ),
      ),
    );
  }
}
