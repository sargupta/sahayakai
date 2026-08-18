import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/i18n/l10n_ext.dart';
import '../../core/network/api_exception.dart';
import 'app_skeleton.dart';
import 'empty_view.dart';
import 'error_view.dart';

/// The async state machine every AI tool renders through. Maps
/// `AsyncValue<T?>` into the four canonical states:
///   loading -> skeleton, error -> ErrorView(+retry), data(null) -> empty,
///   data(value) -> onData. See ARCHITECTURE §9.2.
class ResultView<T> extends StatelessWidget {
  const ResultView({
    super.key,
    required this.state,
    required this.onData,
    this.onRetry,
    this.emptyMessage,
    this.skeleton,
  });

  final AsyncValue<T?> state;
  final Widget Function(T data) onData;
  final VoidCallback? onRetry;
  final String? emptyMessage;
  final Widget? skeleton;

  @override
  Widget build(BuildContext context) {
    return state.when(
      loading: () => skeleton ?? const AppSkeleton(),
      error: (e, _) {
        final message =
            e is ApiException ? e.message : context.l10n.errorGeneric;
        final isAuth = e is ApiException && e.isAuth;
        // Auth errors redirect to /login globally — no local retry.
        return ErrorView(message: message, onRetry: isAuth ? null : onRetry);
      },
      data: (value) => value == null
          ? EmptyView(message: emptyMessage ?? context.l10n.emptyDefault)
          : onData(value),
    );
  }
}
