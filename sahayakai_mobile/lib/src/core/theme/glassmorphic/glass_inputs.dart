import 'package:flutter/material.dart';
import 'glass_theme.dart';

/// A glassmorphic text input field with optional trailing icon
class GlassTextField extends StatelessWidget {
  final TextEditingController? controller;
  final String? hintText;
  final String? labelText;
  final Widget? suffixIcon;
  final Widget? prefixIcon;
  final int maxLines;
  final bool enabled;
  final ValueChanged<String>? onChanged;
  final VoidCallback? onTap;
  final bool readOnly;
  final TextInputType? keyboardType;

  const GlassTextField({
    super.key,
    this.controller,
    this.hintText,
    this.labelText,
    this.suffixIcon,
    this.prefixIcon,
    this.maxLines = 1,
    this.enabled = true,
    this.onChanged,
    this.onTap,
    this.readOnly = false,
    this.keyboardType,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (labelText != null) ...[
          Text(
            labelText!.toUpperCase(),
            style: GlassTypography.sectionHeader(),
          ),
          const SizedBox(height: GlassSpacing.sm),
        ],
        Container(
          decoration: BoxDecoration(
            color: GlassColors.inputBackground,
            borderRadius: GlassRadius.inputRadius,
            border: Border.all(
              color: GlassColors.inputBorder,
              width: 1,
            ),
          ),
          child: TextField(
            controller: controller,
            maxLines: maxLines,
            enabled: enabled,
            onChanged: onChanged,
            onTap: onTap,
            readOnly: readOnly,
            keyboardType: keyboardType,
            style: GlassTypography.bodyLarge(),
            decoration: InputDecoration(
              hintText: hintText,
              hintStyle: GlassTypography.bodyLarge(
                color: GlassColors.textTertiary,
              ),
              border: InputBorder.none,
              contentPadding: const EdgeInsets.symmetric(
                horizontal: GlassSpacing.lg,
                vertical: GlassSpacing.md,
              ),
              suffixIcon: suffixIcon,
              prefixIcon: prefixIcon,
            ),
          ),
        ),
      ],
    );
  }
}

/// A glassmorphic dropdown selector
class GlassDropdown<T> extends StatelessWidget {
  final String? labelText;
  final T? value;
  final List<DropdownMenuItem<T>> items;
  final ValueChanged<T?>? onChanged;
  final String? hintText;

  const GlassDropdown({
    super.key,
    this.labelText,
    this.value,
    required this.items,
    this.onChanged,
    this.hintText,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (labelText != null) ...[
          Text(
            labelText!.toUpperCase(),
            style: GlassTypography.sectionHeader(),
          ),
          const SizedBox(height: GlassSpacing.sm),
        ],
        Container(
          padding: const EdgeInsets.symmetric(
            horizontal: GlassSpacing.lg,
            vertical: GlassSpacing.xs,
          ),
          decoration: BoxDecoration(
            color: GlassColors.inputBackground,
            borderRadius: GlassRadius.inputRadius,
            border: Border.all(
              color: GlassColors.inputBorder,
              width: 1,
            ),
          ),
          child: DropdownButtonHideUnderline(
            child: DropdownButton<T>(
              value: value,
              items: items,
              onChanged: onChanged,
              isExpanded: true,
              hint: hintText != null
                  ? Text(
                      hintText!,
                      style: GlassTypography.bodyLarge(
                        color: GlassColors.textTertiary,
                      ),
                    )
                  : null,
              style: GlassTypography.bodyLarge(),
              icon: Icon(
                Icons.keyboard_arrow_down_rounded,
                color: GlassColors.textSecondary,
              ),
              dropdownColor: GlassColors.cardBackground,
              borderRadius: GlassRadius.inputRadius,
            ),
          ),
        ),
      ],
    );
  }
}

/// A glassmorphic toggle switch with label and description
class GlassSwitch extends StatelessWidget {
  final String title;
  final String? description;
  final bool value;
  final ValueChanged<bool>? onChanged;

  const GlassSwitch({
    super.key,
    required this.title,
    this.description,
    required this.value,
    this.onChanged,
  });

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(title, style: GlassTypography.labelLarge()),
              if (description != null) ...[
                const SizedBox(height: 2),
                Text(
                  description!,
                  style: GlassTypography.bodySmall(
                    color: GlassColors.textTertiary,
                  ),
                ),
              ],
            ],
          ),
        ),
        const SizedBox(width: GlassSpacing.md),
        Switch(
          value: value,
          onChanged: onChanged,
          activeColor: GlassColors.switchActive,
          activeTrackColor: GlassColors.switchTrackActive,
          inactiveThumbColor: Colors.white,
          inactiveTrackColor: GlassColors.switchTrackInactive,
          trackOutlineColor: WidgetStateProperty.all(Colors.transparent),
        ),
      ],
    );
  }
}

/// A chip selector for multiple options (like question types)
class GlassChipGroup extends StatelessWidget {
  final String? labelText;
  final List<String> options;
  final Set<String> selectedOptions;
  final ValueChanged<String>? onToggle;
  final bool multiSelect;

  const GlassChipGroup({
    super.key,
    this.labelText,
    required this.options,
    required this.selectedOptions,
    this.onToggle,
    this.multiSelect = true,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (labelText != null) ...[
          Text(
            labelText!.toUpperCase(),
            style: GlassTypography.sectionHeader(),
          ),
          const SizedBox(height: GlassSpacing.md),
        ],
        Wrap(
          spacing: GlassSpacing.sm,
          runSpacing: GlassSpacing.sm,
          children: options.map((option) {
            final isSelected = selectedOptions.contains(option);
            return GlassChip(
              label: option,
              isSelected: isSelected,
              onTap: () => onToggle?.call(option),
            );
          }).toList(),
        ),
      ],
    );
  }
}

/// Individual chip widget
class GlassChip extends StatelessWidget {
  final String label;
  final bool isSelected;
  final VoidCallback? onTap;
  final IconData? icon;

  const GlassChip({
    super.key,
    required this.label,
    this.isSelected = false,
    this.onTap,
    this.icon,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        padding: const EdgeInsets.symmetric(
          horizontal: GlassSpacing.lg,
          vertical: GlassSpacing.sm,
        ),
        decoration: BoxDecoration(
          color: isSelected ? GlassColors.chipSelected : GlassColors.chipUnselected,
          borderRadius: GlassRadius.chipRadius,
          border: Border.all(
            color: isSelected ? GlassColors.chipSelected : GlassColors.chipBorder,
            width: 1,
          ),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            if (icon != null) ...[
              Icon(
                icon,
                size: 16,
                color: isSelected ? Colors.white : GlassColors.textPrimary,
              ),
              const SizedBox(width: GlassSpacing.xs),
            ],
            Text(
              label,
              style: GlassTypography.labelMedium(
                color: isSelected ? Colors.white : GlassColors.textPrimary,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
