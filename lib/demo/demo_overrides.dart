import 'dart:convert';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../core/auth/auth_providers.dart';
import '../core/network/api_providers.dart';
import '../features/attendance/data/attendance_repository.dart';
import '../features/notifications/data/notifications_store.dart';
import '../features/parent_hotline/data/parent_hotline_repository.dart';
import '../features/profile/data/profile_doc_source.dart';
import 'demo_api_client.dart';
import 'demo_community.dart';
import 'demo_core.dart';
import 'demo_mode.dart';
import 'demo_tools.dart';

/// Every provider override the demo build mounts the app with.
///
/// Each demo source is created ONCE here and bound with `overrideWithValue`, so
/// what the teacher does during a presentation (a saved register, a placed
/// call, an edited profile) survives screens being closed and reopened — an
/// auto-disposed provider rebuilt from scratch would forget it.
List<Override> demoOverrides() {
  final client = DemoApiClient();
  final attendance = DemoAttendanceRepository(client, DateTime.now);
  final hotline = DemoParentHotlineRepository(client);
  final profileDocs = DemoProfileDocSource();

  return <Override>[
    // Boot and identity: no Firebase, already signed in as the demo teacher.
    appBootstrapProvider.overrideWith((ref) async {}),
    authControllerProvider.overrideWith(DemoAuthController.new),
    tokenProviderProvider.overrideWithValue(
      ({bool forceRefresh = false}) async => _demoToken,
    ),
    appCheckTokenProviderProvider.overrideWithValue(() async => null),
    ...demoIdentityOverrides,

    // Data sources.
    apiClientProvider.overrideWithValue(client),
    profileDocSourceProvider.overrideWithValue(profileDocs),
    attendanceRepositoryProvider.overrideWithValue(attendance),
    parentHotlineRepositoryProvider.overrideWithValue(hotline),
    notificationsProvider.overrideWith(DemoNotificationsStore.new),
    ...demoCommunityOverrides(),
    ...demoToolOverrides(),
  ];
}

/// An unsigned token carrying the demo teacher's uid and a Pro plan claim, so
/// the plan badge decodes the way it would for a real Pro teacher. Nothing in
/// the app verifies the signature (the server does, and there is none here).
final String _demoToken = () {
  String seg(Map<String, Object> m) =>
      base64Url.encode(utf8.encode(jsonEncode(m))).replaceAll('=', '');
  return '${seg(<String, Object>{'alg': 'none'})}.'
      '${seg(<String, Object>{'user_id': kDemoUid, 'sub': kDemoUid, 'planType': 'pro'})}'
      '.demo';
}();
