import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:connectivity_plus/connectivity_plus.dart';
import '../studio_theme_resolver.dart';
import '../models/studio_motion_profile.dart';

/// Registry of Motion Profiles per Studio
final studioConfigProvider =
    Provider.family<StudioMotionProfile, StudioType>((ref, studio) {
  switch (studio) {
    case StudioType.wizard:
      return const StudioMotionProfile(
        pageCurve: Curves.easeOutCubic,
        transition: Duration(milliseconds: 450),
        thinkingCurve: Curves.easeInOut,
        focusScale: 1.05,
        bloomIntensity: 0.6,
      );
    case StudioType.director:
      return const StudioMotionProfile(
        pageCurve: Curves.easeInOutCubicEmphasized,
        transition: Duration(milliseconds: 700),
        thinkingCurve: Curves.linearToEaseOut,
        focusScale: 1.02,
        bloomIntensity: 0.3,
      );
    default:
      return const StudioMotionProfile(
        pageCurve: Curves.easeInOut,
        transition: Duration(milliseconds: 400),
        thinkingCurve: Curves.easeInOut,
        focusScale: 1.0,
        bloomIntensity: 0.0,
      );
  }
});

/// Connectivity Provider (Stream)
final connectivityProvider = StreamProvider<bool>((ref) {
  return Connectivity().onConnectivityChanged.map(
        (result) => result != ConnectivityResult.none,
      );
});

/// Global AI Processing State
final aiProcessingProvider = StateProvider<bool>((ref) => false);
