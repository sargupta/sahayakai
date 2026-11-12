/// Demo data mode: sample data on top of the live app, for presenting.
///
/// Turn it on with `--dart-define=DEMO_DATA=true` (flutter run / build). With
/// it off — every normal build — `main.dart` passes no overrides and nothing
/// under `lib/demo/` is reachable.
///
/// The app stays fully live in demo mode: Firebase, Google sign-in and the
/// backend are real, so VIDYA, speech-to-text, her voice and every AI tool
/// behave exactly as in a normal build. `demoOverrides()` in
/// `demo_overrides.dart` only replaces what a fresh account would show empty
/// with one consistent sample story: one teacher, her two classes and their
/// students, parent calls (simulated), Community, Updates and extra items in
/// My work.
library;

/// True only in a build made with `--dart-define=DEMO_DATA=true`.
const bool kDemoData = bool.fromEnvironment('DEMO_DATA');

/// The demo teacher. Every "current user id" seam returns [kDemoUid].
const String kDemoUid = 'demo-teacher-priya';
const String kDemoTeacherName = 'Priya Deshmukh';
const String kDemoTeacherEmail = 'priya.deshmukh@example.org';
const String kDemoSchool = 'Zilla Parishad School, Wagholi';
const String kDemoDistrict = 'Pune';
const String kDemoState = 'Maharashtra';

/// The demo teacher's two classes (ids are stable so routes and parent calls
/// line up across features).
const String kDemoClass7Id = 'demo-class-7a';
const String kDemoClass7Name = 'Class 7 A';
const String kDemoClass7Subject = 'Science';
const String kDemoClass6Id = 'demo-class-6b';
const String kDemoClass6Name = 'Class 6 B';
const String kDemoClass6Subject = 'Mathematics';
