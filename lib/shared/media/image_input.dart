import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart' show PlatformException;
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:image_picker/image_picker.dart';
import 'package:lucide_icons/lucide_icons.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';

import '../../core/i18n/gen/app_localizations.dart';
import '../../core/i18n/l10n_ext.dart';
import '../../core/theme/app_theme.dart';
import '../widgets/inline_error.dart';
import '../widgets/map_card.dart';
import '../widgets/map_chip.dart';

part 'image_input.g.dart';

/// The backend cap on `imageDataUri`. Verified against
/// `WorksheetWizardInputSchema` in `sahayakai-main`:
/// `z.string().max(14_000_000)`. Zod's `.max()` on a string measures the
/// STRING LENGTH — the number of characters of the whole `data:` URI — and
/// **rejects** (400) anything longer; it does not clamp. A data URI is pure
/// ASCII, so its character length equals its byte length, and this is the exact
/// value the size counter measures against. (Because base64 inflates bytes by
/// ~4/3 plus the `data:image/...;base64,` prefix, ~14 MB of URI is ~10.5 MB of
/// raw image.) Both the Worksheet Wizard and the later Assess Assignment tool
/// post through this same cap. See docs/flutter/HANDOFF.md.
const int kMaxImageDataUriBytes = 14000000;

/// Where a picked image comes from. Kept independent of `image_picker`'s
/// `ImageSource` so the widget/tests never import the plugin type directly.
enum ImageInputSource { camera, gallery }

/// Why a pick failed, so the UI shows the right recovery copy rather than one
/// generic apology.
enum ImageInputErrorKind {
  /// The OS denied camera or photo-library access.
  permissionDenied,

  /// The encoded data URI is over [kMaxImageDataUriBytes] — the server would
  /// reject it with a 400, so it is stopped here with a clear message.
  tooLarge,

  /// Any other platform failure while picking or reading the file.
  failed,
}

/// A typed failure the [ImagePickerService] throws instead of leaking a raw
/// [PlatformException] into the widget layer.
@immutable
class ImageInputException implements Exception {
  const ImageInputException(this.kind, {this.rawMessage});

  final ImageInputErrorKind kind;
  final String? rawMessage;

  @override
  String toString() => 'ImageInputException($kind): ${rawMessage ?? ''}';
}

/// The raw bytes + metadata a pick source returns, before any size check or
/// base64 encoding. This is the seam a fake replaces in tests.
@immutable
class RawPickedImage {
  const RawPickedImage({
    required this.bytes,
    required this.mimeType,
    this.name,
  });

  final Uint8List bytes;
  final String mimeType;
  final String? name;
}

/// A picked, encoded image the form can submit and preview.
///
/// Holds BOTH the raw [bytes] (for the on-screen thumbnail, so the preview
/// never re-decodes the base64) and the [dataUri] (what the request sends).
/// [sizeBytes] is the data URI's length — the exact quantity the backend caps
/// (see [kMaxImageDataUriBytes]) — so the size counter and the server agree.
@immutable
class PickedImage {
  const PickedImage({
    required this.bytes,
    required this.dataUri,
    required this.mimeType,
    this.name,
  });

  /// Encodes [raw] into a `data:<mime>;base64,<data>` URI.
  factory PickedImage.fromRaw(RawPickedImage raw) {
    final dataUri = 'data:${raw.mimeType};base64,${base64Encode(raw.bytes)}';
    return PickedImage(
      bytes: raw.bytes,
      dataUri: dataUri,
      mimeType: raw.mimeType,
      name: raw.name,
    );
  }

  final Uint8List bytes;
  final String dataUri;
  final String mimeType;
  final String? name;

  /// The data URI's length in bytes — what the backend measures against
  /// [kMaxImageDataUriBytes].
  int get sizeBytes => dataUri.length;

  /// True when the encoded URI is over the server cap.
  bool get isOverLimit => sizeBytes > kMaxImageDataUriBytes;
}

/// Picks an image from the camera or gallery. The one seam tests override so
/// no unit test ever opens a real camera.
abstract interface class ImagePickerService {
  /// Returns `null` when the user cancels. Throws an [ImageInputException] on
  /// a denied permission or any other platform failure.
  Future<RawPickedImage?> pick(ImageInputSource source);
}

/// The production [ImagePickerService], backed by `image_picker`.
///
/// Compresses on the way in (`imageQuality` + `maxWidth`) so a full-resolution
/// textbook photo is downscaled before it is ever encoded — the first line of
/// defence against the [kMaxImageDataUriBytes] cap. If a picture is still over
/// the cap after that, the widget rejects it with a clear message.
class PlatformImagePickerService implements ImagePickerService {
  const PlatformImagePickerService();

  @override
  Future<RawPickedImage?> pick(ImageInputSource source) async {
    final picker = ImagePicker();
    try {
      final file = await picker.pickImage(
        source: source == ImageInputSource.camera
            ? ImageSource.camera
            : ImageSource.gallery,
        // Compress + downscale so a phone-camera textbook page fits the cap.
        imageQuality: 70,
        maxWidth: 2000,
      );
      if (file == null) return null; // the teacher backed out
      final bytes = await file.readAsBytes();
      return RawPickedImage(
        bytes: bytes,
        mimeType: _mimeForXFile(file),
        name: file.name,
      );
    } on PlatformException catch (e) {
      if (_isPermissionDenied(e.code)) {
        throw ImageInputException(
          ImageInputErrorKind.permissionDenied,
          rawMessage: e.message,
        );
      }
      throw ImageInputException(
        ImageInputErrorKind.failed,
        rawMessage: e.message,
      );
    }
  }

  static bool _isPermissionDenied(String code) {
    final c = code.toLowerCase();
    // image_picker surfaces these on iOS; some Android OEMs use the same shape.
    return c.contains('denied') ||
        c.contains('access') ||
        c == 'no_valid_image_uri';
  }

  /// Best-effort MIME type. `image_picker` re-encodes to JPEG when
  /// `imageQuality` is set on Android, so the extension is the reliable signal;
  /// [XFile.mimeType] is usually null off the web.
  static String _mimeForXFile(XFile file) {
    final declared = file.mimeType;
    if (declared != null && declared.startsWith('image/')) return declared;
    final lower = file.name.toLowerCase();
    if (lower.endsWith('.png')) return 'image/png';
    if (lower.endsWith('.webp')) return 'image/webp';
    if (lower.endsWith('.heic') || lower.endsWith('.heif')) return 'image/heic';
    if (lower.endsWith('.gif')) return 'image/gif';
    return 'image/jpeg';
  }
}

/// The injectable pick source. Override this provider in tests with a fake so
/// the widget never touches the camera or the file system.
@riverpod
ImagePickerService imagePickerService(Ref ref) =>
    const PlatformImagePickerService();

/// A reusable camera/gallery image input, shared by the Worksheet Wizard and
/// (later) Assess Assignment. Controlled: the parent form owns the [value] and
/// is told about changes via [onChanged]; this widget owns only the transient
/// pick/error state.
///
/// States it covers: empty (pick prompt), busy (picking), a picked preview
/// (thumbnail + size counter + remove), and the three error kinds
/// (permission denied / too large / failed). [errorText] carries the parent
/// form's own "required" validation error, shown only when there is no more
/// specific pick error to surface.
class ImageInput extends ConsumerStatefulWidget {
  const ImageInput({
    super.key,
    required this.value,
    required this.onChanged,
    this.errorText,
    this.required = false,
  });

  final PickedImage? value;
  final ValueChanged<PickedImage?> onChanged;

  /// Whether the tool cannot run without a photo. The map then draws the
  /// empty box in its red "still needed" tint from the start, not only after
  /// a failed submit.
  final bool required;

  /// A form-level error (e.g. "an image is required") shown when no pick-time
  /// error is active.
  final String? errorText;

  @override
  ConsumerState<ImageInput> createState() => _ImageInputState();
}

class _ImageInputState extends ConsumerState<ImageInput> {
  bool _busy = false;
  ImageInputErrorKind? _pickError;

  Future<void> _pick(ImageInputSource source) async {
    setState(() {
      _busy = true;
      _pickError = null;
    });
    try {
      final raw = await ref.read(imagePickerServiceProvider).pick(source);
      if (!mounted) return;
      if (raw == null) {
        // Cancelled: keep any existing selection untouched.
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
      widget.onChanged(picked);
    } on ImageInputException catch (e) {
      if (!mounted) return;
      setState(() {
        _busy = false;
        _pickError = e.kind;
      });
    }
  }

  void _remove() {
    setState(() => _pickError = null);
    widget.onChanged(null);
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final value = widget.value;

    // A pick-time error (permission / size / failure) is more specific than the
    // form's generic "required", so it wins the single error slot.
    final errorMessage = _pickError != null
        ? _errorMessage(l10n, _pickError!)
        : (value == null ? widget.errorText : null);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      mainAxisSize: MainAxisSize.min,
      children: [
        if (value == null)
          _EmptyBox(
            busy: _busy,
            needed: widget.required || widget.errorText != null,
            onPick: _pick,
          )
        else
          _Preview(
            image: value,
            busy: _busy,
            onPick: _pick,
            onRemove: _busy ? null : _remove,
          ),
        if (errorMessage != null) ...[
          const SizedBox(height: AppSpacing.space2),
          InlineError(message: errorMessage),
        ],
      ],
    );
  }

  String _errorMessage(AppLocalizations l10n, ImageInputErrorKind kind) =>
      switch (kind) {
        ImageInputErrorKind.permissionDenied => l10n.imageInputPermissionDenied,
        ImageInputErrorKind.tooLarge => l10n.imageInputTooLarge(
          _formatBytes(kMaxImageDataUriBytes),
        ),
        ImageInputErrorKind.failed => l10n.imageInputFailed,
      };
}

/// The empty state, as the UX map draws it: a dashed 16px box with an upload
/// glyph and "Take a photo or browse", and the two ways in under it. Red-tinted
/// when the tool cannot run without a photo; a spinner while picking.
class _EmptyBox extends StatelessWidget {
  const _EmptyBox({
    required this.busy,
    required this.needed,
    required this.onPick,
  });

  final bool busy;
  final bool needed;
  final ValueChanged<ImageInputSource> onPick;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final text = Theme.of(context).textTheme;
    final ink = needed ? AppColors.red700 : AppColors.textBody;
    return CustomPaint(
      painter: _DashedBoxPainter(
        color: needed ? AppColors.mapRequiredBorder : AppColors.borderStrong,
      ),
      child: Container(
        constraints: const BoxConstraints(minHeight: 128),
        padding: const EdgeInsets.all(18),
        decoration: BoxDecoration(
          color: needed ? AppColors.mapRequiredBg : AppColors.surfaceMapCard,
          borderRadius: AppRadius.rTile,
        ),
        alignment: Alignment.center,
        child: busy
            ? const _Busy()
            : Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(LucideIcons.upload, size: 22, color: ink),
                  const SizedBox(height: 6),
                  Text(
                    l10n.imageInputBrowse,
                    textAlign: TextAlign.center,
                    style: text.bodyLarge?.copyWith(
                      fontWeight: FontWeight.w700,
                      color: ink,
                    ),
                  ),
                  const SizedBox(height: AppSpacing.space3),
                  Wrap(
                    alignment: WrapAlignment.center,
                    spacing: 7,
                    runSpacing: 7,
                    children: [
                      MapChip(
                        label: l10n.imageInputTakePhoto,
                        selected: false,
                        onTap: () => onPick(ImageInputSource.camera),
                      ),
                      MapChip(
                        label: l10n.imageInputChooseGallery,
                        selected: false,
                        onTap: () => onPick(ImageInputSource.gallery),
                      ),
                    ],
                  ),
                ],
              ),
      ),
    );
  }
}

/// The map's dashed 1.5px outline on a 16px rounded box.
class _DashedBoxPainter extends CustomPainter {
  const _DashedBoxPainter({required this.color});

  final Color color;

  @override
  void paint(Canvas canvas, Size size) {
    final rrect = AppRadius.rTile.toRRect(Offset.zero & size).deflate(0.75);
    final paint = Paint()
      ..color = color
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1.5;
    for (final metric in (Path()..addRRect(rrect)).computeMetrics()) {
      for (var d = 0.0; d < metric.length; d += 9) {
        canvas.drawPath(metric.extractPath(d, d + 5), paint);
      }
    }
  }

  @override
  bool shouldRepaint(_DashedBoxPainter old) => old.color != color;
}

class _Busy extends StatelessWidget {
  const _Busy();

  @override
  Widget build(BuildContext context) {
    return const SizedBox(
      width: AppIconSize.standalone,
      height: AppIconSize.standalone,
      child: CircularProgressIndicator(strokeWidth: 2, color: AppColors.accent),
    );
  }
}

/// The picked state, as the map's card row: the page thumbnail, its name and
/// how much of the upload cap it uses, then Retake / Choose another / Remove.
class _Preview extends StatelessWidget {
  const _Preview({
    required this.image,
    required this.busy,
    required this.onPick,
    required this.onRemove,
  });

  final PickedImage image;
  final bool busy;
  final ValueChanged<ImageInputSource> onPick;
  final VoidCallback? onRemove;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final text = Theme.of(context).textTheme;
    final used = _formatBytes(image.sizeBytes);
    final max = _formatBytes(kMaxImageDataUriBytes);
    final name = image.name?.trim();

    Widget link(String label, ImageInputSource source) => TextButton(
      onPressed: busy ? null : () => onPick(source),
      style: TextButton.styleFrom(
        foregroundColor: AppColors.textLink,
        minimumSize: const Size(48, 48),
        padding: const EdgeInsets.symmetric(horizontal: AppSpacing.space2),
        textStyle: text.labelLarge?.copyWith(
          fontSize: 13,
          fontWeight: FontWeight.w600,
        ),
      ),
      child: Text(label),
    );

    return MapCard(
      padding: const EdgeInsets.fromLTRB(14, 14, 6, 6),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        mainAxisSize: MainAxisSize.min,
        children: [
          Row(
            children: [
              // A hard box owns the size, so the thumbnail never drives the
              // row's width from the decoded image's own dimensions.
              SizedBox(
                width: 54,
                height: 68,
                child: ClipRRect(
                  borderRadius: AppRadius.rRow,
                  child: Image.memory(
                    image.bytes,
                    fit: BoxFit.cover,
                    semanticLabel: l10n.imageInputPreviewLabel,
                    gaplessPlayback: true,
                  ),
                ),
              ),
              const SizedBox(width: AppSpacing.space3),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    if (name != null && name.isNotEmpty)
                      Text(
                        name,
                        style: text.bodyLarge?.copyWith(
                          fontWeight: FontWeight.w700,
                          color: AppColors.textStrong,
                        ),
                      ),
                    Text(
                      l10n.imageInputSizeOfMax(used, max),
                      style: text.bodySmall?.copyWith(
                        color: AppColors.textMuted,
                      ),
                    ),
                  ],
                ),
              ),
              if (onRemove != null)
                IconButton(
                  onPressed: onRemove,
                  tooltip: l10n.imageInputRemove,
                  icon: const Icon(
                    LucideIcons.trash2,
                    size: 18,
                    color: AppColors.textMuted,
                  ),
                ),
            ],
          ),
          Wrap(
            children: [
              link(l10n.imageInputRetake, ImageInputSource.camera),
              link(l10n.imageInputChangeGallery, ImageInputSource.gallery),
            ],
          ),
        ],
      ),
    );
  }
}

/// Formats a byte count into a short, decimal-MB label (matching the cap's
/// "14 MB" framing: 1 MB = 1,000,000 bytes, the same base the server's numeric
/// cap uses). Trailing ".0" is trimmed so a whole number reads as "14 MB".
String _formatBytes(int bytes) {
  if (bytes >= 1000000) {
    return '${_trimZero((bytes / 1000000).toStringAsFixed(1))} MB';
  }
  if (bytes >= 1000) {
    return '${(bytes / 1000).round()} KB';
  }
  return '$bytes B';
}

String _trimZero(String value) =>
    value.endsWith('.0') ? value.substring(0, value.length - 2) : value;
