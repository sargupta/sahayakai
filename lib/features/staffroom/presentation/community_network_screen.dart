import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons/lucide_icons.dart';

import '../../../core/i18n/l10n_ext.dart';
import '../../../core/router/routes.dart';
import '../../../core/theme/app_theme.dart';
import '../../../shared/widgets/app_skeleton.dart';
import '../../../shared/widgets/map_card.dart';
import '../../../shared/widgets/map_icon_tile.dart';
import '../../../shared/widgets/map_page_header.dart';
import '../../../shared/widgets/secondary_button.dart';
import '../data/staffroom_providers.dart';
import '../data/staffroom_transport.dart';
import '../data/teacher_profiles.dart';
import '../domain/group.dart';
import '../domain/teacher.dart';
import 'community_errors.dart';
import 'widgets/community_pill_button.dart';
import 'widgets/connection_action.dart';
import 'widgets/staffroom_avatar.dart';

/// Opens [CommunityNetworkScreen]. It is pushed imperatively on the app's
/// navigator (it has no deep-link path of its own), above whichever Community
/// surface opened it.
Future<void> openCommunityNetwork(BuildContext context) =>
    Navigator.of(context).push<void>(
      MaterialPageRoute<void>(builder: (_) => const CommunityNetworkScreen()),
    );

/// "Your network" (UX map `groups`): the teacher's groups, groups worth
/// joining, their connections, and people they may know — all from the live
/// routes, never sample data:
///
///   - **My groups · N** — `GET /api/groups`; a row opens the group;
///   - **Suggested groups** — `GET /api/groups/discover`, each with **Join**;
///   - **Connections · N** — `GET /api/connections/mine` (uids) resolved to
///     names by `POST /api/community/profiles`, each with Message / Disconnect;
///   - **People you may know** — `GET /api/community/teachers/recommended`,
///     each with Connect → Requested (or Accept / Message as it applies).
///
/// Each section loads and fails on its own (a failed suggestions read never
/// hides the teacher's groups), with an inline retry. Pull to refresh reloads
/// everything.
class CommunityNetworkScreen extends ConsumerWidget {
  const CommunityNetworkScreen({super.key});

  static const EdgeInsets _padding = EdgeInsets.fromLTRB(
    AppSpacing.mapGutter,
    AppSpacing.space2,
    AppSpacing.mapGutter,
    AppSpacing.mapBottomClearance,
  );

  Future<void> _refresh(WidgetRef ref) async {
    ref
      ..invalidate(myGroupsProvider)
      ..invalidate(discoverGroupsProvider)
      ..invalidate(recommendedTeachersProvider)
      ..invalidate(connectionsControllerProvider);
    await ref
        .read(myGroupsProvider.future)
        .catchError((Object _) => const <Group>[]);
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = context.l10n;
    final uid = ref.watch(currentStaffroomUserIdProvider);

    final header = <Widget>[
      const MapPageHeader(),
      const SizedBox(height: AppSpacing.space2),
      MapPageTitle(
        title: l10n.communityYourNetwork,
        subtitle: l10n.communityGroupsAndPeople,
      ),
      const SizedBox(height: AppSpacing.space4),
    ];

    if (uid == null) {
      return Scaffold(
        backgroundColor: Colors.transparent,
        body: SafeArea(
          child: ListView(
            padding: _padding,
            children: [
              ...header,
              MapCard(
                child: MapEmptyNote(
                  icon: LucideIcons.users,
                  title: l10n.staffroomSignInTitle,
                  message: l10n.staffroomSignInBody,
                  action: SecondaryButton(
                    label: l10n.actionSignIn,
                    icon: LucideIcons.logIn,
                    onPressed: () =>
                        context.push(Routes.loginWithReturnTo(Routes.network)),
                  ),
                ),
              ),
            ],
          ),
        ),
      );
    }

    final myGroups = ref.watch(myGroupsProvider);
    final discover = ref.watch(discoverGroupsProvider);
    final people = ref.watch(recommendedTeachersProvider);
    final connections = ref.watch(connectionsControllerProvider);
    final connectedUids =
        connections.valueOrNull?.connectedUids ?? const <String>[];

    return Scaffold(
      backgroundColor: Colors.transparent,
      body: SafeArea(
        child: RefreshIndicator(
          onRefresh: () => _refresh(ref),
          child: ListView(
            padding: _padding,
            children: [
              ...header,
              // ── My groups ──
              MapOverline(
                l10n.communityMyGroupsCount(myGroups.valueOrNull?.length ?? 0),
              ),
              const SizedBox(height: AppSpacing.space2),
              _section<List<Group>>(
                context,
                value: myGroups,
                onRetry: () => ref.invalidate(myGroupsProvider),
                empty: (_) => MapEmptyNote(
                  icon: LucideIcons.users,
                  title: l10n.staffroomGroupsEmptyTitle,
                  message: l10n.staffroomGroupsEmptyBody,
                ),
                isEmpty: (groups) => groups.isEmpty,
                rows: (groups) => [
                  for (final g in groups)
                    _NetworkRow(
                      key: ValueKey<String>('network-group-${g.id}'),
                      leading: const MapIconTile(
                        icon: LucideIcons.users,
                        tint: MapTint.leaf,
                      ),
                      title: g.name,
                      subtitle: l10n.staffroomMemberCount(g.memberCount),
                      onTap: () =>
                          context.push(Routes.groupDetailPath(g.id), extra: g),
                    ),
                ],
              ),
              const SizedBox(height: AppSpacing.space5),

              // ── Suggested groups ──
              MapOverline(l10n.communitySuggestedGroups),
              const SizedBox(height: AppSpacing.space2),
              _section<List<Group>>(
                context,
                value: discover,
                onRetry: () => ref.invalidate(discoverGroupsProvider),
                isEmpty: (groups) => groups.isEmpty,
                empty: (_) => MapEmptyNote(
                  icon: LucideIcons.users,
                  message: l10n.communityNoSuggestedGroups,
                ),
                rows: (groups) => [
                  for (final g in groups)
                    _NetworkRow(
                      key: ValueKey<String>('network-suggested-${g.id}'),
                      leading: const MapIconTile(
                        icon: LucideIcons.users,
                        tint: MapTint.indigo,
                      ),
                      title: g.name,
                      subtitle: l10n.staffroomMemberCount(g.memberCount),
                      onTap: () =>
                          context.push(Routes.groupDetailPath(g.id), extra: g),
                      trailing: _JoinGroupPill(groupId: g.id),
                    ),
                ],
              ),

              // ── Connections ──
              if (connectedUids.isNotEmpty) ...[
                const SizedBox(height: AppSpacing.space5),
                MapOverline(
                  l10n.communityConnectionsCount(connectedUids.length),
                ),
                const SizedBox(height: AppSpacing.space2),
                _ConnectionsList(uids: connectedUids),
              ],
              const SizedBox(height: AppSpacing.space5),

              // ── People you may know ──
              MapOverline(l10n.staffroomSectionPeople),
              const SizedBox(height: AppSpacing.space2),
              _section<List<TeacherSuggestion>>(
                context,
                value: people,
                onRetry: () => ref.invalidate(recommendedTeachersProvider),
                isEmpty: (list) => list.isEmpty,
                empty: (_) => MapEmptyNote(
                  icon: LucideIcons.userPlus,
                  message: l10n.communityNoPeople,
                ),
                rows: (list) => [
                  for (final t in list)
                    TeacherRow(
                      key: ValueKey<String>('network-person-${t.uid}'),
                      teacher: t,
                    ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }

  /// One independently loading / failing section in a [MapCard].
  static Widget _section<T>(
    BuildContext context, {
    required AsyncValue<T> value,
    required VoidCallback onRetry,
    required bool Function(T) isEmpty,
    required Widget Function(T) empty,
    required List<Widget> Function(T) rows,
  }) {
    return value.when(
      skipLoadingOnRefresh: true,
      loading: () => const MapCard(child: AppSkeleton(lines: 2)),
      error: (_, _) => MapCard(child: SectionRetry(onRetry: onRetry)),
      data: (data) => isEmpty(data)
          ? MapCard(child: empty(data))
          : MapCard(
              padding: const EdgeInsets.symmetric(vertical: AppSpacing.space1),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                mainAxisSize: MainAxisSize.min,
                children: rows(data),
              ),
            ),
    );
  }
}

/// A section that failed to load: one honest line and a retry, inside the
/// section's own card so the rest of the screen stays usable.
class SectionRetry extends StatelessWidget {
  const SectionRetry({super.key, required this.onRetry, this.message});

  final VoidCallback onRetry;
  final String? message;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    return Row(
      children: [
        const MapIconTile(icon: LucideIcons.alertCircle),
        const SizedBox(width: AppSpacing.space3),
        Expanded(
          child: Text(
            message ?? l10n.communityNetworkLoadFailed,
            style: Theme.of(
              context,
            ).textTheme.bodyMedium?.copyWith(color: AppColors.textStrong),
          ),
        ),
        TextButton(
          onPressed: onRetry,
          style: TextButton.styleFrom(
            foregroundColor: AppColors.textLink,
            minimumSize: const Size(48, 48),
          ),
          child: Text(l10n.actionRetry),
        ),
      ],
    );
  }
}

/// The map's `.row`: a leading glyph, a bold title over a muted line, and an
/// optional trailing action. Text wraps (never ellipsized); the row is at least
/// 56dp tall and, with [onTap], one ink target.
class _NetworkRow extends StatelessWidget {
  const _NetworkRow({
    super.key,
    required this.leading,
    required this.title,
    this.subtitle,
    this.trailing,
    this.below,
    this.onTap,
  });

  final Widget leading;
  final String title;
  final String? subtitle;
  final Widget? trailing;

  /// An action laid out UNDER the text (start-aligned) rather than beside it —
  /// for controls with two buttons, which would otherwise squeeze the name.
  final Widget? below;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final text = Theme.of(context).textTheme;
    final subtitle = this.subtitle;
    final body = ConstrainedBox(
      constraints: const BoxConstraints(minHeight: 56),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
        child: Row(
          children: [
            leading,
            const SizedBox(width: AppSpacing.space3),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    title,
                    style: text.bodyLarge?.copyWith(
                      fontSize: 14,
                      fontWeight: FontWeight.w700,
                      color: AppColors.textStrong,
                    ),
                  ),
                  if (subtitle != null && subtitle.isNotEmpty)
                    Text(
                      subtitle,
                      style: text.bodyMedium?.copyWith(
                        color: AppColors.textMuted,
                      ),
                    ),
                  ?below,
                ],
              ),
            ),
            if (trailing != null) ...[
              const SizedBox(width: AppSpacing.space2),
              trailing!,
            ],
          ],
        ),
      ),
    );
    if (onTap == null) return body;
    return Material(
      type: MaterialType.transparency,
      child: InkWell(onTap: onTap, child: body),
    );
  }
}

/// One teacher as a compact row: avatar, name, the translated reason (or
/// school), and the shared connection control.
class TeacherRow extends StatelessWidget {
  const TeacherRow({
    super.key,
    required this.teacher,
    this.allowDisconnect = false,
  });

  final TeacherSuggestion teacher;
  final bool allowDisconnect;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final reason = communityReasonLabel(l10n, teacher.recommendationReason);
    final school = teacher.schoolName?.trim();
    final subject = teacher.subjects
        .map((s) => s.trim())
        .where((s) => s.isNotEmpty)
        .firstOrNull;
    // The map's "Science · same school · Pune": only what the profile says.
    final meta = [
      ?subject,
      ?reason,
      if (school != null && school.isNotEmpty) school,
    ].join(' · ');
    final action = TeacherConnectionAction(
      uid: teacher.uid,
      displayName: teacher.displayName,
      photoURL: teacher.photoURL,
      allowDisconnect: allowDisconnect,
      // A suggestion gets the map's small chip on the right; a connection
      // keeps Message + Disconnect under the name, where two buttons fit.
      compact: !allowDisconnect,
      filled: true,
      respond: true,
    );
    return _NetworkRow(
      leading: StaffroomAvatar(
        name: teacher.displayName,
        photoUrl: teacher.photoURL,
        size: 36,
      ),
      title: teacher.displayName,
      subtitle: meta,
      trailing: allowDisconnect ? null : action,
      below: allowDisconnect ? action : null,
    );
  }
}

/// The teacher's accepted connections, named via the public-profile lookup.
class _ConnectionsList extends ConsumerWidget {
  const _ConnectionsList({required this.uids});

  final List<String> uids;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = context.l10n;
    final key = teacherProfilesKey(uids);
    final profiles = ref.watch(teacherProfilesProvider(key));
    return profiles.when(
      skipLoadingOnRefresh: true,
      loading: () => const MapCard(child: AppSkeleton(lines: 2)),
      error: (_, _) => MapCard(
        child: SectionRetry(
          onRetry: () => ref.invalidate(teacherProfilesProvider(key)),
        ),
      ),
      data: (byUid) => MapCard(
        padding: const EdgeInsets.symmetric(vertical: AppSpacing.space1),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          mainAxisSize: MainAxisSize.min,
          children: [
            for (final uid in uids)
              TeacherRow(
                key: ValueKey<String>('network-connection-$uid'),
                allowDisconnect: true,
                teacher:
                    byUid[uid] ??
                    TeacherSuggestion(
                      uid: uid,
                      displayName: l10n.communityUnknownTeacher,
                    ),
              ),
          ],
        ),
      ),
    );
  }
}

/// **Join** for a suggested group: `POST /api/groups/{id}/membership`, then
/// every membership-dependent read is refreshed (the group moves to "My
/// groups", its posts reach the feed). Failure → a translated inline reason.
class _JoinGroupPill extends ConsumerStatefulWidget {
  const _JoinGroupPill({required this.groupId});

  final String groupId;

  @override
  ConsumerState<_JoinGroupPill> createState() => _JoinGroupPillState();
}

class _JoinGroupPillState extends ConsumerState<_JoinGroupPill> {
  bool _busy = false;
  bool _joined = false;
  String? _error;

  Future<void> _join() async {
    if (_busy || _joined) return;
    final l10n = context.l10n;
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await ref.read(staffroomTransportProvider).joinGroup(widget.groupId);
      if (!mounted) return;
      setState(() {
        _busy = false;
        _joined = true;
      });
      invalidateAfterMembershipChange(ref, widget.groupId);
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _busy = false;
        _error = communityErrorText(
          l10n,
          error,
          fallback: l10n.staffroomJoinFailed,
        );
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    if (_joined) {
      return ConstrainedBox(
        constraints: const BoxConstraints(minHeight: 48),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(LucideIcons.check, size: 15, color: AppColors.textLink),
            const SizedBox(width: AppSpacing.space1),
            Text(
              l10n.staffroomJoined,
              style: Theme.of(context).textTheme.labelMedium?.copyWith(
                fontWeight: FontWeight.w700,
                color: AppColors.textLink,
              ),
            ),
          ],
        ),
      );
    }
    return Column(
      crossAxisAlignment: CrossAxisAlignment.end,
      mainAxisSize: MainAxisSize.min,
      children: [
        CommunityPillButton(
          label: l10n.staffroomJoin,
          busy: _busy,
          onPressed: _join,
        ),
        if (_error != null)
          ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 160),
            child: Text(
              _error!,
              textAlign: TextAlign.end,
              style: Theme.of(
                context,
              ).textTheme.bodySmall?.copyWith(color: AppColors.danger),
            ),
          ),
      ],
    );
  }
}
