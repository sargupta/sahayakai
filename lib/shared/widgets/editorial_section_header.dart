import 'package:flutter/material.dart';

import '../../core/theme/app_theme.dart';

/// A group heading on a tool form: the UX map's card title, bold Bricolage
/// in ink, with no rule. Field labels under it carry the saffron overline
/// ([LabeledField]), so a group reads as a quiet title over its fields.
class EditorialSectionHeader extends StatelessWidget {
  const EditorialSectionHeader(this.eyebrow, {super.key, this.rule = false});

  final String eyebrow;

  /// Kept for call sites; the UX map draws no rule under a heading.
  final bool rule;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      header: true,
      child: Text(
        eyebrow,
        style: Theme.of(context).textTheme.titleLarge?.copyWith(
          fontSize: 17,
          fontWeight: FontWeight.w700,
          color: AppColors.textStrong,
        ),
      ),
    );
  }
}
