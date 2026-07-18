import 'package:flutter/material.dart';

import '../../core/theme/app_theme.dart';
import 'app_card.dart';

/// DocumentSheet (PREMIUM_DESIGN_SPEC.md §5). The premium payoff: a generated
/// artifact reads like a printed document, not a chat dump. An
/// `AppCard(elevated)` (radius 16, `e2`, 3px saffron accent bar) constrained to
/// a 640dp reading column, with a masthead (saffron eyebrow doc-type, Fraunces
/// title, a 2px saffron→transparent rule, meta badges), the body [children]
/// (compose [DocumentSheetSection]s), and an optional sticky [footer] action
/// bar.
///
/// The Ink-settle reveal is applied by the hosting screen (U4/U8); this widget
/// is the static composition.
class DocumentSheet extends StatelessWidget {
  const DocumentSheet({
    super.key,
    required this.docType,
    required this.title,
    required this.children,
    this.meta = const [],
    this.footer,
    this.maxWidth = 640,
  });

  final String docType;
  final String title;
  final List<Widget> children;
  final List<Widget> meta;
  final Widget? footer;
  final double maxWidth;

  @override
  Widget build(BuildContext context) {
    final text = Theme.of(context).textTheme;
    final extras = AppTextExtras.of(context);
    final width = MediaQuery.maybeOf(context)?.size.width ?? 0;
    final pad = width >= 600 ? AppSpacing.space8 : AppSpacing.space6; // 32 / 24
    final docTypeLabel = _hasNonLatin(docType) ? docType : docType.toUpperCase();

    final body = <Widget>[];
    for (var i = 0; i < children.length; i++) {
      if (i > 0) body.add(const SizedBox(height: AppSpacing.space6));
      body.add(children[i]);
    }

    return Center(
      child: ConstrainedBox(
        constraints: BoxConstraints(maxWidth: maxWidth),
        child: AppCard(
          variant: AppCardVariant.elevated,
          accentBar: true,
          padding: EdgeInsets.all(pad),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              // Masthead
              Text(docTypeLabel, style: extras.eyebrow),
              const SizedBox(height: AppSpacing.space2),
              Text(title, style: text.displaySmall),
              const SizedBox(height: AppSpacing.space3),
              const SizedBox(
                height: 2,
                child: DecoratedBox(
                  decoration: BoxDecoration(gradient: AppGradients.accentBar),
                ),
              ),
              if (meta.isNotEmpty) ...[
                const SizedBox(height: AppSpacing.space3),
                Wrap(
                  spacing: AppSpacing.space2,
                  runSpacing: AppSpacing.space2,
                  children: meta,
                ),
              ],
              const SizedBox(height: AppSpacing.space6),
              ...body,
              if (footer != null) ...[
                const SizedBox(height: AppSpacing.space6),
                footer!,
              ],
            ],
          ),
        ),
      ),
    );
  }
}

/// A section inside a [DocumentSheet]: a `titleSmall` UPPERCASE (Latin) heading
/// preceded by a 4dp saffron tick, then the section body.
class DocumentSheetSection extends StatelessWidget {
  const DocumentSheetSection({
    super.key,
    required this.title,
    required this.child,
  });

  final String title;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final text = Theme.of(context).textTheme;
    final saffron = isDark ? AppColors.dPrimaryText : AppColors.lPrimaryText;
    final heading = _hasNonLatin(title) ? title : title.toUpperCase();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 4,
              height: 14,
              decoration: BoxDecoration(
                color: saffron,
                borderRadius: AppRadius.rSm,
              ),
            ),
            const SizedBox(width: AppSpacing.space2),
            Flexible(
              child: Text(
                heading,
                style: text.titleSmall?.copyWith(letterSpacing: 0.6),
              ),
            ),
          ],
        ),
        const SizedBox(height: AppSpacing.space3),
        child,
      ],
    );
  }
}

bool _hasNonLatin(String s) => s.runes.any((r) => r > 0x24F);
