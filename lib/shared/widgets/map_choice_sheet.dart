import 'package:flutter/material.dart';
import 'package:lucide_icons/lucide_icons.dart';

import '../../core/theme/app_theme.dart';

/// A picked option. Wrapped so "Not set" (a null value) is distinguishable
/// from dismissing the sheet (a null result).
class MapChoice<T> {
  const MapChoice(this.value);

  final T value;
}

/// One choice from a list, as a bottom sheet of rows with a leaf check on the
/// current one: what a map selector (`.sel`) opens.
Future<MapChoice<T>?> showMapChoiceSheet<T>(
  BuildContext context, {
  required String title,
  required T selected,
  required List<(T, String)> options,
}) {
  return showModalBottomSheet<MapChoice<T>>(
    context: context,
    showDragHandle: true,
    isScrollControlled: true,
    builder: (sheetContext) {
      final text = Theme.of(sheetContext).textTheme;
      return SafeArea(
        child: ConstrainedBox(
          constraints: BoxConstraints(
            maxHeight: MediaQuery.sizeOf(sheetContext).height * 0.8,
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Padding(
                padding: const EdgeInsets.fromLTRB(
                  AppSpacing.mapGutter,
                  0,
                  AppSpacing.mapGutter,
                  AppSpacing.space2,
                ),
                child: Text(
                  title,
                  style: text.displayLarge?.copyWith(
                    fontSize: 19,
                    color: AppColors.textStrong,
                  ),
                ),
              ),
              Flexible(
                child: ListView(
                  shrinkWrap: true,
                  padding: const EdgeInsets.only(bottom: AppSpacing.space4),
                  children: [
                    for (final (value, label) in options)
                      Semantics(
                        button: true,
                        selected: value == selected,
                        child: InkWell(
                          onTap: () => Navigator.of(
                            sheetContext,
                          ).pop(MapChoice<T>(value)),
                          child: ConstrainedBox(
                            constraints: const BoxConstraints(minHeight: 48),
                            child: Padding(
                              padding: const EdgeInsets.symmetric(
                                horizontal: AppSpacing.mapGutter,
                                vertical: AppSpacing.space3,
                              ),
                              child: Row(
                                children: [
                                  Expanded(
                                    child: Text(
                                      label,
                                      style: text.bodyLarge?.copyWith(
                                        fontSize: 14,
                                        fontWeight: value == selected
                                            ? FontWeight.w700
                                            : FontWeight.w400,
                                        color: AppColors.textStrong,
                                      ),
                                    ),
                                  ),
                                  if (value == selected)
                                    const Icon(
                                      LucideIcons.check,
                                      size: 18,
                                      color: AppColors.leaf500,
                                    ),
                                ],
                              ),
                            ),
                          ),
                        ),
                      ),
                  ],
                ),
              ),
            ],
          ),
        ),
      );
    },
  );
}
