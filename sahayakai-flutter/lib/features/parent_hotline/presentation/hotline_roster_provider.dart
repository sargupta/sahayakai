import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../domain/hotline_student.dart';

/// The teacher's class roster that feeds the Parent Hotline `pickStudent` stage
/// (SPEC §B.1 stage 1).
///
/// **foundation-v1 ships no student-list API.** The attendance / roster routes
/// require a real identity and `401` under the stubbed token provider
/// (`_noToken`, SPEC §B.2), so there is nothing honest to list. This provider
/// therefore returns an EMPTY roster by default and the screen degrades to the
/// signed-out `EmptyView` — it never invents students or fakes a signed-in
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
