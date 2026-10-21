import 'package:flutter/material.dart';
import 'package:lucide_icons/lucide_icons.dart';

import '../../../../core/i18n/l10n_ext.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../shared/widgets/ai_text.dart';
import '../../../../shared/widgets/app_card.dart';
import '../../../../shared/widgets/note_banner.dart';
import '../../../../shared/widgets/secondary_button.dart';
import '../../../../shared/widgets/section_label.dart';
import '../../domain/virtual_field_trip.dart';

/// One numbered stop on the itinerary, as a document card.
///
/// A WHITE `AppCard(flat)` (NOT an `inset` tint) led by a saffron numeral
/// medallion, then the stop name, the description, an educational-fact highlight
/// (a tinted [NoteBanner]), a reflection-prompt quiet inset, the Bharat-First
/// cultural analogy and the pedagogical explanation, and — when the model gave a
/// safe URL — an "Open in Google Earth" action.
///
/// AA (the hard rule): the card's WHITE `surface` is the safe ground — muted
/// `onSurfaceVariant` section labels clear 4.5:1 there (4.67:1), the trap they
/// would fall into on a `surfaceContainer*` tint (< 4.5). The two TINTED insets
/// each keep their text in FULL ink (`onSurface`), which clears AA on their
/// fills: the fact banner's `surfaceContainerHigh` (~14:1) and the reflection
/// inset's `surfaceContainerLow` (~14:1). Nothing muted ever sits on a tint.
///
/// Every prose field flows through [AiText] (line-height 1.7, Indic height
/// behaviour) so matras and vowel signs never clip and long compound words wrap.
class FieldTripStopCard extends StatelessWidget {
  const FieldTripStopCard({
    super.key,
    required this.index,
    required this.stop,
    this.onOpenEarth,
  });

  /// The 1-based stop number shown in the medallion.
  final int index;

  final FieldTripStop stop;

  /// Opens [FieldTripStop.googleEarthUrl] outside the app. Injected (never a raw
  /// `launchUrl`) so a widget test fakes it. Null when the stop carried no safe
  /// URL — the card then omits the launch action entirely.
  final VoidCallback? onOpenEarth;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final text = Theme.of(context).textTheme;

    return Semantics(
      label: l10n.virtualFieldTripStopSemantics(index, stop.name),
      child: AppCard(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            // Header: saffron numeral medallion + stop name (wraps at scale).
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                _StopMedallion(index: index),
                const SizedBox(width: AppSpacing.space3),
                Expanded(
                  child: Padding(
                    padding: const EdgeInsets.only(top: AppSpacing.space1),
                    child: Text(stop.name, style: text.titleMedium),
                  ),
                ),
              ],
            ),
            if (stop.description.isNotEmpty) ...[
              const SizedBox(height: AppSpacing.space3),
              AiText(stop.description),
            ],
            // Educational fact — a tinted "wow" highlight. NoteBanner keeps its
            // label + body in full ink on the surfaceContainerHigh fill (AA ✓).
            if (stop.educationalFact.isNotEmpty) ...[
              const SizedBox(height: AppSpacing.space4),
              NoteBanner(
                icon: LucideIcons.sparkles,
                label: l10n.virtualFieldTripFactLabel,
                body: stop.educationalFact,
              ),
            ],
            // Reflection prompt — a distinct quiet inset (recessed, not tinted
            // like the fact banner). Full-ink text clears AA on the inset fill.
            if (stop.reflectionPrompt.isNotEmpty) ...[
              const SizedBox(height: AppSpacing.space3),
              _ReflectionInset(prompt: stop.reflectionPrompt),
            ],
            // Bharat-First cultural analogy + pedagogical explanation, each a
            // muted section label (AA-safe on the white card surface) + AiText.
            if (stop.culturalAnalogy.isNotEmpty) ...[
              const SizedBox(height: AppSpacing.space4),
              SectionLabel(
                l10n.virtualFieldTripAnalogyLabel,
                icon: LucideIcons.mapPin,
              ),
              const SizedBox(height: AppSpacing.space2),
              AiText(stop.culturalAnalogy),
            ],
            if (stop.explanation.isNotEmpty) ...[
              const SizedBox(height: AppSpacing.space4),
              SectionLabel(
                l10n.virtualFieldTripExplanationLabel,
                icon: LucideIcons.graduationCap,
              ),
              const SizedBox(height: AppSpacing.space2),
              AiText(stop.explanation),
            ],
            if (onOpenEarth != null) ...[
              const SizedBox(height: AppSpacing.space4),
              Semantics(
                button: true,
                hint: l10n.virtualFieldTripOpensExternally,
                child: SecondaryButton(
                  label: l10n.virtualFieldTripOpenEarth,
                  icon: LucideIcons.globe,
                  onPressed: onOpenEarth,
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

/// The saffron numeral medallion that numbers a stop — the primary-container
/// tint with its AA-fixed `onPrimaryContainer` label (6.9:1 light / 9.5:1 dark).
class _StopMedallion extends StatelessWidget {
  const _StopMedallion({required this.index});

  final int index;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final text = Theme.of(context).textTheme;
    return Container(
      width: 32,
      height: 32,
      alignment: Alignment.center,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        color: scheme.primaryContainer,
      ),
      child: Text(
        '$index',
        style: text.labelLarge?.copyWith(
          color: scheme.onPrimaryContainer,
          fontWeight: FontWeight.w700,
        ),
      ),
    );
  }
}

/// The reflection prompt as a distinct quiet inset: a recessed
/// `AppCard(inset)` (surfaceContainerLow) whose label + question stay in FULL ink
/// (`onSurface`) so they clear AA on the tinted fill — never the muted role the
/// hard rule bans on a `surfaceContainer*` tint. Visually distinct from the fact
/// banner (recession vs highlight), so the two insets never read as the same
/// element.
class _ReflectionInset extends StatelessWidget {
  const _ReflectionInset({required this.prompt});

  final String prompt;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final scheme = Theme.of(context).colorScheme;
    final text = Theme.of(context).textTheme;
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final saffron = isDark ? AppColors.dPrimaryText : AppColors.lPrimaryText;

    return AppCard(
      variant: AppCardVariant.inset,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          Row(
            children: [
              // Saffron glyph — non-text, and saffron-700 clears 3:1 on the fill.
              Icon(
                LucideIcons.helpCircle,
                size: AppIconSize.inline,
                color: saffron,
              ),
              const SizedBox(width: AppSpacing.space2),
              Flexible(
                child: Text(
                  l10n.virtualFieldTripReflectionLabel,
                  // Full ink, NOT onSurfaceVariant: this label sits on the
                  // surfaceContainerLow inset fill, where the muted role fails AA.
                  style: text.titleSmall?.copyWith(color: scheme.onSurface),
                ),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.space2),
          // AiText defaults to onSurface (full ink) — AA-safe on the inset fill.
          AiText(prompt),
        ],
      ),
    );
  }
}
