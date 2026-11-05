import 'dart:async';

import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

/// The routes on screen that pin a full-width button to the bottom (a tool's
/// Generate, the parent call's decision bar), counted per location so a route
/// pushed twice (a VIDYA re-run replacing a tool) never clears the other's
/// entry. The floating orb reads it and, on such a page, parks above the
/// button instead of on it (the UX map's "172 over a full-width CTA").
final vidyaCtaRoutesProvider = StateProvider<Map<String, int>>(
  (ref) => const {},
);

/// Wraps a page's pinned bottom button and tells the floating orb that this
/// route has one, for as long as the button is on the page.
class VidyaCtaClearance extends ConsumerStatefulWidget {
  const VidyaCtaClearance({super.key, required this.child});

  final Widget child;

  @override
  ConsumerState<VidyaCtaClearance> createState() => _VidyaCtaClearanceState();
}

class _VidyaCtaClearanceState extends ConsumerState<VidyaCtaClearance> {
  /// The route this button belongs to; null outside a GoRouter route (a
  /// widget test that pumps the page alone), where there is no orb to move.
  String? _location;
  late final StateController<Map<String, int>> _routes;

  @override
  void initState() {
    super.initState();
    _routes = ref.read(vidyaCtaRoutesProvider.notifier);
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_location != null) return;
    final String location;
    try {
      location = GoRouterState.of(context).matchedLocation;
    } catch (_) {
      return;
    }
    _location = location;
    // Providers must not change while the tree builds: after this frame.
    scheduleMicrotask(() => _bump(location, 1));
  }

  @override
  void dispose() {
    final location = _location;
    if (location != null) scheduleMicrotask(() => _bump(location, -1));
    super.dispose();
  }

  void _bump(String location, int by) {
    // The whole app (and its providers) may be gone by the time this runs.
    if (!_routes.mounted) return;
    final next = Map<String, int>.of(_routes.state);
    final count = (next[location] ?? 0) + by;
    if (count > 0) {
      next[location] = count;
    } else {
      next.remove(location);
    }
    _routes.state = next;
  }

  @override
  Widget build(BuildContext context) => widget.child;
}
