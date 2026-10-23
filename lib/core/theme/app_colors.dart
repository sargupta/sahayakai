import 'package:flutter/material.dart';

/// SahayakAI Color Tokens — Design System v3 (canonical, Oct 2026).
///
/// "Warm milk and saffron. The grounds are off-whites (--milk-*),
/// the text is warm near-black and taupe (--ink-*, never pure black or grey),
/// and saffron #C96A28 is the one brand accent.
/// Two supporting hues carry meaning: leaf green for selected/done/ready,
/// and indigo for working/curriculum/NCERT.
/// Red and amber appear only as small status dots."
///
/// All values extracted from design_zip/tokens/colors.css and
/// pixel-verified from SahayakAI Mobile v3.dc.html swatches.
class AppColors {
  AppColors._();

  // =========================================================================
  // MILK — warm off-white grounds
  // =========================================================================
  static const Color milk50 = Color(0xFFFFFDF9);   // card / sheet surface
  static const Color milk100 = Color(0xFFFFF8F0);  // on-saffron text, warm white
  static const Color milk200 = Color(0xFFFBF8F3);  // website page ground
  static const Color milk300 = Color(0xFFFBF6EE);  // inset field / context card
  static const Color milk400 = Color(0xFFF6F1E9);  // website band
  static const Color milk500 = Color(0xFFF4F2ED);  // app canvas ground

  // =========================================================================
  // INK — warm near-black + taupe greys
  // =========================================================================
  static const Color ink900 = Color(0xFF171310);   // text-strong
  static const Color ink800 = Color(0xFF1B1713);
  static const Color ink600 = Color(0xFF5C534A);   // text-body
  static const Color ink500 = Color(0xFF6E655C);   // text-muted
  static const Color ink400 = Color(0xFF8A7F73);   // text-faint

  // =========================================================================
  // SAFFRON — primary brand / VIDYA
  // =========================================================================
  static const Color saffron100 = Color(0xFFFFE3C2); // orb highlight (dragging)
  static const Color saffron200 = Color(0xFFFFD9AE); // orb highlight (resting)
  static const Color saffron400 = Color(0xFFE08A3C);
  static const Color saffron500 = Color(0xFFC96A28); // PRIMARY — brand, CTA, VIDYA
  static const Color saffron600 = Color(0xFFA5551D); // eyebrow / link
  static const Color saffron700 = Color(0xFF8A4A08);
  static const Color saffron800 = Color(0xFF7E3F16);

  // =========================================================================
  // LEAF — selected / done / ready
  // =========================================================================
  static const Color leaf100 = Color(0xFFCFE6CF); // tint
  static const Color leaf500 = Color(0xFF2C5F2D); // PRIMARY — selected, done, ready
  static const Color leaf700 = Color(0xFF234B24); // text on tint

  // =========================================================================
  // INDIGO — working / NCERT / curriculum
  // =========================================================================
  static const Color indigo100 = Color(0xFFDCE2FA); // tint
  static const Color indigo500 = Color(0xFF2A3B8F); // PRIMARY — working, NCERT, curriculum

  // =========================================================================
  // ALERT — status dots only (never fills)
  // =========================================================================
  static const Color red500 = Color(0xFFC0392B);   // absent / end call
  static const Color red700 = Color(0xFF8A1C1C);
  static const Color amber500 = Color(0xFFB45309); // warning / late / queued

  // =========================================================================
  // SEMANTIC ALIASES — use these in widgets, not raw tokens above
  // =========================================================================

  // Surfaces
  static const Color surfacePage = milk500;                    // app canvas
  static const Color surfaceWeb = milk200;                     // website page
  static const Color surfaceBand = milk400;                    // website band
  static const Color surfaceCard = milk50;                     // solid card / sheet
  static const Color surfaceGlass = Color(0xD1FFFFFF);         // 82% white = 0.82 * 255 ≈ 209
  static const Color surfaceGlassSoft = Color(0xB3FFFFFF);     // 70% white = 0.70 * 255 ≈ 179
  static const Color surfaceInset = milk300;                   // inset field / context card

  // Borders
  static const Color borderGlass = Color(0xF2FFFFFF);          // 95% white
  static const Color borderHairline = Color(0x14171310);       // rgba(23,19,16,.08)
  static const Color borderStrong = Color(0x1F171310);         // rgba(23,19,16,.12)

  // Scrim
  static const Color scrim = Color(0x24171310);                // 14% ink

  // Text
  static const Color textStrong = ink900;
  static const Color textBody = ink600;
  static const Color textMuted = ink500;
  static const Color textFaint = ink400;
  static const Color textEyebrow = saffron600;
  static const Color textOnAccent = Color(0xFFFFFFFF);         // white on saffron
  static const Color textLink = saffron600;
  static const Color textLinkHover = saffron500;

  // Accents
  static const Color accent = saffron500;
  static const Color accentTint = Color(0x1AFF8D2A);           // rgba(201,106,40,.10)
  static const Color accentTintBorder = Color(0x38C96A28);     // rgba(201,106,40,.22)
  static const Color success = leaf500;
  static const Color successTint = Color(0x1E2C5F2D);          // rgba(44,95,45,.12)
  static const Color info = indigo500;
  static const Color infoTint = Color(0x152A3B8F);             // rgba(42,59,143,.08)
  static const Color infoTintBorder = Color(0x2E2A3B8F);       // rgba(42,59,143,.18)
  static const Color danger = red500;
  static const Color warning = amber500;

  // =========================================================================
  // LIGHT COLOR SCHEME (Material 3) — maps tokens to M3 roles
  // =========================================================================
  static ColorScheme get lightScheme => const ColorScheme(
    brightness: Brightness.light,

    // Primary = saffron-500 (brand, CTA, VIDYA)
    primary: saffron500,
    onPrimary: textOnAccent, // white
    primaryContainer: saffron100,
    onPrimaryContainer: ink900,

    // Secondary = leaf (selected/done)
    secondary: leaf500,
    onSecondary: textOnAccent,
    secondaryContainer: leaf100,
    onSecondaryContainer: ink900,

    // Tertiary = indigo (working/NCERT)
    tertiary: indigo500,
    onTertiary: textOnAccent,
    tertiaryContainer: indigo100,
    onTertiaryContainer: ink900,

    // Error = red (alert)
    error: red500,
    onError: textOnAccent,
    errorContainer: Color(0xFFFDECEA),
    onErrorContainer: red700,

    // Surface = milk50 (card/sheet), milk500 (canvas)
    surface: milk50,
    onSurface: ink900,
    surfaceContainerHighest: milk300,
    surfaceContainerHigh: milk200,
    surfaceContainer: milk100,
    surfaceContainerLow: milk50,
    surfaceContainerLowest: milk50,

    // Outline = hairline/strong
    outline: borderHairline,
    outlineVariant: borderStrong,

    // Shadow = warm ink (handled in app_shadows.dart)
    shadow: ink900,

    // Inverse
    inverseSurface: ink900,
    onInverseSurface: milk50,
    inversePrimary: saffron200,

    // Surface tint (M3) — transparent to let our glass system handle it
    surfaceTint: Colors.transparent,
  );

  // =========================================================================
  // DARK COLOR SCHEME — minimal, warm-retinted for demo (light-only per spec)
  // Kept functional but retinted toward ink/milk palette.
  // =========================================================================
  static ColorScheme get darkScheme => const ColorScheme(
    brightness: Brightness.dark,

    primary: saffron200,          // lighter saffron on dark
    onPrimary: ink900,
    primaryContainer: saffron700,
    onPrimaryContainer: milk50,

    secondary: leaf100,
    onSecondary: ink900,
    secondaryContainer: leaf700,
    onSecondaryContainer: milk50,

    tertiary: indigo100,
    onTertiary: ink900,
    tertiaryContainer: indigo500,
    onTertiaryContainer: milk50,

    error: red500,
    onError: milk50,
    errorContainer: red700,
    onErrorContainer: milk50,

    surface: ink900,
    onSurface: milk50,
    surfaceContainerHighest: Color(0xFF332C26),
    surfaceContainerHigh: Color(0xFF2A241F),
    surfaceContainer: Color(0xFF1F1A16),
    surfaceContainerLow: ink900,
    surfaceContainerLowest: Color(0xFF0F0C0A),

    outline: Color(0x33FFFFFF),      // rgba(255,255,255,.2)
    outlineVariant: Color(0x1FFFFFFF), // rgba(255,255,255,.12)

    shadow: Colors.black,

    inverseSurface: milk50,
    onInverseSurface: ink900,
    inversePrimary: saffron500,

    surfaceTint: Colors.transparent,
  );

  // =========================================================================
  // LEGACY ALIASES — for gradual migration (remove after full rollout)
  // =========================================================================
  @Deprecated('Use AppColors.saffron500')
  static const Color brandSaffron = saffron500;

  @Deprecated('Use AppColors.saffron500')
  static const Color lPrimary = saffron500;

  @Deprecated('Use AppColors.saffron600')
  static const Color lPrimaryText = saffron600;

  @Deprecated('Use AppColors.saffron100')
  static const Color lPrimaryContainer = saffron100;

  @Deprecated('Use AppColors.saffron200')
  static const Color lPrimaryContainerText = saffron600;

  @Deprecated('Use AppColors.milk500')
  static const Color lightPaper = milk500;

  @Deprecated('Use AppColors.ink900')
  static const Color lShadowBase = ink900;

  @Deprecated('Use AppColors.textBody')
  static const Color lOnSurface = textBody;

  @Deprecated('Use AppColors.milk50')
  static const Color lSurface = milk50;

  @Deprecated('Use AppColors.milk100')
  static const Color lSurfaceVariant = milk100;

  @Deprecated('Use AppColors.textMuted')
  static const Color lOnSurfaceVariant = textMuted;

  @Deprecated('Use AppColors.saffron200')
  static const Color lError = red500;

  @Deprecated('Use AppColors.saffron200')
  static const Color lErrorContainer = Color(0xFFFDECEA);

  @Deprecated('Use AppColors.saffron200')
  static const Color lOnErrorContainer = red700;

  @Deprecated('Use AppColors.saffron200')
  static const Color lTertiary = indigo500;

  @Deprecated('Use AppColors.saffron200')
  static const Color lTertiaryContainer = indigo100;

  @Deprecated('Use AppColors.saffron200')
  static const Color lOnTertiaryContainer = ink900;

  @Deprecated('Use AppColors.saffron200')
  static const Color lOutline = borderHairline;

  @Deprecated('Use AppColors.saffron200')
  static const Color lOutlineVariant = borderStrong;

  // Dark legacy
  @Deprecated('Use darkScheme')
  static const Color dScaffold = ink900;

  @Deprecated('Use darkScheme')
  static const Color dSurface = ink900;

  @Deprecated('Use darkScheme')
  static const Color dOnSurface = milk50;

  @Deprecated('Use darkScheme')
  static const Color dPrimary = saffron200;

  @Deprecated('Use darkScheme')
  static const Color dOnPrimary = ink900;

  @Deprecated('Use darkScheme')
  static const Color dPrimaryContainer = saffron700;

  @Deprecated('Use darkScheme')
  static const Color dOnPrimaryContainer = milk50;

  @Deprecated('Use darkScheme')
  static const Color dSecondary = leaf100;

  @Deprecated('Use darkScheme')
  static const Color dOnSecondary = ink900;

  @Deprecated('Use darkScheme')
  static const Color dSecondaryContainer = leaf700;

  @Deprecated('Use darkScheme')
  static const Color dOnSecondaryContainer = milk50;

  @Deprecated('Use darkScheme')
  static const Color dTertiary = indigo100;

  @Deprecated('Use darkScheme')
  static const Color dOnTertiary = ink900;

  @Deprecated('Use darkScheme')
  static const Color dTertiaryContainer = indigo500;

  @Deprecated('Use darkScheme')
  static const Color dOnTertiaryContainer = milk50;

  @Deprecated('Use darkScheme')
  static const Color dError = red500;

  @Deprecated('Use darkScheme')
  static const Color dOnError = milk50;

  @Deprecated('Use darkScheme')
  static const Color dErrorContainer = red700;

  @Deprecated('Use darkScheme')
  static const Color dOnErrorContainer = milk50;

  @Deprecated('Use darkScheme')
  static const Color dOutline = Color(0x33FFFFFF);

  @Deprecated('Use darkScheme')
  static const Color dOutlineVariant = Color(0x1FFFFFFF);

  @Deprecated('Use darkScheme')
  static const Color dOnSurfaceVariant = ink400;

  @Deprecated('Use darkScheme')
  static const Color dShadowBase = Colors.black;

  // =========================================================================
  // RESTORED LEGACY TOKENS — the original shadcn-style surface the rest of
  // the app still reads, retinted to the v3 warm milk / ink / saffron ramp.
  // These keep every legacy call site compiling while the redesign lands.
  // =========================================================================

  // Decorative legacy (splash only — v3 has "no second brand accent"; these
  // exist so the splash compiles until its own reskin).
  static const Color brandBrass = Color(0xFFB08D57);
  static const Color dBrandBrass = Color(0xFF8A6E43);

  // Extended saffron ramp (v3 values / interpolations).
  static const Color saffron50 = Color(0xFFFFF7EC);
  static const Color saffron300 = Color(0xFFF0A468);

  // Semantic hue aliases.
  static const Color navy = indigo500; // `--accent` → v3 indigo
  static const Color green = leaf500; // `--secondary` → v3 leaf
  static const Color saffronText = saffron600;
  static const Color lPine = leaf500;
  static const Color lIndigo = indigo500;
  static const Color dPine = leaf100;
  static const Color dTertiaryAlt = Color(0xFF9FADDF); // soft indigo on dark
  static const Color shadowBase = ink900;

  // --- LIGHT surface ---
  static const Color lBackground = milk500; // warm off-white scaffold #F4F2ED
  static const Color lCard = milk50; // card / list tile #FFFDF9
  static const Color lPopover = milk50; // dialogs, menus
  static const Color lMuted = milk300; // muted well #FBF6EE
  static const Color lSurfaceContainerLow = milk300; // grouped block, input fill
  static const Color lSurfaceContainerHigh = Color(0xFFF2EEE6); // active/hover fill
  static const Color lForeground = ink900; // `--foreground` ink (16.7:1 ✓)
  static const Color lMutedForeground = ink500; // `--muted-foreground` #6E655C
  static const Color lOnPrimary = milk100; // warm white on saffron
  static const Color lOnPrimaryContainer = saffron800; // label on saffron tint
  static const Color lSecondary = leaf500; // deep leaf green
  static const Color lSecondaryContainer = leaf100;
  static const Color lOnSecondaryContainer = leaf700;
  static const Color lBorder = Color(0xFFE9E4DA); // card outline, dividers (warm)
  static const Color lInput = Color(0xFFE9E4DA); // enabled border
  static const Color lRing = saffron500; // saffron focus ring

  // --- DARK surface (warm-retinted; demo runs light-only) ---
  static const Color dBackground = ink900; // warm near-black #171310
  static const Color dCard = Color(0xFF1F1A16); // resting card
  static const Color dPopover = Color(0xFF221D18); // raised cards, menus
  static const Color dMuted = Color(0xFF241E1A); // muted chip / sunken group
  static const Color dSurfaceContainerLow = Color(0xFF141110); // sunken wells
  static const Color dSurfaceContainerHigh = Color(0xFF2A241F); // active/hover
  static const Color dForeground = milk50; // warm off-white ink
  static const Color dMutedForeground = Color(0xFFA79C90); // secondary text
  static const Color dPrimaryText = saffron400; // dark-mode saffron text/eyebrow
  static const Color dBorder = Color(0xFF332C26); // card outline, dividers
  static const Color dInput = Color(0xFF332C26); // input border
  static const Color dRing = saffron400; // saffron focus ring

  // Legacy indigo soft-on-dark (kept for dark-theme call sites).
  static const Color dTertiarySoft = Color(0xFF9FADDF);
}