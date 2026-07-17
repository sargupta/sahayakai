import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons/lucide_icons.dart';

import '../../../core/i18n/l10n_ext.dart';
import '../../../core/router/routes.dart';
import '../../../core/theme/app_theme.dart';
import '../../library/presentation/library_screen.dart';
import '../../profile/presentation/profile_screen.dart';
import 'dashboard_screen.dart';

/// The signed-in shell: a Material 3 [NavigationBar] with 4 tabs
/// (Home / Create / Library / Me). "Create" is an action — it opens the
/// command-palette sheet (placeholder here) rather than switching tabs, so the
/// selected index never lands on it. See THEME_SPEC §5.5.
///
/// TODO(P1.8): swap the placeholder sheet for the searchable create palette.
/// A later unit can convert this to a StatefulShellRoute for deep-linkable tabs.
class AppShell extends StatefulWidget {
  const AppShell({super.key});

  @override
  State<AppShell> createState() => _AppShellState();
}

class _AppShellState extends State<AppShell> {
  int _index = 0;

  static const _createIndex = 1;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;

    // index 1 (Create) is an action, so its stack slot is never shown.
    final pages = <Widget>[
      const DashboardScreen(),
      const SizedBox.shrink(),
      const LibraryScreen(),
      const ProfileScreen(),
    ];

    return Scaffold(
      body: IndexedStack(index: _index, children: pages),
      bottomNavigationBar: DecoratedBox(
        decoration: BoxDecoration(
          border: Border(
            top: BorderSide(
              color: Theme.of(context).colorScheme.outline,
              width: 1,
            ),
          ),
        ),
        child: NavigationBar(
          selectedIndex: _index,
          onDestinationSelected: _onSelect,
          destinations: [
            NavigationDestination(
              icon: const Icon(LucideIcons.home),
              label: l10n.navHome,
            ),
            NavigationDestination(
              icon: const Icon(LucideIcons.sparkles),
              label: l10n.navCreate,
            ),
            NavigationDestination(
              icon: const Icon(LucideIcons.library),
              label: l10n.navLibrary,
            ),
            NavigationDestination(
              icon: const Icon(LucideIcons.user),
              label: l10n.navProfile,
            ),
          ],
        ),
      ),
    );
  }

  void _onSelect(int index) {
    if (index == _createIndex) {
      _openCreatePalette();
      return;
    }
    setState(() => _index = index);
  }

  Future<void> _openCreatePalette() async {
    await showModalBottomSheet<void>(
      context: context,
      showDragHandle: true,
      builder: (sheetContext) {
        final l10n = sheetContext.l10n;
        final text = Theme.of(sheetContext).textTheme;
        return SafeArea(
          child: Padding(
            padding: const EdgeInsets.symmetric(vertical: AppSpacing.space4),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Padding(
                  padding: const EdgeInsets.symmetric(
                    horizontal: AppSpacing.space6,
                  ),
                  child: Text(l10n.navCreate, style: text.titleMedium),
                ),
                const SizedBox(height: AppSpacing.space2),
                ListTile(
                  leading: const Icon(LucideIcons.bookOpen),
                  title: Text(l10n.lessonPlanTitle),
                  subtitle: Text(l10n.lessonPlanSubtitle),
                  onTap: () {
                    Navigator.of(sheetContext).pop();
                    context.push(Routes.lessonPlan);
                  },
                ),
                ListTile(
                  leading: const Icon(LucideIcons.clipboardList),
                  title: Text(l10n.quizTitle),
                  subtitle: Text(l10n.quizSubtitle),
                  onTap: () {
                    Navigator.of(sheetContext).pop();
                    context.push(Routes.quizGenerator);
                  },
                ),
                ListTile(
                  leading: const Icon(LucideIcons.messageSquare),
                  title: Text(l10n.instantAnswerTitle),
                  subtitle: Text(l10n.instantAnswerSubtitle),
                  onTap: () {
                    Navigator.of(sheetContext).pop();
                    context.push(Routes.instantAnswer);
                  },
                ),
                ListTile(
                  leading: const Icon(LucideIcons.fileText),
                  title: Text(l10n.worksheetTitle),
                  subtitle: Text(l10n.worksheetSubtitle),
                  onTap: () {
                    Navigator.of(sheetContext).pop();
                    context.push(Routes.worksheetWizard);
                  },
                ),
                ListTile(
                  leading: const Icon(LucideIcons.clipboardCheck),
                  title: Text(l10n.rubricTitle),
                  subtitle: Text(l10n.rubricSubtitle),
                  onTap: () {
                    Navigator.of(sheetContext).pop();
                    context.push(Routes.rubricGenerator);
                  },
                ),
                ListTile(
                  leading: const Icon(LucideIcons.scrollText),
                  title: Text(l10n.examPaperTitle),
                  subtitle: Text(l10n.examPaperSubtitle),
                  onTap: () {
                    Navigator.of(sheetContext).pop();
                    context.push(Routes.examPaper);
                  },
                ),
              ],
            ),
          ),
        );
      },
    );
  }
}
