import 'package:flutter/material.dart';
import 'package:lucide_icons/lucide_icons.dart';

import '../../core/i18n/l10n_ext.dart';
import '../../core/theme/app_theme.dart';
import '../motion/animated_entrance.dart';
import 'map_card.dart';

/// The fields a tool takes that its UX map screen leaves out (language,
/// difficulty, a reference photo…), folded into one card under the map's own
/// fields: "More options", closed until the teacher opens it. Nothing the
/// server can use is lost, and the page reads as the map draws it.
///
/// [summary] names what is set inside ("English · Standard"), so a closed
/// card still says what will be used.
class MapMoreOptions extends StatefulWidget {
  const MapMoreOptions({
    super.key,
    required this.children,
    this.summary,
    this.initiallyOpen = false,
    this.dark = false,
  });

  /// Drawn for the map's dark scanner.
  final bool dark;

  final List<Widget> children;
  final String? summary;
  final bool initiallyOpen;

  @override
  State<MapMoreOptions> createState() => _MapMoreOptionsState();
}

class _MapMoreOptionsState extends State<MapMoreOptions> {
  late bool _open = widget.initiallyOpen;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final text = Theme.of(context).textTheme;
    final motion = context.motionEnabled;
    final summary = widget.summary;
    final toggle = l10n.toolMoreOptions;
    final dark = widget.dark;
    final body = Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      mainAxisSize: MainAxisSize.min,
      children: [
        Semantics(
          button: true,
          expanded: _open,
          label: toggle,
          value: summary,
          excludeSemantics: true,
          onTap: () => setState(() => _open = !_open),
          child: InkWell(
            onTap: () => setState(() => _open = !_open),
            child: ConstrainedBox(
              constraints: const BoxConstraints(minHeight: 52),
              child: Padding(
                padding: const EdgeInsets.symmetric(
                  horizontal: 14,
                  vertical: 12,
                ),
                child: Row(
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Text(
                            toggle,
                            style: text.bodyLarge?.copyWith(
                              fontWeight: FontWeight.w700,
                              color: dark
                                  ? AppColors.scanInk
                                  : AppColors.textStrong,
                            ),
                          ),
                          if (summary != null && summary.isNotEmpty)
                            Text(
                              summary,
                              style: text.bodySmall?.copyWith(
                                color: dark
                                    ? AppColors.scanMuted
                                    : AppColors.textMuted,
                              ),
                            ),
                        ],
                      ),
                    ),
                    AnimatedRotation(
                      turns: _open ? 0.25 : 0,
                      duration: motion ? AppMotion.small : Duration.zero,
                      child: Icon(
                        LucideIcons.chevronRight,
                        size: 16,
                        color: dark ? AppColors.scanMuted : AppColors.textMuted,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
        // Kept mounted while closed, so form fields inside keep their state
        // and still take part in validation.
        AnimatedSize(
          duration: motion ? AppMotion.medium : Duration.zero,
          curve: AppMotion.easeOutQuart,
          alignment: Alignment.topCenter,
          child: Offstage(
            offstage: !_open,
            child: Padding(
              padding: const EdgeInsets.fromLTRB(14, 0, 14, 16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                mainAxisSize: MainAxisSize.min,
                children: [
                  for (final (i, child) in widget.children.indexed) ...[
                    if (i > 0) const SizedBox(height: AppSpacing.space4),
                    child,
                  ],
                ],
              ),
            ),
          ),
        ),
      ],
    );
    if (!dark) return MapCard(padding: EdgeInsets.zero, child: body);
    return ClipRRect(
      borderRadius: AppRadius.rCard,
      child: ColoredBox(
        color: AppColors.scanControl,
        child: Material(type: MaterialType.transparency, child: body),
      ),
    );
  }
}
