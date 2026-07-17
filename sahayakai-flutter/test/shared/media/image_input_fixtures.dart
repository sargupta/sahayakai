import 'dart:typed_data';

import 'package:sahayakai/shared/media/image_input.dart';

/// Shared fixtures for the image-input suites (and the worksheet screen, which
/// embeds the input). Not a `_test.dart` file, so the runner ignores it.

/// A real 1x1 transparent PNG, so the preview's `Image.memory` decodes a valid
/// image rather than throwing. Small enough to be well under the size cap.
final Uint8List kTinyPng = Uint8List.fromList(<int>[
  0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, //
  0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52, //
  0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, //
  0x08, 0x06, 0x00, 0x00, 0x00, 0x1F, 0x15, 0xC4, //
  0x89, 0x00, 0x00, 0x00, 0x0D, 0x49, 0x44, 0x41, //
  0x54, 0x78, 0x9C, 0x62, 0x00, 0x01, 0x00, 0x00, //
  0x05, 0x00, 0x01, 0x0D, 0x0A, 0x2D, 0xB4, 0x00, //
  0x00, 0x00, 0x00, 0x49, 0x45, 0x4E, 0x44, 0xAE, //
  0x42, 0x60, 0x82,
]);

/// A pick source with a scripted outcome, so no test ever opens a real camera.
class FakeImagePickerService implements ImagePickerService {
  FakeImagePickerService({this.result, this.error});

  /// Returned from [pick]. `null` models the user cancelling.
  RawPickedImage? result;

  /// Thrown from [pick], to model a denied permission or a platform failure.
  ImageInputException? error;

  /// Every source [pick] was called with, in order.
  final List<ImageInputSource> calls = <ImageInputSource>[];

  @override
  Future<RawPickedImage?> pick(ImageInputSource source) async {
    calls.add(source);
    if (error != null) throw error!;
    return result;
  }
}

/// A small, valid picked image.
RawPickedImage tinyRaw({
  String mimeType = 'image/jpeg',
  String? name = 'page.jpg',
}) =>
    RawPickedImage(bytes: kTinyPng, mimeType: mimeType, name: name);

/// A valid [PickedImage] for seeding the preview state directly.
PickedImage tinyPicked() => PickedImage.fromRaw(tinyRaw());

/// Raw bytes whose base64 data URI is over [kMaxImageDataUriBytes], to exercise
/// the oversized-image reject path. ~10.6 MB of bytes -> ~14.1 MB of URI.
RawPickedImage oversizedRaw() => RawPickedImage(
      bytes: Uint8List(10600000),
      mimeType: 'image/jpeg',
      name: 'huge.jpg',
    );
