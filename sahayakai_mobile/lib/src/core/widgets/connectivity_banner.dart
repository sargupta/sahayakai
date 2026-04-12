import 'dart:async';

import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

/// Watches network connectivity and shows a slim animated banner.
///
/// - Offline: persistent red banner at top — "No internet connection"
/// - Back online: green banner briefly (2 s) then hides
///
/// Wrap your top-level widget (e.g., Scaffold body) or the MaterialApp child:
/// ```dart
/// ConnectivityBanner(child: router widget)
/// ```
class ConnectivityBanner extends ConsumerStatefulWidget {
  final Widget child;

  const ConnectivityBanner({super.key, required this.child});

  @override
  ConsumerState<ConnectivityBanner> createState() => _ConnectivityBannerState();
}

class _ConnectivityBannerState extends ConsumerState<ConnectivityBanner>
    with SingleTickerProviderStateMixin {
  late StreamSubscription<ConnectivityResult> _subscription;
  bool _isOffline = false;
  bool _showBackOnline = false;
  Timer? _backOnlineTimer;

  late AnimationController _controller;
  late Animation<double> _heightAnimation;

  @override
  void initState() {
    super.initState();

    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 300),
    );
    _heightAnimation = CurvedAnimation(
      parent: _controller,
      curve: Curves.easeInOut,
    );

    // Check initial connectivity
    Connectivity().checkConnectivity().then(_handleResult);

    // Listen for changes
    _subscription = Connectivity()
        .onConnectivityChanged
        .listen(_handleResult);
  }

  void _handleResult(ConnectivityResult result) {
    final isOffline = result == ConnectivityResult.none;

    if (isOffline && !_isOffline) {
      // Just went offline
      setState(() {
        _isOffline = true;
        _showBackOnline = false;
      });
      _backOnlineTimer?.cancel();
      _controller.forward();
    } else if (!isOffline && _isOffline) {
      // Just came back online
      setState(() {
        _isOffline = false;
        _showBackOnline = true;
      });
      _backOnlineTimer?.cancel();
      _backOnlineTimer = Timer(const Duration(seconds: 2), () {
        if (mounted) {
          setState(() => _showBackOnline = false);
          _controller.reverse();
        }
      });
    }
  }

  @override
  void dispose() {
    _subscription.cancel();
    _backOnlineTimer?.cancel();
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final showBanner = _isOffline || _showBackOnline;

    return Column(
      children: [
        AnimatedSize(
          duration: const Duration(milliseconds: 300),
          curve: Curves.easeInOut,
          child: showBanner ? _buildBanner() : const SizedBox.shrink(),
        ),
        Expanded(child: widget.child),
      ],
    );
  }

  Widget _buildBanner() {
    final isOffline = _isOffline;
    return Container(
      width: double.infinity,
      color: isOffline ? Colors.red.shade600 : Colors.green.shade600,
      padding: const EdgeInsets.symmetric(vertical: 6, horizontal: 16),
      child: SafeArea(
        bottom: false,
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(
              isOffline ? Icons.wifi_off_rounded : Icons.wifi_rounded,
              color: Colors.white,
              size: 16,
            ),
            const SizedBox(width: 8),
            Text(
              isOffline ? 'No internet connection' : 'Back online',
              style: const TextStyle(
                color: Colors.white,
                fontSize: 13,
                fontWeight: FontWeight.w600,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
