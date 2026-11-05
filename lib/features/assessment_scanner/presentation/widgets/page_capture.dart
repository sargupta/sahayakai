import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons/lucide_icons.dart';

import '../../../../core/i18n/gen/app_localizations.dart';
import '../../../../core/i18n/l10n_ext.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../shared/media/image_input.dart';
import '../../../../shared/motion/animated_entrance.dart';
import '../../../../shared/widgets/inline_error.dart';
import '../../domain/assessment_scan.dart';

/// A multi-page camera/gallery capture, built over the SAME injectable
/// [imagePickerServiceProvider] seam the Worksheet Wizard and Assess Assignment
/// tools use — so tests fake the one seam and no unit test ever opens a real
/// camera, and there is no new plugin dependency. It is the multi-page sibling
/// of the shared single-image `ImageInput`.
///
/// v3 Screen 11: the capture phase, light like the rest of the app — a framed
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
        _Viewfinder(busy: _busy, pages: pages.length),
        if (pages.isNotEmpty) ...[
          const SizedBox(height: AppSpacing.space3),
          _PageList(pages: pages, busy: _busy, onRemove: _remove),
        ],
        const SizedBox(height: AppSpacing.space3),
        // The page counter, so the cap is legible before it is hit.
        Text(
          l10n.assessmentScannerPageCounter(pages.length, widget.maxPages),
          style: Theme.of(
            context,
          ).textTheme.labelMedium?.copyWith(color: AppColors.textMuted),
        ),
        const SizedBox(height: AppSpacing.space2),
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
            style: Theme.of(
              context,
            ).textTheme.bodySmall?.copyWith(color: AppColors.textMuted),
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

/// The scanner viewfinder: a 330px light well (r24) with a 1.5px warm
/// frame and a soft paper ground, a dashed sheet outline with ruled
/// lines inside, the saffron scan line sweeping top to bottom, and "Fit the
/// whole sheet inside the frame" along the bottom.
///
/// HONESTY: the app captures through the OS camera app (`image_picker`), not a
/// live in-app preview, so this is a framing guide, never a feed. The scan
/// line sweeps a few times when the screen opens and after each capture, then
/// rests (reduce motion: it rests at once).
class _Viewfinder extends StatefulWidget {
  const _Viewfinder({required this.busy, required this.pages});

  final bool busy;

  /// Captured so far: a new page restarts the sweep.
  final int pages;

  @override
  State<_Viewfinder> createState() => _ViewfinderState();
}

class _ViewfinderState extends State<_Viewfinder>
    with SingleTickerProviderStateMixin {
  /// The map's `scan 2.4s ease-in-out infinite alternate`, run for two
  /// round trips at a time.
  late final AnimationController _sweep = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 2400),
  );

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    _start();
  }

  @override
  void didUpdateWidget(_Viewfinder old) {
    super.didUpdateWidget(old);
    if (old.pages != widget.pages) _start();
  }

  void _start() {
    if (!context.motionEnabled) {
      _sweep.value = 0.5;
      return;
    }
    if (_sweep.isAnimating) return;
    _sweep.value = 0;
    _sweep
        .forward()
        .then((_) => mounted ? _sweep.reverse() : null)
        .then((_) => mounted ? _sweep.forward() : null)
        .then((_) => mounted ? _sweep.reverse() : null);
  }

  @override
  void dispose() {
    _sweep.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final text = Theme.of(context).textTheme;
    return SizedBox(
      height: 330,
      child: DecoratedBox(
        decoration: BoxDecoration(
          borderRadius: AppRadius.rPanel,
          border: Border.all(color: AppColors.scanWellFrame, width: 1.5),
          gradient: const RadialGradient(
            center: Alignment(0, -0.2),
            radius: 0.85,
            colors: [AppColors.scanWellTop, AppColors.scanWellEdge],
          ),
        ),
        child: ClipRRect(
          borderRadius: AppRadius.rPanel,
          child: Stack(
            children: [
              const Positioned(
                left: 46,
                right: 46,
                top: 34,
                bottom: 34,
                child: _SheetGuide(),
              ),
              if (!widget.busy)
                AnimatedBuilder(
                  animation: _sweep,
                  builder: (context, _) {
                    final t = Curves.easeInOut.transform(_sweep.value);
                    return Align(
                      alignment: Alignment(0, -0.64 + t * 1.28),
                      child: const _ScanLine(),
                    );
                  },
                ),
              if (widget.busy)
                const Center(
                  child: SizedBox(
                    width: AppIconSize.standalone,
                    height: AppIconSize.standalone,
                    child: CircularProgressIndicator(
                      strokeWidth: 2,
                      color: AppColors.accentFill,
                    ),
                  ),
                ),
              Positioned(
                left: 16,
                right: 16,
                bottom: 14,
                child: Text(
                  context.l10n.assessmentScannerFrameGuide,
                  textAlign: TextAlign.center,
                  style: text.bodySmall?.copyWith(
                    fontSize: 12.5,
                    color: AppColors.textBody,
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// The dashed sheet outline with the map's seven ruled lines.
class _SheetGuide extends StatelessWidget {
  const _SheetGuide();

  @override
  Widget build(BuildContext context) {
    const widths = [0.7, 1.0, 0.85, 1.0, 0.6, 1.0, 0.78];
    return CustomPaint(
      painter: const _DashedFramePainter(),
      child: Padding(
        padding: const EdgeInsets.all(18),
        child: LayoutBuilder(
          builder: (context, constraints) => Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              for (final (i, w) in widths.indexed) ...[
                if (i > 0) const SizedBox(height: 10),
                Container(
                  width: constraints.maxWidth * w,
                  height: 7,
                  decoration: const ShapeDecoration(
                    color: AppColors.scanRuleInk,
                    shape: StadiumBorder(),
                  ),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

/// A 1.5px dashed rounded rectangle (r10) in translucent ink.
class _DashedFramePainter extends CustomPainter {
  const _DashedFramePainter();

  @override
  void paint(Canvas canvas, Size size) {
    final rrect = RRect.fromRectAndRadius(
      (Offset.zero & size).deflate(0.75),
      const Radius.circular(10),
    );
    final paint = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1.5
      ..color = AppColors.scanGuideInk;
    for (final metric in (Path()..addRRect(rrect)).computeMetrics()) {
      for (var d = 0.0; d < metric.length; d += 10) {
        canvas.drawPath(
          metric.extractPath(d, math.min(d + 6, metric.length)),
          paint,
        );
      }
    }
  }

  @override
  bool shouldRepaint(_DashedFramePainter old) => false;
}

/// The scan line: 2px saffron with a 14px glow, 20px in from each
/// side.
class _ScanLine extends StatelessWidget {
  const _ScanLine();

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 20),
      child: Container(
        height: 2,
        decoration: const BoxDecoration(
          color: AppColors.accentFill,
          boxShadow: [BoxShadow(color: AppColors.scanLineGlow, blurRadius: 14)],
        ),
      ),
    );
  }
}

/// The captured pages, one light card row each: a thumbnail, the page number, and a
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
          if (i > 0) const SizedBox(height: AppSpacing.space2),
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
    final text = Theme.of(context).textTheme;
    final pageNumber = index + 1;
    return DecoratedBox(
      decoration: BoxDecoration(
        color: AppColors.surfaceMapCard,
        borderRadius: AppRadius.rField,
        border: Border.all(color: AppColors.borderHairline),
      ),
      child: Padding(
        padding: const EdgeInsets.fromLTRB(10, 8, 4, 8),
        child: Row(
          children: [
            SizedBox(
              width: 44,
              height: 56,
              child: ClipRRect(
                borderRadius: AppRadius.rRow,
                child: Image.memory(
                  image.bytes,
                  fit: BoxFit.cover,
                  semanticLabel: l10n.assessmentScannerPageLabel(pageNumber),
                  gaplessPlayback: true,
                  // A page that can't be decoded degrades to a calm
                  // placeholder rather than a red error box.
                  errorBuilder: (context, error, stack) => const ColoredBox(
                    color: AppColors.mapOptionIdle,
                    child: Center(
                      child: Icon(
                        LucideIcons.imageOff,
                        size: AppIconSize.inline,
                        color: AppColors.textMuted,
                      ),
                    ),
                  ),
                ),
              ),
            ),
            const SizedBox(width: AppSpacing.space3),
            Expanded(
              child: Text(
                l10n.assessmentScannerPageLabel(pageNumber),
                style: text.bodyLarge?.copyWith(
                  fontWeight: FontWeight.w600,
                  color: AppColors.textStrong,
                ),
              ),
            ),
            IconButton(
              onPressed: onRemove,
              icon: const Icon(
                LucideIcons.trash2,
                size: AppIconSize.inline,
                color: AppColors.textBody,
              ),
              tooltip: l10n.assessmentScannerRemovePage(pageNumber),
              constraints: const BoxConstraints(minWidth: 48, minHeight: 48),
            ),
          ],
        ),
      ),
    );
  }
}

/// The capture chip row: *Take photo* (lit, the main way in),
/// *Choose from gallery*, and the *Batch mode* toggle (lit while on). Every
/// chip is real: the first two open the OS picker, the third reopens the
/// camera after each capture. The map's Auto-capture and Torch need a live
/// in-app camera, which this build does not have, so they are not drawn.
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
      spacing: 7,
      runSpacing: 7,
      children: [
        // Keys: tests locate these by key, since the labels are translated.
        _Chip(
          key: const ValueKey('scanner_chip_camera'),
          label: l10n.assessmentScannerTakePhoto,
          lit: true,
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
          lit: batch,
          selected: batch,
          enabled: !busy && onToggleBatch != null,
          onTap: onToggleBatch,
        ),
      ],
    );
  }
}

/// One pill chip: 34px drawn, a 48dp touch cell; lit = the saffron chip.
class _Chip extends StatelessWidget {
  const _Chip({
    super.key,
    required this.label,
    required this.enabled,
    this.onTap,
    this.lit = false,
    this.selected = false,
  });

  final String label;
  final bool enabled;
  final VoidCallback? onTap;
  final bool lit;
  final bool selected;

  @override
  Widget build(BuildContext context) {
    final text = Theme.of(context).textTheme;
    // The app's chips: lit is the saffron fill with white ink (the main
    // way in, or Batch while on); idle is white with a hairline ring.
    final bg = lit ? AppColors.accentFill : Colors.white;
    final fg = lit ? AppColors.textOnAccent : AppColors.textStrong;
    return Semantics(
      button: true,
      enabled: enabled,
      selected: selected,
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: enabled ? onTap : null,
        child: ConstrainedBox(
          constraints: const BoxConstraints(minHeight: 48),
          child: Center(
            widthFactor: 1,
            child: Opacity(
              opacity: enabled ? 1 : 0.55,
              child: Container(
                constraints: const BoxConstraints(minHeight: 34),
                padding: const EdgeInsets.symmetric(
                  horizontal: 13,
                  vertical: 8,
                ),
                decoration: ShapeDecoration(
                  color: bg,
                  shape: StadiumBorder(
                    side: lit
                        ? BorderSide.none
                        : const BorderSide(color: AppColors.borderHairline),
                  ),
                ),
                child: Text(
                  label,
                  style: text.labelMedium?.copyWith(
                    fontSize: 12.5,
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
