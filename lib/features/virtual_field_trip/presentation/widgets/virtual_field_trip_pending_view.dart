import 'package:flutter/material.dart';
import 'package:lucide_icons/lucide_icons.dart';

import '../../../../core/i18n/l10n_ext.dart';
import '../../../../shared/widgets/empty_view.dart';

/// The calm panel for the benign 202 `still_generating` outcome.
///
/// When the dispatcher's 45s budget elapses the trip keeps generating
/// server-side and saves to My Library, so this is a "come back later" state,
/// NOT a failure. It renders as a haloed [EmptyView] (the same calm idiom the
/// idle/empty states use), never the red [ErrorView] — a teacher whose trip is
/// safely saving must not see an alarm.
///
/// The copy is localized chrome (per the 11-language rule): the server's English
/// `message` is decoded and carried on [FieldTripStillGenerating], but a Tamil or
/// Bengali teacher reads the panel in their own language here.
class VirtualFieldTripPendingView extends StatelessWidget {
  const VirtualFieldTripPendingView({super.key});

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    return EmptyView(
      icon: LucideIcons.compass,
      title: l10n.virtualFieldTripPendingTitle,
      message: l10n.virtualFieldTripPendingBody,
    );
  }
}
