import 'package:flutter/material.dart';

import '../../core/theme/app_theme.dart';

/// EditorialSectionHeader (PREMIUM_DESIGN_SPEC.md §3.4 / §5). The register that
/// opens every group: a saffron [eyebrow] (tracked, UPPERCASE for Latin only —
/// unicameral Indic scripts lean on tracking + saffron) followed by a 1px
/// `outlineVariant` hairline rule running to the right margin.
class EditorialSectionHeader extends StatelessWidget {
  const EditorialSectionHeader(this.eyebrow, {super.key, this.rule = true});

  final String eyebrow;

  /// Whether to draw the trailing hairline rule (default true).
  final bool rule;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final extras = AppTextExtras.of(context);
    // UPPERCASE Latin only; leave Indic untouched.
    final label = _hasNonLatin(eyebrow) ? eyebrow : eyebrow.toUpperCase();

    return Row(
      crossAxisAlignment: CrossAxisAlignment.center,
      children: [
        Flexible(child: Text(label, style: extras.eyebrow)),
        if (rule) ...[
          const SizedBox(width: AppSpacing.space3),
          Expanded(
            child: Container(height: 1, color: scheme.outlineVariant),
          ),
        ],
      ],
    );
  }
}

bool _hasNonLatin(String s) => s.runes.any((r) => r > 0x24F);
