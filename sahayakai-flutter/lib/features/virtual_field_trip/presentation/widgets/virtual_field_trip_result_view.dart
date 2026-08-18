import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons/lucide_icons.dart';

import '../../../../core/i18n/l10n_ext.dart';
import '../../../../core/i18n/locale_provider.dart';
import '../../../../core/platform/link_opener.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../shared/motion/animated_entrance.dart';
import '../../../../shared/widgets/app_badge.dart';
import '../../../../shared/widgets/document_sheet.dart';
import '../../../../shared/widgets/empty_view.dart';
import '../../../../shared/widgets/read_aloud_button.dart';
import '../../../../shared/widgets/result_actions_bar.dart';
import '../../../../shared/widgets/secondary_button.dart';
import '../../data/virtual_field_trip_repository.dart';
import '../../domain/virtual_field_trip.dart';
import 'field_trip_stop_card.dart';

/// Renders a generated [FieldTrip] as a printed itinerary, not a chat dump.
///
/// A [DocumentSheet] masthead ("VIRTUAL FIELD TRIP" eyebrow, the title, saffron
/// rule, subject / grade / stop-count badges), then a numbered
/// [FieldTripStopCard] per stop, then a Regenerate / Read aloud / Done footer
/// over the shared [ResultActionsBar] (Save to Library / Copy / Share). Each
/// stop inks in on the reveal (reduce-motion degrades to the static frame).
/// Every card opens its stop through the injected [linkOpenerProvider] seam —
/// never a raw `launchUrl`.
class VirtualFieldTripResultView extends ConsumerWidget {
  const VirtualFieldTripResultView({
    super.key,
    required this.trip,
    required this.onRegenerate,
    required this.onDone,
    this.saveRequest,
  });

  final FieldTrip trip;

  /// Re-runs generation from the current form (the controller's `plan`).
  final VoidCallback onRegenerate;

  /// Dismisses the result, returning to the pristine form (the controller's
  /// `clear`).
  final VoidCallback onDone;

  /// The request that produced [trip]. Supplies the topic / grade / language
  /// the `POST /api/content/save` body needs (the model output alone carries no
  /// request topic). When null — or when the trip carries no verbatim
  /// [FieldTrip.raw] to persist — the Save action is withheld and the bar
  /// offers Copy / Share only.
  final VirtualFieldTripRequest? saveRequest;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = context.l10n;

    // Every stop was dropped at decode (a degenerate payload): an empty state the
    // teacher can act on, not a bare masthead.
    if (!trip.hasStops) {
      return EmptyView(
        message: l10n.virtualFieldTripNoStops,
        icon: LucideIcons.globe,
      );
    }

    final opener = ref.read(linkOpenerProvider);

    final revealed = <Widget>[
      for (var i = 0; i < trip.stops.length; i++)
        inkSettle(
          context,
          FieldTripStopCard(
            index: i + 1,
            stop: trip.stops[i],
            onOpenEarth: trip.stops[i].googleEarthUrl == null
                ? null
                : () => opener.open(trip.stops[i].googleEarthUrl!),
          ),
          index: i,
        ),
    ];

    final meta = <Widget>[
      if (trip.gradeLevel.isNotEmpty)
        AppBadge(
          icon: LucideIcons.graduationCap,
          label: trip.gradeLevel,
          tone: AppBadgeTone.accent,
        ),
      if (trip.subject.isNotEmpty)
        AppBadge(icon: LucideIcons.bookOpen, label: trip.subject),
      AppBadge(
        icon: LucideIcons.mapPin,
        label: l10n.virtualFieldTripStopCount(trip.stops.length),
      ),
    ];

    return DocumentSheet(
      docType: l10n.virtualFieldTripDocType,
      title: trip.title,
      meta: meta,
      footer: _ActionBar(
        trip: trip,
        onRegenerate: onRegenerate,
        onDone: onDone,
        spokenText: _tripAsText(trip),
        // FieldTrip carries no language on the result; the current UI locale is
        // the best available signal for the voice (it drove the form's default).
        language: ref.read(localeControllerProvider).code,
        saveRequest: saveRequest,
      ),
      children: revealed,
    );
  }
}

/// A plain-text narration of the itinerary for read-aloud: the title, then each
/// stop's name and its prose fields in visiting order.
String _tripAsText(FieldTrip trip) {
  final b = StringBuffer()..writeln(trip.title);
  for (var i = 0; i < trip.stops.length; i++) {
    final s = trip.stops[i];
    b
      ..writeln()
      ..writeln('${i + 1}. ${s.name}');
    for (final line in [
      s.description,
      s.educationalFact,
      s.reflectionPrompt,
      s.culturalAnalogy,
    ]) {
      if (line.trim().isNotEmpty) b.writeln(line.trim());
    }
  }
  return b.toString().trimRight();
}

/// A plain-text export of the itinerary for Copy and Share. Same body as
/// [_tripAsText] plus each stop's Google Earth link, which is the part a
/// colleague receiving this on WhatsApp actually needs — and exactly the part
/// that must NOT be in the read-aloud text, where a URL is unspeakable noise.
String _tripAsShareText(FieldTrip trip) {
  final b = StringBuffer()..writeln(trip.title);
  final metaBits = [
    trip.gradeLevel,
    trip.subject,
  ].where((s) => s.isNotEmpty).toList();
  if (metaBits.isNotEmpty) b.writeln(metaBits.join(' · '));
  for (var i = 0; i < trip.stops.length; i++) {
    final s = trip.stops[i];
    b
      ..writeln()
      ..writeln('${i + 1}. ${s.name}');
    for (final line in [
      s.description,
      s.educationalFact,
      s.reflectionPrompt,
      s.culturalAnalogy,
    ]) {
      if (line.trim().isNotEmpty) b.writeln(line.trim());
    }
    final url = s.googleEarthUrl;
    if (url != null) b.writeln(url.toString());
  }
  return b.toString().trimRight();
}

/// The itinerary's action bar: Regenerate (secondary), Read aloud and a Done
/// ghost over the shared [ResultActionsBar] — Save to Library / Copy / Share.
/// Done clears the result back to the form; Regenerate re-runs the plan.
class _ActionBar extends ConsumerWidget {
  const _ActionBar({
    required this.trip,
    required this.onRegenerate,
    required this.onDone,
    required this.spokenText,
    this.language,
    this.saveRequest,
  });

  final FieldTrip trip;
  final VoidCallback onRegenerate;
  final VoidCallback onDone;
  final String spokenText;
  final String? language;
  final VirtualFieldTripRequest? saveRequest;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = context.l10n;
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final text = Theme.of(context).textTheme;
    final saffron = isDark ? AppColors.dPrimaryText : AppColors.lPrimaryText;
    final request = saveRequest;
    final canSave = request != null && trip.raw != null;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      mainAxisSize: MainAxisSize.min,
      children: [
        SecondaryButton(
          label: l10n.actionRegenerate,
          icon: LucideIcons.refreshCw,
          onPressed: onRegenerate,
        ),
        const SizedBox(height: AppSpacing.space2),
        ReadAloudButton(text: spokenText, language: language),
        const SizedBox(height: AppSpacing.space2),
        SizedBox(
          height: 48,
          child: TextButton.icon(
            onPressed: onDone,
            icon: const Icon(LucideIcons.check, size: AppIconSize.inline),
            label: Text(l10n.actionDone),
            style: TextButton.styleFrom(
              foregroundColor: saffron,
              textStyle: text.labelLarge,
            ),
          ),
        ),
        const SizedBox(height: AppSpacing.space3),
        ResultActionsBar(
          text: _tripAsShareText(trip),
          shareSubject: trip.title.isEmpty ? null : trip.title,
          saveResetKey: trip,
          onSave: canSave
              ? () => ref
                    .read(virtualFieldTripRepositoryProvider)
                    .save(trip: trip, request: request)
              : null,
        ),
      ],
    );
  }
}
