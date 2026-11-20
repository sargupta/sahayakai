import 'package:riverpod_annotation/riverpod_annotation.dart';

import '../../../core/auth/auth_providers.dart';
import 'app_tab_bar.dart';

part 'shell_tab_controller.g.dart';

/// The signed-in shell's current tab.
///
/// The four tabs share one route (`/`), so the route alone cannot say which
/// destination the teacher is on. The VIDYA overlay reads this to keep the
/// orb off Home only (where the Seal Mic is the mic) and on every other tab —
/// creation lives on the orb now that the tab bar has no Create slot.
@Riverpod(keepAlive: true)
class ShellTabController extends _$ShellTabController {
  /// Every session starts on Home: watching the auth status rebuilds (and so
  /// resets) the tab when the teacher signs out and back in.
  @override
  AppTab build() {
    ref.watch(authControllerProvider);
    return AppTab.home;
  }

  void select(AppTab tab) => state = tab;
}
