/// Demo data mode: a build switch for presenting and testing the app with no
/// backend, no Firebase and no sign-in.
///
/// Turn it on with `--dart-define=DEMO_DATA=true` (flutter run / build). With
/// it off — every normal build — nothing under `lib/demo/` is reachable: the
/// only reference is the `if (kDemoData)` branch in `main.dart`, which the
/// compiler drops as dead code.
///
/// In demo mode `main()` skips Firebase, Crashlytics and FCM, and mounts the
/// app with [demoOverrides] (`demo_overrides.dart`), which replace every remote
/// data source with the static sample data in this folder. The sample data is
/// one consistent story: one teacher, her two classes and their students, so
/// attendance, parent calls, Home and the tools all agree with each other.
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
