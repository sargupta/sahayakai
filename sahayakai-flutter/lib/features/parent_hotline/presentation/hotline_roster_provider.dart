import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../domain/hotline_student.dart';

/// The teacher's class roster that feeds the Parent Hotline `pickStudent` stage
/// (SPEC §B.1 stage 1).
///
/// **foundation-v1 ships no student-list API.** There is no roster route to call
/// yet, so there is nothing honest to list. This provider therefore returns an
/// EMPTY roster by default. The screen degrades on the real cause: a signed-out
/// teacher sees the sign-in `EmptyView`, while a signed-IN teacher — whose roster
/// is empty ONLY because the class list can't be fetched on the app yet, not
/// because of auth — sees honest "class list isn't available yet" copy instead of
/// a false "sign in" prompt. It never invents students or fakes a signed-in
/// identity (SPEC §B.1 / §B.5, F9-001).
///
/// It is a deliberately thin, overridable seam:
///   • the U12 attendance hand-off will override it (or supply students through
///     the launch context) once a real roster read lands;
///   • widget tests override it with a fixed list to exercise the picker, the
///     no-parent-phone disabled row, and the last-4 mask.
///
/// A plain [Provider] (not codegen) keeps it trivially overridable with
/// `overrideWithValue` and adds no build_runner surface.
final hotlineStudentRosterProvider = Provider<List<HotlineStudent>>(
  (ref) => const <HotlineStudent>[],
);
