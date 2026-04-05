import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

/// Reusable error state widget with retry button.
///
/// Use in FutureBuilder / AsyncValue error states:
/// ```dart
/// ref.watch(myProvider).when(
///   data: (_) => MyWidget(),
///   loading: () => const CircularProgressIndicator(),
///   error: (e, _) => ErrorDisplay(
///     message: e.toString(),
///     onRetry: () => ref.invalidate(myProvider),
///   ),
/// );
/// ```
class ErrorDisplay extends StatelessWidget {
  final String message;
  final VoidCallback? onRetry;
  final bool compact;

  const ErrorDisplay({
    super.key,
    required this.message,
    this.onRetry,
    this.compact = false,
  });

  @override
  Widget build(BuildContext context) {
    if (compact) {
      return Container(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
        decoration: BoxDecoration(
          color: Colors.red.withValues(alpha: 0.1),
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: Colors.red.withValues(alpha: 0.3)),
        ),
        child: Row(
          children: [
            const Icon(Icons.error_outline, size: 18, color: Colors.redAccent),
            const SizedBox(width: 8),
            Expanded(
              child: Text(
                _friendlyMessage(message),
                style:
                    GoogleFonts.outfit(fontSize: 12, color: Colors.redAccent),
              ),
            ),
            if (onRetry != null) ...[
              const SizedBox(width: 8),
              GestureDetector(
                onTap: onRetry,
                child: Text(
                  'Retry',
                  style: GoogleFonts.outfit(
                    fontSize: 12,
                    fontWeight: FontWeight.w600,
                    color: Colors.redAccent,
                    decoration: TextDecoration.underline,
                  ),
                ),
              ),
            ],
          ],
        ),
      );
    }

    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              _isNetworkError(message)
                  ? Icons.wifi_off_rounded
                  : Icons.error_outline_rounded,
              size: 56,
              color: Colors.white38,
            ),
            const SizedBox(height: 16),
            Text(
              _isNetworkError(message) ? 'No Connection' : 'Something went wrong',
              style: GoogleFonts.outfit(
                fontSize: 18,
                fontWeight: FontWeight.w600,
                color: Colors.white70,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              _friendlyMessage(message),
              style: GoogleFonts.outfit(
                  fontSize: 13, color: Colors.white38, height: 1.5),
              textAlign: TextAlign.center,
            ),
            if (onRetry != null) ...[
              const SizedBox(height: 24),
              OutlinedButton.icon(
                onPressed: onRetry,
                icon: const Icon(Icons.refresh_rounded, size: 16),
                label: Text(
                  'Try Again',
                  style: GoogleFonts.outfit(fontWeight: FontWeight.w600),
                ),
                style: OutlinedButton.styleFrom(
                  foregroundColor: Colors.white70,
                  side: const BorderSide(color: Colors.white24),
                  padding: const EdgeInsets.symmetric(
                      horizontal: 24, vertical: 12),
                  shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12)),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }

  bool _isNetworkError(String msg) {
    return msg.contains('SocketException') ||
        msg.contains('network') ||
        msg.contains('Connection refused') ||
        msg.contains('No internet');
  }

  String _friendlyMessage(String raw) {
    if (_isNetworkError(raw)) {
      return 'Check your internet connection and try again.';
    }
    if (raw.contains('403')) {
      return 'This feature is not available on your current plan.';
    }
    if (raw.contains('429')) {
      return 'Usage limit reached. Please try again later.';
    }
    if (raw.contains('500') || raw.contains('Internal')) {
      return 'Our servers are having a moment. Please try again shortly.';
    }
    // Strip technical prefixes.
    return raw
        .replaceAll('Exception: ', '')
        .replaceAll('DioException: ', '')
        .replaceAll('[DioException]', '')
        .trim();
  }
}
