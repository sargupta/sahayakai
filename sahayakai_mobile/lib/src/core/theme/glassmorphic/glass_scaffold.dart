import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'glass_theme.dart';
import 'glass_buttons.dart';

/// A glassmorphic scaffold with warm gradient background and custom app bar
class GlassScaffold extends StatelessWidget {
  final String title;
  final String? decorativeTitle; // Script/italic label above title
  final Widget body;
  final Widget? floatingActionButton;
  final FloatingActionButtonLocation? floatingActionButtonLocation;
  final List<Widget>? actions;
  final bool showBackButton;
  final VoidCallback? onBackPressed;
  final Widget? bottomNavigationBar;
  final bool extendBody;
  final PreferredSizeWidget? customAppBar;

  const GlassScaffold({
    super.key,
    required this.title,
    this.decorativeTitle,
    required this.body,
    this.floatingActionButton,
    this.floatingActionButtonLocation,
    this.actions,
    this.showBackButton = true,
    this.onBackPressed,
    this.bottomNavigationBar,
    this.extendBody = false,
    this.customAppBar,
  });

  @override
  Widget build(BuildContext context) {
    // Set status bar style
    SystemChrome.setSystemUIOverlayStyle(
      const SystemUiOverlayStyle(
        statusBarColor: Colors.transparent,
        statusBarIconBrightness: Brightness.dark,
        statusBarBrightness: Brightness.light,
      ),
    );

    return Scaffold(
      extendBodyBehindAppBar: true,
      extendBody: extendBody,
      backgroundColor: Colors.transparent,
      appBar: customAppBar ?? _buildAppBar(context),
      body: Stack(
        children: [
          // Background Image
          Positioned.fill(
            child: Image.asset(
              'assets/images/app_background.png',
              fit: BoxFit.cover,
            ),
          ),
          // Main content
          SafeArea(
            bottom: false,
            child: body,
          ),
        ],
      ),
      floatingActionButton: floatingActionButton,
      floatingActionButtonLocation: floatingActionButtonLocation,
      bottomNavigationBar: bottomNavigationBar,
    );
  }

  PreferredSizeWidget _buildAppBar(BuildContext context) {
    return PreferredSize(
      preferredSize: const Size.fromHeight(kToolbarHeight),
      child: Container(
        decoration: const BoxDecoration(
          gradient: GlassColors.warmBackgroundGradient,
        ),
        child: SafeArea(
          bottom: false,
          child: Padding(
            padding: const EdgeInsets.symmetric(
              horizontal: GlassSpacing.lg,
              vertical: GlassSpacing.sm,
            ),
            child: Row(
              children: [
                if (showBackButton)
                  GlassBackButton(onPressed: onBackPressed),
                if (showBackButton) const SizedBox(width: GlassSpacing.md),
                Expanded(
                  child: Text(
                    title,
                    style: GlassTypography.headline2(),
                    textAlign: TextAlign.center,
                  ),
                ),
                if (actions != null) ...actions!,
                if (actions == null && showBackButton)
                  GlassMenuButton(onPressed: () {}),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// A full-screen glassmorphic page with header section
class GlassPage extends StatelessWidget {
  final String title;
  final String? decorativeLabel; // Italic script text above the title
  final Widget body;
  final Widget? floatingActionButton;
  final bool showBackButton;
  final VoidCallback? onBackPressed;
  final List<Widget>? actions;

  const GlassPage({
    super.key,
    required this.title,
    this.decorativeLabel,
    required this.body,
    this.floatingActionButton,
    this.showBackButton = true,
    this.onBackPressed,
    this.actions,
  });

  @override
  Widget build(BuildContext context) {
    return GlassScaffold(
      title: title,
      showBackButton: showBackButton,
      onBackPressed: onBackPressed,
      actions: actions,
      body: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Header Section
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: GlassSpacing.xl),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                if (decorativeLabel != null) ...[
                  Text(
                    decorativeLabel!,
                    style: GlassTypography.decorativeLabel(),
                  ),
                  const SizedBox(height: GlassSpacing.xs),
                ],
                Text(
                  title,
                  style: GlassTypography.headline1(),
                ),
                const SizedBox(height: GlassSpacing.sm),
                Container(
                  width: 60,
                  height: 2,
                  color: GlassColors.textTertiary.withOpacity(0.3),
                ),
              ],
            ),
          ),
          const SizedBox(height: GlassSpacing.xl),
          // Body Content
          Expanded(child: body),
        ],
      ),
      floatingActionButton: floatingActionButton,
      floatingActionButtonLocation: FloatingActionButtonLocation.centerFloat,
    );
  }
}

/// A simple header widget for sections
class GlassHeader extends StatelessWidget {
  final String? decorativeLabel;
  final String title;
  final bool showDivider;

  const GlassHeader({
    super.key,
    this.decorativeLabel,
    required this.title,
    this.showDivider = true,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (decorativeLabel != null) ...[
          Text(
            decorativeLabel!,
            style: GlassTypography.decorativeLabel(),
          ),
          const SizedBox(height: GlassSpacing.xs),
        ],
        Text(title, style: GlassTypography.headline1()),
        if (showDivider) ...[
          const SizedBox(height: GlassSpacing.sm),
          Container(
            width: 60,
            height: 2,
            color: GlassColors.textTertiary.withOpacity(0.3),
          ),
        ],
      ],
    );
  }
}
