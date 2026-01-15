import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

enum FestivalType {
  none,
  diwali,
  holi,
  independenceDay,
  eid,
}

class FestivalConfig {
  final FestivalType type;
  final Color?
      overlayColor; // Cultural tint (e.g. Saffron/Green for Independence)
  final String greeting; // "Happy Diwali!"

  const FestivalConfig({
    required this.type,
    this.overlayColor,
    required this.greeting,
  });

  static FestivalConfig fromDate(DateTime date) {
    // 2026 Festival Calendar (Approximate)
    // Diwali: Nov 8
    if (date.month == 11 && (date.day >= 5 && date.day <= 10)) {
      return const FestivalConfig(
        type: FestivalType.diwali,
        overlayColor: Color(0x1AFFD700), // Gold tint
        greeting: "Subh Deepawali",
      );
    }

    // Holi: Mar 4
    if (date.month == 3 && (date.day >= 2 && date.day <= 6)) {
      return const FestivalConfig(
        type: FestivalType.holi,
        overlayColor: Color(0x1AE91E63), // Pink tint
        greeting: "Happy Holi",
      );
    }

    // Independence Day: Aug 15
    if (date.month == 8 && date.day == 15) {
      return const FestivalConfig(
        type: FestivalType.independenceDay,
        overlayColor: Color(0x1AFF9933), // Saffron tint
        greeting: "Jai Hind",
      );
    }

    // Eid: Mar 20 (Approx)
    if (date.month == 3 && (date.day >= 19 && date.day <= 21)) {
      return const FestivalConfig(
        type: FestivalType.eid,
        overlayColor: Color(0x1A00695C), // Emerald Green tint
        greeting: "Eid Mubarak",
      );
    }

    // Makar Sankranti / Pongal: Jan 14-16
    // This will trigger TODAY (Jan 15)
    if (date.month == 1 && (date.day >= 14 && date.day <= 16)) {
      return const FestivalConfig(
        type: FestivalType
            .diwali, // Reusing Diwali gold theme for now, or add new enum
        overlayColor: Color(0x33FFC107), // Strong Amber/Gold for harvest
        greeting: "Happy Pongal / Sankranti",
      );
    }

    return const FestivalConfig(
      type: FestivalType.none,
      greeting: "",
    );
  }
}

/// Provides the current active festival config based on system time.
final festivalProvider = StateProvider<FestivalConfig>((ref) {
  return FestivalConfig.fromDate(DateTime.now());
});
