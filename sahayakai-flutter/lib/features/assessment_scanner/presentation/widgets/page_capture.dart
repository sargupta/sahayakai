import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons/lucide_icons.dart';

import '../../../../core/i18n/gen/app_localizations.dart';
import '../../../../core/i18n/l10n_ext.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../shared/media/image_input.dart';
import '../../../../shared/widgets/app_card.dart';
import '../../../../shared/widgets/inline_error.dart';
import '../../domain/assessment_scan.dart';

/// A multi-page camera/gallery capture, built over the SAME injectable
/// [imagePickerServiceProvider] seam the Worksheet Wizard and Assess Assignment
/// tools use — so tests fake the one seam and no unit test ever opens a real
/// camera, and there is no new plugin dependency. It is the multi-page sibling
/// of the shared single-image `ImageInput`.
///
/// Controlled: the parent form owns [pages] and is told of changes via
/// [onChanged]; this widget owns only the transient pick/error state. It caps at
/// [kAssessmentMaxPages] (the route's demo page cap) — the "add" affordance is
/// disabled once the cap is reached, so the teacher can never assemble a request
/// the server would reject with `PAGE_LIMIT_EXCEEDED`. Each page renders as a
/// thumbnail ([Image.memory] with an error builder) beside a >=48dp remove
/// control.
class PageCapture extends ConsumerStatefulWidget {
  const PageCapture({
    super.key,
    required this.pages,
    required this.onChanged,
    this.errorText,
    this.maxPages = kAssessmentMaxPages,
  });

  final List<PickedImage> pages;
  final ValueChanged<List<PickedImage>> onChanged;

  /// A form-level error (e.g. "add at least one page") shown when no pick-time
  /// error is active.
  final String? errorText;
  final int maxPages;

  @override
  ConsumerState<PageCapture> createState() => _PageCaptureState();
}

class _PageCaptureState extends ConsumerState<PageCapture> {
  bool _busy = false;
  ImageInputErrorKind? _pickError;

  bool get _atLimit => widget.pages.length >= widget.maxPages;

  Future<void> _pick(ImageInputSource source) async {
    if (_atLimit) return;
    setState(() {
      _busy = true;
      _pickError = null;
    });
    try {
      final raw = await ref.read(imagePickerServiceProvider).pick(source);
      if (!mounted) return;
      if (raw == null) {
        // Cancelled: keep the pages already added untouched.
        setState(() => _busy = false);
        return;
      }
      final picked = PickedImage.fromRaw(raw);
      if (picked.isOverLimit) {
        // Compression already ran in the service; still too big -> reject.
        setState(() {
          _busy = false;
          _pickError = ImageInputErrorKind.tooLarge;
        });
        return;
      }
      setState(() => _busy = false);
      widget.onChanged(<PickedImage>[...widget.pages, picked]);
    } on ImageInputException catch (e) {
      if (!mounted) return;
      setState(() {
        _busy = false;
        _pickError = e.kind;
      });
    }
  }

  void _remove(int index) {
    setState(() => _pickError = null);
    final next = <PickedImage>[...widget.pages]..removeAt(index);
    widget.onChanged(next);
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final pages = widget.pages;

    // A pick-time error (permission / size / failure) is more specific than the
    // form's generic "required", so it wins the single error slot.
    final errorMessage = _pickError != null
        ? _errorMessage(l10n, _pickError!)
        : (pages.isEmpty ? widget.errorText : null);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      mainAxisSize: MainAxisSize.min,
      children: [
        if (pages.isEmpty)
          _EmptyWell(busy: _busy)
        else
          _PageList(pages: pages, busy: _busy, onRemove: _remove),
        const SizedBox(height: AppSpacing.space3),
        // The page counter, so the cap is legible before it is hit. Full ink
        // (onSurface): this sits on the scaffold paper ground, where the muted
        // onSurfaceVariant is only ~4.39:1 — under the AA floor.
        Text(
          l10n.assessmentScannerPageCounter(pages.length, widget.maxPages),
          style: Theme.of(context).textTheme.labelMedium?.copyWith(
            color: Theme.of(context).colorScheme.onSurface,
          ),
        ),
        const SizedBox(height: AppSpacing.space3),
        _SourceButtons(busy: _busy, atLimit: _atLimit, onPick: _pick),
        if (_atLimit) ...[
          const SizedBox(height: AppSpacing.space2),
          Text(
            l10n.assessmentScannerPagesFull(widget.maxPages),
            // Full ink: on the paper ground the muted role is under AA.
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
              color: Theme.of(context).colorScheme.onSurface,
            ),
          ),
        ],
        if (errorMessage != null) ...[
          const SizedBox(height: AppSpacing.space3),
          InlineError(message: errorMessage),
        ],
      ],
    );
  }

  String _errorMessage(AppLocalizations l10n, ImageInputErrorKind kind) =>
      switch (kind) {
        ImageInputErrorKind.permissionDenied => l10n.imageInputPermissionDenied,
        ImageInputErrorKind.tooLarge => l10n.imageInputTooLarge(
          _formatMaxBytes(),
        ),
        ImageInputErrorKind.failed => l10n.imageInputFailed,
      };
}

/// Matches the shared image input's "14 MB" framing (1 MB = 1,000,000 bytes).
String _formatMaxBytes() {
  const mb = kMaxImageDataUriBytes / 1000000;
  final rounded = mb.toStringAsFixed(1);
  final trimmed = rounded.endsWith('.0')
      ? rounded.substring(0, rounded.length - 2)
      : rounded;
  return '$trimmed MB';
}

/// The empty state: a dark "scan framing" guide (v3 screen 11), or a spinner
/// while picking.
///
/// HONESTY: the app captures through the OS camera app (`image_picker`), not a
/// live in-app preview — so this is a *framing guide*, not a viewfinder feed. It
/// carries the v3 dark frame with corner brackets and a scan line because good
/// framing genuinely improves grading (the route returns `imageQualityWarnings`
/// when a sheet is skewed or dim), and it never pretends to show a live camera.
class _EmptyWell extends StatelessWidget {
  const _EmptyWell({required this.busy});

  final bool busy;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final text = Theme.of(context).textTheme;
    // The v3 dark viewfinder ground, from theme roles (never raw hex): the
    // inverse surface reads near-black in light mode and light in dark mode,
    // with the orb's saffron as the scan accent.
    final ground = scheme.inverseSurface;
    final onGround = scheme.onInverseSurface;
    final accent = scheme.primary;

    return Container(
      // Wraps content (min constraint, not fixed) so Indic guidance text and
      // font scaling never clip. DESIGN_RUBRIC §7.
      constraints: const BoxConstraints(minHeight: 168),
      decoration: BoxDecoration(
        color: ground,
        borderRadius: AppRadius.rLg,
      ),
      child: CustomPaint(
        painter: _ViewfinderPainter(
          frame: onGround.withValues(alpha: 0.34),
          scanLine: accent,
          showScanLine: !busy,
        ),
        child: Padding(
          padding: const EdgeInsets.all(AppSpacing.space6),
          child: Center(
            child: busy
                ? SizedBox(
                    width: AppIconSize.standalone,
                    height: AppIconSize.standalone,
                    child: CircularProgressIndicator(
                      strokeWidth: 2,
                      color: accent,
                    ),
                  )
                : Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(
                        LucideIcons.scanLine,
                        size: AppIconSize.standalone,
                        color: onGround,
                      ),
                      const SizedBox(height: AppSpacing.space3),
                      Text(
                        context.l10n.assessmentScannerFrameGuide,
                        textAlign: TextAlign.center,
                        style: text.titleSmall?.copyWith(color: onGround),
                      ),
                      const SizedBox(height: AppSpacing.space2),
                      Text(
                        context.l10n.assessmentScannerFrameHint,
                        textAlign: TextAlign.center,
                        style: text.bodySmall?.copyWith(
                          color: onGround.withValues(alpha: 0.78),
                          height: 1.4,
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

/// Paints the v3 viewfinder: four corner brackets inset from the edges and a
/// single horizontal scan line. Static (no animation) so it never defeats
/// `pumpAndSettle` and needs no reduce-motion branch — it is a framing guide,
/// not a live feed.
class _ViewfinderPainter extends CustomPainter {
  _ViewfinderPainter({
    required this.frame,
    required this.scanLine,
    required this.showScanLine,
  });

  final Color frame;
  final Color scanLine;
  final bool showScanLine;

  @override
  void paint(Canvas canvas, Size size) {
    const inset = 12.0;
    const arm = 22.0;
    final rect = Rect.fromLTWH(
      inset,
      inset,
      size.width - inset * 2,
      size.height - inset * 2,
    );
    final paint = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = 2
      ..strokeCap = StrokeCap.round
      ..color = frame;

    // Four L-shaped corner brackets.
    void corner(Offset o, double dx, double dy) {
      canvas.drawLine(o, o.translate(dx, 0), paint);
      canvas.drawLine(o, o.translate(0, dy), paint);
    }

    corner(rect.topLeft, arm, arm);
    corner(rect.topRight, -arm, arm);
    corner(rect.bottomLeft, arm, -arm);
    corner(rect.bottomRight, -arm, -arm);

    if (showScanLine) {
      final y = rect.top + rect.height * 0.46;
      canvas.drawLine(
        Offset(rect.left + arm, y),
        Offset(rect.right - arm, y),
        Paint()
          ..strokeWidth = 2
          ..strokeCap = StrokeCap.round
          ..color = scanLine.withValues(alpha: 0.85),
      );
    }
  }

  @override
  bool shouldRepaint(_ViewfinderPainter old) =>
      old.frame != frame ||
      old.scanLine != scanLine ||
      old.showScanLine != showScanLine;
}

/// The captured pages, one row each: a thumbnail, the page number, and a
/// >=48dp remove control.
class _PageList extends StatelessWidget {
  const _PageList({
    required this.pages,
    required this.busy,
    required this.onRemove,
  });

  final List<PickedImage> pages;
  final bool busy;
  final ValueChanged<int> onRemove;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      mainAxisSize: MainAxisSize.min,
      children: [
        for (var i = 0; i < pages.length; i++) ...[
          if (i > 0) const SizedBox(height: AppSpacing.space3),
          _PageTile(
            index: i,
            image: pages[i],
            onRemove: busy ? null : () => onRemove(i),
          ),
        ],
      ],
    );
  }
}

class _PageTile extends StatelessWidget {
  const _PageTile({
    required this.index,
    required this.image,
    required this.onRemove,
  });

  final int index;
  final PickedImage image;
  final VoidCallback? onRemove;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final scheme = Theme.of(context).colorScheme;
    final text = Theme.of(context).textTheme;
    final pageNumber = index + 1;

    // The keystone card grammar (rCard/e1 tokens) rather than a hand-rolled
    // Container — the same drift AppCard exists to prevent.
    return AppCard(
      variant: AppCardVariant.flat,
      padding: const EdgeInsets.all(AppSpacing.space3),
      child: Row(
        children: [
          // A hard 56x56 box owns the size, so the thumbnail never drives the
          // Row's width from the decoded image's own dimensions.
          SizedBox(
            width: 56,
            height: 56,
            child: ClipRRect(
              borderRadius: AppRadius.rMd,
              child: Image.memory(
                image.bytes,
                fit: BoxFit.cover,
                semanticLabel: l10n.assessmentScannerPageLabel(pageNumber),
                gaplessPlayback: true,
                // A page that can't be decoded degrades to a calm placeholder
                // rather than throwing a red error box.
                errorBuilder: (context, error, stack) => Container(
                  color: scheme.surfaceContainerHigh,
                  alignment: Alignment.center,
                  child: Icon(
                    LucideIcons.imageOff,
                    size: AppIconSize.inline,
                    color: scheme.onSurfaceVariant,
                  ),
                ),
              ),
            ),
          ),
          const SizedBox(width: AppSpacing.space4),
          Expanded(
            child: Text(
              l10n.assessmentScannerPageLabel(pageNumber),
              style: text.titleSmall,
            ),
          ),
          // >=48dp remove target, labelled per-page for screen readers.
          IconButton(
            onPressed: onRemove,
            icon: const Icon(LucideIcons.trash2, size: AppIconSize.inline),
            tooltip: l10n.assessmentScannerRemovePage(pageNumber),
            constraints: const BoxConstraints(minWidth: 48, minHeight: 48),
          ),
        ],
      ),
    );
  }
}

/// The camera + gallery "add page" buttons. Disabled while a pick is in flight
/// or the page cap is reached.
class _SourceButtons extends StatelessWidget {
  const _SourceButtons({
    required this.busy,
    required this.atLimit,
    required this.onPick,
  });

  final bool busy;
  final bool atLimit;
  final ValueChanged<ImageInputSource> onPick;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final disabled = busy || atLimit;
    return Wrap(
      spacing: AppSpacing.space3,
      runSpacing: AppSpacing.space3,
      children: [
        OutlinedButton.icon(
          onPressed: disabled ? null : () => onPick(ImageInputSource.camera),
          icon: const Icon(LucideIcons.camera, size: AppIconSize.inline),
          label: Text(l10n.assessmentScannerTakePhoto),
        ),
        OutlinedButton.icon(
          onPressed: disabled ? null : () => onPick(ImageInputSource.gallery),
          icon: const Icon(LucideIcons.image, size: AppIconSize.inline),
          label: Text(l10n.assessmentScannerChooseGallery),
        ),
      ],
    );
  }
}
