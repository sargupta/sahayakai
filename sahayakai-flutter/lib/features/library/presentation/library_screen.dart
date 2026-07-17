import 'package:flutter/material.dart';
import 'package:lucide_icons/lucide_icons.dart';

import '../../../core/i18n/l10n_ext.dart';
import '../../../shared/widgets/empty_view.dart';

/// My Library placeholder — shows the empty state until the library list API
/// is wired (P1.7). Type filters + saved generations land there.
class LibraryScreen extends StatelessWidget {
  const LibraryScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text(context.l10n.libraryTitle)),
      body: SafeArea(
        child: EmptyView(
          message: context.l10n.libraryEmpty,
          icon: LucideIcons.library,
        ),
      ),
    );
  }
}
