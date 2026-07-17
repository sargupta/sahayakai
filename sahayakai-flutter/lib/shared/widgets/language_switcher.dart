import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons/lucide_icons.dart';

import '../../core/i18n/app_locale.dart';
import '../../core/i18n/l10n_ext.dart';
import '../../core/i18n/locale_provider.dart';
import '../../core/theme/app_theme.dart';

/// One switcher, two consumers: picking a language changes BOTH the UI locale
/// and the AI `language` param (via [AppLocale.aiName]). All 11 languages are
/// first-class here — never Hindi-only. See DESIGN_RUBRIC §10.
class LanguageSwitcher extends ConsumerWidget {
  const LanguageSwitcher({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final current = ref.watch(localeControllerProvider);
    return ListTile(
      leading: const Icon(LucideIcons.languages),
      title: Text(context.l10n.languageLabel),
      subtitle: Text(current.nativeLabel),
      trailing: const Icon(LucideIcons.chevronRight, size: 20),
      onTap: () => _openPicker(context, ref, current),
    );
  }

  Future<void> _openPicker(
    BuildContext context,
    WidgetRef ref,
    AppLocale current,
  ) async {
    await showModalBottomSheet<void>(
      context: context,
      showDragHandle: true,
      isScrollControlled: true,
      builder: (sheetContext) {
        return SafeArea(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Padding(
                padding: const EdgeInsets.fromLTRB(
                  AppSpacing.space4,
                  AppSpacing.space2,
                  AppSpacing.space4,
                  AppSpacing.space2,
                ),
                child: Text(
                  sheetContext.l10n.languageLabel,
                  style: Theme.of(sheetContext).textTheme.titleMedium,
                ),
              ),
              Flexible(
                child: RadioGroup<AppLocale>(
                  groupValue: current,
                  onChanged: (value) {
                    if (value != null) {
                      ref
                          .read(localeControllerProvider.notifier)
                          .set(value);
                    }
                    Navigator.of(sheetContext).pop();
                  },
                  child: ListView(
                    shrinkWrap: true,
                    children: [
                      for (final locale in AppLocale.values)
                        RadioListTile<AppLocale>(
                          value: locale,
                          title: Text(locale.nativeLabel),
                          subtitle: Text(locale.aiName),
                        ),
                    ],
                  ),
                ),
              ),
            ],
          ),
        );
      },
    );
  }
}
