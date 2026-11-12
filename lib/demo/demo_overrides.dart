import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../core/network/api_client.dart';
import '../core/network/api_providers.dart';
import '../features/attendance/data/attendance_repository.dart';
import '../features/notifications/data/notifications_store.dart';
import '../features/parent_hotline/data/parent_hotline_repository.dart';
import '../features/profile/data/profile_doc_source.dart';
import 'demo_api_client.dart';
import 'demo_community.dart';
import 'demo_core.dart';

/// The provider overrides the demo build mounts the app with: sample data on
/// top of the LIVE app.
///
/// Firebase, sign-in and the backend stay real, so VIDYA, speech-to-text, her
/// voice and every AI tool work exactly as in a normal build. Sample data
/// fills what a fresh account would otherwise show empty: two classes and
/// their students, parent calls (simulated — placing real calls needs the
/// telephony keys), Community, Updates, the demo teacher's profile, and extra
/// items in My work.
///
/// Each sample source is created ONCE here and bound with `overrideWithValue`,
/// so what the teacher does during a presentation (a saved register, a placed
/// call, an edited profile) survives screens being closed and reopened.
List<Override> demoOverrides() {
  // The sample repositories answer everything themselves; this client only
  // satisfies their constructors and is never asked for a request.
  final unused = ApiClient();
  final attendance = DemoAttendanceRepository(unused, DateTime.now);
  final hotline = DemoParentHotlineRepository(unused);
  final profileDocs = DemoProfileDocSource();

  return <Override>[
    // The real client (the signed-in teacher's token), wrapped so a few
    // routes are answered with samples and the rest reach the backend.
    apiClientProvider.overrideWith(
      (ref) => DemoApiClient(
        ApiClient(
          tokenProvider: ref.watch(tokenProviderProvider),
          appCheckTokenProvider: ref.watch(appCheckTokenProviderProvider),
        ),
      ),
    ),
    ...demoIdentityOverrides,
    profileDocSourceProvider.overrideWithValue(profileDocs),
    attendanceRepositoryProvider.overrideWithValue(attendance),
    parentHotlineRepositoryProvider.overrideWithValue(hotline),
    notificationsProvider.overrideWith(DemoNotificationsStore.new),
    ...demoCommunityOverrides(),
  ];
}
