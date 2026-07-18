import 'package:flutter/material.dart';

import '../../core/theme/app_theme.dart';
import '../../features/vidya/presentation/vidya_sheet.dart';
import 'primary_button.dart';

/// Every AI tool page's shell: surface AppBar + a scrolling form capped at
/// 640dp (so it never stretches edge-to-edge on tablets) + an optional sticky
/// Generate button above the gesture inset. See ARCHITECTURE §9.1.
///
/// The app bar carries the VIDYA co-teacher action by default ([vidyaAction]),
/// so VIDYA is reachable from every tool screen ("on every page", U-V7) without
/// leaving the task; pass `vidyaAction: false` to opt a scaffold out.
class ToolScaffold extends StatelessWidget {
  const ToolScaffold({
    super.key,
    required this.title,
    required this.child,
    this.result,
    this.onSubmit,
    this.submitLabel,
    this.isBusy = false,
    this.vidyaAction = true,
  });

  final String title;
  final Widget child;
  final Widget? result;
  final VoidCallback? onSubmit;
  final String? submitLabel;
  final bool isBusy;

  /// Whether the app bar shows the VIDYA co-teacher action (default true).
  final bool vidyaAction;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      resizeToAvoidBottomInset: true,
      appBar: AppBar(
        title: Text(title),
        actions: [if (vidyaAction) const VidyaAppBarAction()],
      ),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: AppSpacing.pagePadding,
          child: Align(
            alignment: Alignment.topCenter,
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 640),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  child,
                  if (result != null) ...[
                    const SizedBox(height: AppSpacing.sectionGap),
                    result!,
                  ],
                ],
              ),
            ),
          ),
        ),
      ),
      bottomNavigationBar: onSubmit == null
          ? null
          : SafeArea(
              child: Padding(
                padding: AppSpacing.pagePadding,
                child: PrimaryButton(
                  label: submitLabel ?? 'Generate',
                  onPressed: isBusy ? null : onSubmit,
                  isBusy: isBusy,
                ),
              ),
            ),
    );
  }
}
