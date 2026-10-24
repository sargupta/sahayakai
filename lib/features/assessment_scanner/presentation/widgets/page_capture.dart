import 'dart:math' as math;

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
/// v3 Screen 11: the capture phase is the dark scanner surface — a framed
/// viewfinder (striped ground, dashed inner frame, saffron scan line), the
/// captured pages beneath it, then the design's pill-chip row: *Take photo*
/// (primary, milk-filled), *Choose from gallery*, and *Batch mode* — a real
/// toggle that, while on, reopens the camera after every capture so a stack of
/// pages is scanned back-to-back until the cap or the teacher cancels.
///
/// Controlled: the parent form owns [pages] and is told of changes via
/// [onChanged]; this widget owns only the transient pick/error state. It caps at
/// [maxPages] (the route's demo page cap), so the teacher can never assemble a
/// request the server would reject with `PAGE_LIMIT_EXCEEDED`. Each page renders
/// as a thumbnail ([Image.memory] with an error builder) beside a >=48dp remove
/// control.
class PageCapture extends ConsumerStatefulWidget {
  const PageCapture({
    super.key,
    required this.pages,
    required this.onChanged,
    this.errorText,
    this.maxPages = kAssessmentMaxPages,
    this.batch = false,
    this.onToggleBatch,
  });

  final List<PickedImage> pages;
  final ValueChanged<List<PickedImage>> onChanged;

  /// A form-level error (e.g. "add at least one page") shown when no pick-time
  /// error is active.
  final String? errorText;
  final int maxPages;

  /// Batch mode (v3 Screen 11): when true, a successful camera capture
  /// immediately reopens the camera for the next page (until [maxPages] or a
  /// cancel). Owned by the parent so the header's page pill stays in sync.
  final bool batch;
  final VoidCallback? onToggleBatch;

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
        // Cancelled: keep the pages already added untouched (this also ends a
        // batch run — the teacher closed the camera on purpose).
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
      // The count AFTER this add, read before notifying the parent: `pages`
      // only reflects the change once the parent rebuilds, so the batch loop
      // must not consult widget.pages for the limit.
      final nextCount = widget.pages.length + 1;
      setState(() => _busy = false);
      widget.onChanged(<PickedImage>[...widget.pages, picked]);

      // Batch mode: reopen the camera for the next page until the cap.
      if (widget.batch &&
          source == ImageInputSource.camera &&
          nextCount < widget.maxPages &&
          mounted) {
        await _pick(source);
      }
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
        // The viewfinder (v3 Screen 11's framed capture well) — always on
        // screen: with no pages it frames the first shot, with pages it frames
        // the next one.
        _Viewfinder(busy: _busy),
        if (pages.isNotEmpty) ...[
          const SizedBox(height: AppSpacing.space3),
          _PageList(pages: pages, busy: _busy, onRemove: _remove),
        ],
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
        _ChipRow(
          busy: _busy,
          atLimit: _atLimit,
          batch: widget.batch,
          onPick: _pick,
          onToggleBatch: widget.onToggleBatch,
        ),
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

/// The v3 Screen 11 viewfinder: a `#171310`-toned well with a 2px milk@.30
/// rounded border (r22), diagonal milk stripes, a 1px dashed inner frame
/// (r14, inset 18) carrying the "fit the sheet" hint bottom-left, and the
/// saffron scan line with its soft glow at 46% height.
///
/// HONESTY: the app captures through the OS camera app (`image_picker`), not a
/// live in-app preview — so this is a *framing guide*, not a viewfinder feed.
/// It never pretends to show live pixels; good framing genuinely improves
/// grading (the route returns `imageQualityWarnings` for skewed or dim sheets).
class _Viewfinder extends StatelessWidget {
  const _Viewfinder({required this.busy});

  final bool busy;

  @override
  Widget build(BuildContext context) {
    final text = Theme.of(context).textTheme;
    // The raw hex below is the canonical Screen 11 frame palette.
    const milk = AppColors.milk50;

    return SizedBox(
      // Fixed, finite height: the painter + Stack layers need bounded
      // constraints (the frame is a design-defined panel, not content-driven).
      height: 260,
      child: CustomPaint(
        painter: _ViewfinderPainter(showScanLine: !busy),
        child: Stack(
          children: [
            if (busy)
              const Positioned.fill(
                child: Center(
                  child: SizedBox(
                    width: AppIconSize.standalone,
                    height: AppIconSize.standalone,
                    child: CircularProgressIndicator(
                      strokeWidth: 2,
                      color: milk,
                    ),
                  ),
                ),
              ),
            // The framing hint sits inside the dashed frame, bottom-left.
            Positioned(
              left: 32,
              right: 32,
              bottom: 32,
              child: Text(
                context.l10n.assessmentScannerFrameGuide,
                style: text.labelSmall?.copyWith(
                  fontSize: 11,
                  fontWeight: FontWeight.w500,
                  color: milk.withValues(alpha: 0.72),
                  height: 1.35,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// Paints the Screen 11 frame: striped ground, 2px milk border (r22), dashed
/// inner frame (r14), and the saffron scan line with a blurred glow. Static (no
/// animation) so it never defeats `pumpAndSettle` and needs no reduce-motion
/// branch — it is a framing guide, not a live feed.
class _ViewfinderPainter extends CustomPainter {
  _ViewfinderPainter({required this.showScanLine});

  final bool showScanLine;

  static const milk = AppColors.milk50;

  @override
  void paint(Canvas canvas, Size size) {
    final rect = Offset.zero & size;
    final outer = RRect.fromRectAndRadius(rect, const Radius.circular(22));

    // Striped ground: milk @ .02 base with milk @ .05 bands every 24px,
    // tilted like the design's 115deg repeating gradient.
    canvas.save();
    canvas.clipRRect(outer);
    canvas.drawRect(
      rect,
      Paint()..color = milk.withValues(alpha: 0.02),
    );
    canvas.save();
    canvas.translate(size.width / 2, size.height / 2);
    canvas.rotate(25 * math.pi / 180);
    final extent = size.width + size.height;
    final stripe = Paint()..color = milk.withValues(alpha: 0.05);
    for (var x = -extent / 2; x < extent / 2; x += 24) {
      canvas.drawRect(
        Rect.fromLTWH(x, -extent / 2, 12, extent),
        stripe,
      );
    }
    canvas.restore();
    canvas.restore();

    // Outer border: 2px milk @ .30, r22.
    canvas.drawRRect(
      outer,
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = 2
        ..color = milk.withValues(alpha: 0.30),
    );

    // Inner dashed frame: inset 18, 1px milk @ .40, r14.
    final inner = RRect.fromRectAndRadius(
      rect.deflate(18),
      const Radius.circular(14),
    );
    _drawDashed(
      canvas,
      inner,
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = 1
        ..color = milk.withValues(alpha: 0.40),
    );

    if (showScanLine) {
      // The saffron scan line at 46% with its soft glow (design:
      // rgba(255,214,170,.8), blur 14), spanning the dashed frame's width.
      const lineColor = Color(0xCCFFD6AA); // #FFD6AA @ .8
      final y = rect.top + rect.height * 0.46;
      final from = Offset(rect.left + 18, y);
      final to = Offset(rect.right - 18, y);
      canvas.drawLine(
        from,
        to,
        Paint()
          ..strokeWidth = 3
          ..strokeCap = StrokeCap.round
          ..color = lineColor
          ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 7),
      );
      canvas.drawLine(
        from,
        to,
        Paint()
          ..strokeWidth = 2
          ..strokeCap = StrokeCap.round
          ..color = lineColor,
      );
    }
  }

  /// Strokes an [RRect] path with a 6-on / 5-off dash pattern.
  void _drawDashed(Canvas canvas, RRect rrect, Paint paint) {
    const dash = 6.0;
    const gap = 5.0;
    final path = Path()..addRRect(rrect);
    for (final metric in path.computeMetrics()) {
      var distance = 0.0;
      while (distance < metric.length) {
        canvas.drawPath(
          metric.extractPath(distance, math.min(distance + dash, metric.length)),
          paint,
        );
        distance += dash + gap;
      }
    }
  }

  @override
  bool shouldRepaint(_ViewfinderPainter old) =>
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

/// The v3 Screen 11 chip row: *Take photo* (the primary action, milk-filled
/// like the design's active chip), *Choose from gallery*, and the *Batch mode*
/// toggle (milk-filled while on). Every chip is real — the first two open the
/// OS picker, the third flips continuous batch capture. >=42dp targets.
class _ChipRow extends StatelessWidget {
  const _ChipRow({
    required this.busy,
    required this.atLimit,
    required this.batch,
    required this.onPick,
    this.onToggleBatch,
  });

  final bool busy;
  final bool atLimit;
  final bool batch;
  final ValueChanged<ImageInputSource> onPick;
  final VoidCallback? onToggleBatch;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final pickEnabled = !busy && !atLimit;
    return Wrap(
      spacing: AppSpacing.space2,
      runSpacing: AppSpacing.space2,
      children: [
        // Keys: tests locate these by key, since the labels are translated.
        _Chip(
          key: const ValueKey('scanner_chip_camera'),
          label: l10n.assessmentScannerTakePhoto,
          filled: true,
          enabled: pickEnabled,
          onTap: () => onPick(ImageInputSource.camera),
        ),
        _Chip(
          key: const ValueKey('scanner_chip_gallery'),
          label: l10n.assessmentScannerChooseGallery,
          enabled: pickEnabled,
          onTap: () => onPick(ImageInputSource.gallery),
        ),
        _Chip(
          key: const ValueKey('scanner_chip_batch'),
          label: l10n.assessmentScannerBatchMode,
          filled: batch,
          selected: batch,
          enabled: !busy && onToggleBatch != null,
          onTap: onToggleBatch,
        ),
      ],
    );
  }
}

/// One pill chip (design: `font 600 11px Instrument Sans`, padding 8/12,
/// stadium). The visual pill stays compact; the InkWell's 42dp-min-height
/// inner box owns the touch floor.
class _Chip extends StatelessWidget {
  const _Chip({
    super.key,
    required this.label,
    required this.enabled,
    this.onTap,
    this.filled = false,
    this.selected = false,
  });

  final String label;
  final bool enabled;
  final VoidCallback? onTap;
  final bool filled;
  final bool selected;

  @override
  Widget build(BuildContext context) {
    final text = Theme.of(context).textTheme;
    // Milk-filled chip (primary action or an ON toggle) reads ink on milk;
    // the outlined chip reads milk on the dark ground.
    final bg = filled
        ? AppColors.milk50.withValues(alpha: 0.90)
        : AppColors.milk50.withValues(alpha: 0.16);
    final fg = filled ? AppColors.ink900 : AppColors.milk50;

    return Opacity(
      opacity: enabled ? 1 : 0.45,
      child: Material(
        color: bg,
        borderRadius: BorderRadius.circular(9999),
        child: InkWell(
          borderRadius: BorderRadius.circular(9999),
          onTap: enabled ? onTap : null,
          child: ConstrainedBox(
            constraints: const BoxConstraints(minHeight: 42),
            child: Center(
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 12),
                child: Text(
                  label,
                  style: text.labelSmall?.copyWith(
                    fontSize: 11,
                    fontWeight: FontWeight.w600,
                    color: fg,
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
