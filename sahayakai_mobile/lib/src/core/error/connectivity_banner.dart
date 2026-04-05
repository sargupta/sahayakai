import 'dart:async';

import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:google_fonts/google_fonts.dart';

/// Watches network connectivity and shows a persistent banner when offline.
///
/// Wrap around the body of any scaffold or as a child in a Stack.
///
/// ```dart
/// body: ConnectivityBanner(
///   child: MyScreenContent(),
/// )
/// ```
class ConnectivityBanner extends StatefulWidget {
  final Widget child;

  const ConnectivityBanner({super.key, required this.child});

  @override
  State<ConnectivityBanner> createState() => _ConnectivityBannerState();
}

class _ConnectivityBannerState extends State<ConnectivityBanner> {
  late StreamSubscription<ConnectivityResult> _sub;
  bool _isOffline = false;
  bool _justReconnected = false;
  Timer? _reconnectTimer;

  @override
  void initState() {
    super.initState();
    _sub = Connectivity()
        .onConnectivityChanged
        .listen(_onConnectivityChanged);

    Connectivity().checkConnectivity().then((result) {
      if (mounted) _onConnectivityChanged(result);
    });
  }

  void _onConnectivityChanged(ConnectivityResult result) {
    final nowOffline = result == ConnectivityResult.none;

    if (!mounted) return;

    if (!nowOffline && _isOffline) {
      // Just came back online — flash "reconnected" for 2 s.
      setState(() {
        _isOffline = false;
        _justReconnected = true;
      });
      _reconnectTimer?.cancel();
      _reconnectTimer = Timer(const Duration(seconds: 2), () {
        if (mounted) setState(() => _justReconnected = false);
      });
    } else if (nowOffline != _isOffline) {
      // Only rebuild when the offline state actually flips.
      setState(() => _isOffline = nowOffline);
    }
  }

  @override
  void dispose() {
    _sub.cancel();
    _reconnectTimer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        if (_isOffline)
          _OfflineBanner()
              .animate()
              .slideY(begin: -1, end: 0, duration: 250.ms, curve: Curves.easeOut),
        if (_justReconnected)
          _ReconnectedBanner()
              .animate()
              .fadeIn(duration: 200.ms)
              .then(delay: 1500.ms)
              .fadeOut(duration: 300.ms),
        Expanded(child: widget.child),
      ],
    );
  }
}

class _OfflineBanner extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      color: const Color(0xFFB71C1C),
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          const Icon(Icons.wifi_off_rounded, size: 16, color: Colors.white),
          const SizedBox(width: 8),
          Text(
            'No internet connection — showing saved content',
            style: GoogleFonts.outfit(fontSize: 12, color: Colors.white),
          ),
        ],
      ),
    );
  }
}

class _ReconnectedBanner extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      color: const Color(0xFF2E7D32),
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          const Icon(Icons.wifi_rounded, size: 16, color: Colors.white),
          const SizedBox(width: 8),
          Text(
            'Back online',
            style: GoogleFonts.outfit(fontSize: 12, color: Colors.white),
          ),
        ],
      ),
    );
  }
}
