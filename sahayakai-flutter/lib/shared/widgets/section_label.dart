import 'package:flutter/material.dart';

import 'editorial_section_header.dart';

/// The ONE section-label grammar (DESIGN_RUBRIC §5 / §14): the label above a
/// block of content.
///
/// Design system v2 names a section with its `Eyebrow` (uppercase, tracked
/// saffron, no icon, no tick or rule), so this renders
/// [EditorialSectionHeader]. The pre-v2 leading glyph and saffron tick are
/// gone: v2 eyebrows are text only.
class SectionLabel extends StatelessWidget {
  const SectionLabel(this.label, {super.key});

  final String label;

  @override
  Widget build(BuildContext context) => EditorialSectionHeader(label);
}

/// A [SectionLabel] and the block it labels, 10px apart (v2 stacks an eyebrow
/// and its content with a 10px gap).
///
/// Replaces the byte-identical private `_Section` in Settings, Profile and
/// Onboarding.
class Section extends StatelessWidget {
  const Section({super.key, required this.title, required this.child});

  final String title;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      mainAxisSize: MainAxisSize.min,
      children: [SectionLabel(title), const SizedBox(height: 10), child],
    );
  }
}
