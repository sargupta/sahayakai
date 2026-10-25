import 'package:flutter_test/flutter_test.dart';
import 'package:sahayakai/shared/widgets/editorial_section_header.dart';
import 'package:sahayakai/shared/widgets/labeled_field.dart';

/// Finds the [LabeledField] whose label is [label].
///
/// Use this, not `find.text(label)`, to assert a form field exists: the
/// design-system-v2 field card draws a Latin label as an UPPERCASE eyebrow
/// (`LabeledField`), so the rendered text is not the label string. This finds
/// the field by what it is called, whatever case the eyebrow draws.
Finder findFieldLabel(String label) => find.byWidgetPredicate(
  (w) => w is LabeledField && w.label == label,
  description: 'LabeledField labelled "$label"',
);

/// Finds the eyebrow ([EditorialSectionHeader], which [SectionLabel] renders)
/// whose text is [eyebrow].
///
/// The v2 eyebrow draws Latin text UPPERCASE, so `find.text(eyebrow)` misses
/// it; this finds it by the string it was given.
Finder findEyebrow(String eyebrow) => find.byWidgetPredicate(
  (w) => w is EditorialSectionHeader && w.eyebrow == eyebrow,
  description: 'eyebrow "$eyebrow"',
);
