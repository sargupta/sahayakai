import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons/lucide_icons.dart';

import '../../core/i18n/l10n_ext.dart';
import '../../core/platform/share_service.dart';
import '../../core/theme/app_theme.dart';
import '../../features/vidya/domain/deliverable.dart';
import '../../features/vidya/presentation/deliverables_controller.dart';
import 'inline_error.dart';
import 'primary_button.dart';

/// What has happened to the Save action so far. Rendered honestly: a failed
/// save shows the failure and a retry, never the "Saved" tick.
enum ResultSaveStatus {
  /// Not saved yet — the Save CTA is offered.
  idle,

  /// The `POST /api/content/save` is in flight.
  saving,

  /// The endpoint returned a content id.
  saved,

  /// The request threw, or came back without an id. Nothing is in the library.
  failed,
}

/// The one action bar every tool result view ends with: **Copy**, **Share** and
/// (when the caller can supply a save) **Save to Library**.
///
/// Eleven of the thirteen result views dead-ended at copy-to-clipboard: a
/// teacher who had just generated a lesson plan could not send it to a
/// colleague on WhatsApp or keep it. Copy alone is a dead end on a phone, which
/// is the only device most of these teachers have.
///
/// WHY THE SAVE STATE LIVES HERE, not in a Riverpod controller: it is genuinely
/// ephemeral — it exists only while this result is on screen, and it must reset
/// the moment a different result replaces it. [saveResetKey] is what makes that
/// reset explicit: pass the rendered domain object, and a regeneration (a new
/// instance) drops the previous result's "Saved" badge instead of carrying it
/// onto work that was never saved. The network call itself stays in the
/// feature's repository — [onSave] is the seam, so this widget never knows a
/// route, and a test fakes the API client exactly as it already does.
///
/// Share goes through [ShareService] rather than `SharePlus.instance` directly,
/// for the reason the parent-message view already established: a widget test
/// can swap in a fake instead of popping a real OS sheet it can neither drive
/// nor dismiss. If the sheet cannot open at all (no handler, an unsupported
/// platform, a channel error) the action DEGRADES to the clipboard and says so,
/// rather than throwing an unhandled error over the teacher's document.
class ResultActionsBar extends ConsumerStatefulWidget {
  const ResultActionsBar({
    super.key,
    required this.text,
    this.shareSubject,
    this.onSave,
    this.saveResetKey,
  });

  /// The plain-text export of the result — what Copy writes to the clipboard
  /// and what Share hands the OS sheet. Each tool builds its own (a lesson plan
  /// reads as a plan, a worksheet as a worksheet).
  final String text;

  /// Optional subject line for the share channels that carry one (email).
  final String? shareSubject;

  /// Performs the save and returns the new content id. Throws (an
  /// `ApiException`, typically) when the save fails. Null omits the Save action
  /// entirely — which is the honest state for a result with nothing to persist
  /// (no originating request, or a saved item re-rendered from the Library).
  final Future<String> Function()? onSave;

  /// Identity of the result on screen. When it changes, the save state resets
  /// to [ResultSaveStatus.idle] so a new generation never inherits the previous
  /// one's "Saved" confirmation.
  final Object? saveResetKey;

  @override
  ConsumerState<ResultActionsBar> createState() => _ResultActionsBarState();
}

class _ResultActionsBarState extends ConsumerState<ResultActionsBar> {
  ResultSaveStatus _status = ResultSaveStatus.idle;

  /// While a result view is on screen its export is a [Deliverable] VIDYA is
  /// holding — this is what turns the floating orb green and fills the deliver
  /// tray (v3 07 → 08). One id per on-screen result, removed when it leaves.
  late final String _deliverableId =
      'deliver-${DateTime.now().microsecondsSinceEpoch}-${identityHashCode(this)}';

  /// Cached in initState because `ref` cannot be used in [dispose]; the keepAlive
  /// deliverables store outlives this widget, so the reference stays valid.
  DeliverablesController? _deliverables;

  @override
  void initState() {
    super.initState();
    // Best-effort: registering the deliverable lights the floating orb, but the
    // bar must still build when pumped in isolation without a ProviderScope
    // (some widget tests do). No scope → the orb wiring is simply a no-op.
    try {
      _deliverables = ref.read(deliverablesControllerProvider.notifier);
    } catch (_) {
      _deliverables = null;
    }
    if (_deliverables != null) {
      // After the first frame — never modify a provider during build.
      WidgetsBinding.instance.addPostFrameCallback(
        (_) => _registerDeliverable(),
      );
    }
  }

  @override
  void didUpdateWidget(covariant ResultActionsBar oldWidget) {
    super.didUpdateWidget(oldWidget);
    // A new result took this slot: forget what happened to the last one. No
    // setState — the rebuild that delivered the new widget is already running.
    if (oldWidget.saveResetKey != widget.saveResetKey) {
      _status = ResultSaveStatus.idle;
      // The export changed with it — refresh what the deliver tray holds.
      WidgetsBinding.instance.addPostFrameCallback(
        (_) => _registerDeliverable(),
      );
    }
  }

  @override
  void dispose() {
    // The result left the screen — stop holding it. Deferred to a post-frame
    // callback: dispose can run during a parent's rebuild (e.g. a result view
    // clearing itself back to its form), and modifying a provider mid-build is
    // illegal. Uses the cached notifier because ref is unavailable in dispose.
    final notifier = _deliverables;
    final id = _deliverableId;
    if (notifier != null) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        try {
          notifier.remove(id);
        } catch (_) {
          // The container was torn down first (test teardown) — nothing to do.
        }
      });
    }
    super.dispose();
  }

  /// Publish (or refresh) this result as the current deliverable. Idempotent on
  /// the id, so a rebuild never double-counts the orb badge.
  void _registerDeliverable() {
    final notifier = _deliverables;
    if (!mounted || notifier == null || widget.text.trim().isEmpty) return;
    // Refresh: drop the prior payload for this slot, then add the current one.
    notifier.remove(_deliverableId);
    notifier.add(
      Deliverable(
        id: _deliverableId,
        title: widget.shareSubject ?? context.l10n.deliverTrayTitle,
        subtitle: widget.shareSubject,
        text: widget.text,
        shareSubject: widget.shareSubject,
        onSave: widget.onSave,
      ),
    );
  }

  Future<void> _copy() async {
    final l10n = context.l10n;
    final messenger = ScaffoldMessenger.of(context);
    await Clipboard.setData(ClipboardData(text: widget.text));
    if (!mounted) return;
    messenger
      ..hideCurrentSnackBar()
      ..showSnackBar(SnackBar(content: Text(l10n.copyConfirmation)));
  }

  Future<void> _share() async {
    final l10n = context.l10n;
    final messenger = ScaffoldMessenger.of(context);
    try {
      await ref
          .read(shareServiceProvider)
          .shareText(widget.text, subject: widget.shareSubject);
    } on Object catch (_) {
      // The sheet did not open. The teacher still wants the text, so put it
      // where they can paste it and tell them that is what happened — a silent
      // "Copied" would claim a share that never left the device.
      await Clipboard.setData(ClipboardData(text: widget.text));
      if (!mounted) return;
      messenger
        ..hideCurrentSnackBar()
        ..showSnackBar(SnackBar(content: Text(l10n.resultShareFailed)));
    }
  }

  Future<void> _save() async {
    final onSave = widget.onSave;
    if (onSave == null || _status == ResultSaveStatus.saving) return;
    setState(() => _status = ResultSaveStatus.saving);
    try {
      final id = await onSave();
      if (!mounted) return;
      // An empty id is a failure wearing a 200: the route echoes the id it
      // stored, so nothing came back means nothing was stored.
      setState(
        () => _status = id.trim().isEmpty
            ? ResultSaveStatus.failed
            : ResultSaveStatus.saved,
      );
    } on Object catch (_) {
      if (!mounted) return;
      setState(() => _status = ResultSaveStatus.failed);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      mainAxisSize: MainAxisSize.min,
      children: [
        if (widget.onSave != null) ...[
          _SaveArea(status: _status, onSave: _save),
          const SizedBox(height: AppSpacing.space3),
        ],
        // Copy and Share sit side by side and WRAP to a second line rather than
        // clipping a long translated label at textScale 1.3. Both are >= 48dp.
        Wrap(
          spacing: AppSpacing.space3,
          runSpacing: AppSpacing.space3,
          children: [
            FilledButton.tonalIcon(
              onPressed: _copy,
              style: FilledButton.styleFrom(minimumSize: const Size(0, 48)),
              icon: const Icon(LucideIcons.copy, size: AppIconSize.inline),
              label: Text(l10n.actionCopy),
            ),
            FilledButton.tonalIcon(
              onPressed: _share,
              style: FilledButton.styleFrom(minimumSize: const Size(0, 48)),
              icon: const Icon(LucideIcons.share2, size: AppIconSize.inline),
              label: Text(l10n.actionShare),
            ),
          ],
        ),
      ],
    );
  }
}

/// The Save action in each of its four states. Saved is a quiet confirmation
/// line, not a button that could be pressed again; failed is a real error
/// surface with a retry, so a lost save can never read as a success.
class _SaveArea extends StatelessWidget {
  const _SaveArea({required this.status, required this.onSave});

  final ResultSaveStatus status;
  final Future<void> Function() onSave;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final scheme = Theme.of(context).colorScheme;

    switch (status) {
      case ResultSaveStatus.saved:
        return Row(
          children: [
            Icon(
              LucideIcons.checkCircle,
              size: AppIconSize.inline,
              color: scheme.primary,
            ),
            const SizedBox(width: AppSpacing.space2),
            Expanded(
              child: Text(
                l10n.resultSaved,
                style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                  color: scheme.onSurfaceVariant,
                  height: 1.4,
                ),
              ),
            ),
          ],
        );

      case ResultSaveStatus.failed:
        return Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          mainAxisSize: MainAxisSize.min,
          children: [
            InlineError(
              title: l10n.resultSaveFailedTitle,
              message: l10n.resultSaveFailedBody,
            ),
            const SizedBox(height: AppSpacing.space3),
            Align(
              alignment: Alignment.centerLeft,
              child: OutlinedButton.icon(
                onPressed: onSave,
                icon: const Icon(
                  LucideIcons.refreshCw,
                  size: AppIconSize.inline,
                ),
                label: Text(l10n.resultSaveRetry),
              ),
            ),
          ],
        );

      case ResultSaveStatus.idle:
      case ResultSaveStatus.saving:
        final saving = status == ResultSaveStatus.saving;
        return PrimaryButton(
          label: saving ? l10n.resultSaving : l10n.resultSaveToLibrary,
          icon: saving ? null : LucideIcons.save,
          isBusy: saving,
          onPressed: onSave,
        );
    }
  }
}
