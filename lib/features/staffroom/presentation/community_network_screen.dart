import 'package:flutter/material.dart';
import 'package:flutter/semantics.dart';
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
import 'group_detail_screen.dart';
import 'widgets/community_pill_button.dart';
import 'widgets/connection_action.dart';
import 'widgets/group_chip.dart';
import 'widgets/staffroom_avatar.dart';

/// Opens [CommunityNetworkScreen]. It is pushed imperatively on the app's
/// navigator (it has no deep-link path of its own), above whichever Community
/// surface opened it.
Future<void> openCommunityNetwork(BuildContext context) =>
    Navigator.of(context).push<void>(
      MaterialPageRoute<void>(builder: (_) => const CommunityNetworkScreen()),
    );

/// A display name typed ALL CAPS or all lower case, shown in title case
/// ("ANITA RAO" → "Anita Rao"). Mixed-case names are left exactly as typed,
/// and scripts without case are unchanged. Display only: the stored name is
/// never rewritten.
String networkDisplayName(String name) {
  final trimmed = name.trim();
  final upper = trimmed.toUpperCase();
  final lower = trimmed.toLowerCase();
  // No case at all (Devanagari, Tamil, …), or already mixed: as typed.
  if (upper == lower || (trimmed != upper && trimmed != lower)) return trimmed;
  return trimmed
      .split(RegExp(r'\s+'))
      .map(
        (word) => word.isEmpty
            ? word
            : word[0].toUpperCase() + word.substring(1).toLowerCase(),
      )
      .join(' ');
}

/// "Your network" (UX map `groups`): the teacher's groups, groups worth
/// joining, people they may know, and the teachers they are connected with —
/// all from the live routes, never sample data:
///
///   - **count pills** — groups, connected teachers, and requests waiting,
///     each shown only once its read has answered;
///   - **Your groups · N** — `GET /api/groups`, a two-column grid; a tile
///     opens the group;
///   - **Groups for you** — `GET /api/groups/discover`, each with **Join**;
///   - **Teachers you may know** — `GET /api/community/teachers/recommended`,
///     each with Connect → Requested (or Accept / Message as it applies);
///   - **Your teachers · N** — `GET /api/connections/mine` (uids) resolved to
///     names by `POST /api/community/profiles`, a three-column grid; a tile
///     opens the DM, and pressing and holding it offers Disconnect.
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

  /// The gap between a section label and its content, and between grid tiles.
  static const double _gap = 10;

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
        subtitle: l10n.cmNetSubtitle,
      ),
    ];

    if (uid == null) {
      return Scaffold(
        backgroundColor: Colors.transparent,
        body: SafeArea(
          child: ListView(
            padding: _padding,
            children: [
              ...header,
              const SizedBox(height: AppSpacing.space4),
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
    final connections = ref.watch(connectionsControllerProvider).valueOrNull;
    final connectedUids = connections?.connectedUids ?? const <String>[];
    final groupCount = myGroups.valueOrNull?.length;

    return Scaffold(
      backgroundColor: Colors.transparent,
      body: SafeArea(
        child: RefreshIndicator(
          onRefresh: () => _refresh(ref),
          child: ListView(
            padding: _padding,
            children: [
              ...header,
              const SizedBox(height: AppSpacing.space3),
              _CountPills(
                groups: groupCount,
                teachers: connections?.connectedUids.length,
                requests: connections?.receivedRequests.length,
              ),
              const SizedBox(height: AppSpacing.space6),

              // ── Your groups ──
              _Overline(
                groupCount == null
                    ? l10n.staffroomSectionGroups
                    : l10n.cmNetYourGroups(groupCount),
              ),
              _section<List<Group>>(
                value: myGroups,
                onRetry: () => ref.invalidate(myGroupsProvider),
                isEmpty: (groups) => groups.isEmpty,
                empty: (_) => MapEmptyNote(
                  icon: LucideIcons.users,
                  title: l10n.staffroomGroupsEmptyTitle,
                  message: l10n.staffroomGroupsEmptyBody,
                ),
                data: (groups) => _Grid(
                  columns: 2,
                  gap: _gap,
                  children: [
                    for (final g in groups)
                      _GroupTile(
                        key: ValueKey<String>('network-group-${g.id}'),
                        group: g,
                        onTap: () => context.push(
                          Routes.groupDetailPath(g.id),
                          extra: g,
                        ),
                      ),
                  ],
                ),
              ),
              const SizedBox(height: AppSpacing.space6),

              // ── Groups for you ──
              _Overline(l10n.cmNetGroupsForYou),
              _section<List<Group>>(
                value: discover,
                onRetry: () => ref.invalidate(discoverGroupsProvider),
                isEmpty: (groups) => groups.isEmpty,
                empty: (_) => MapEmptyNote(
                  icon: LucideIcons.users,
                  message: l10n.communityNoSuggestedGroups,
                ),
                data: (groups) => _RowsCard(
                  children: [
                    for (final g in groups)
                      _NetworkRow(
                        key: ValueKey<String>('network-suggested-${g.id}'),
                        leading: _GroupGlyph(group: g),
                        title: g.name,
                        subtitle: groupMemberLine(l10n, g),
                        onTap: () => context.push(
                          Routes.groupDetailPath(g.id),
                          extra: g,
                        ),
                        trailing: _JoinGroupPill(groupId: g.id),
                      ),
                  ],
                ),
              ),
              const SizedBox(height: AppSpacing.space6),

              // ── Teachers you may know ──
              _Overline(l10n.cmNetTeachersYouMayKnow),
              _section<List<TeacherSuggestion>>(
                value: people,
                onRetry: () => ref.invalidate(recommendedTeachersProvider),
                isEmpty: (list) => list.isEmpty,
                empty: (_) => MapEmptyNote(
                  icon: LucideIcons.userPlus,
                  message: l10n.communityNoPeople,
                ),
                data: (list) => _RowsCard(
                  children: [
                    for (final t in list)
                      TeacherRow(
                        key: ValueKey<String>('network-person-${t.uid}'),
                        teacher: t,
                      ),
                  ],
                ),
              ),

              // ── Your teachers ──
              if (connectedUids.isNotEmpty) ...[
                const SizedBox(height: AppSpacing.space6),
                _Overline(l10n.cmNetYourTeachers(connectedUids.length)),
                _ConnectionsGrid(uids: connectedUids),
              ],
            ],
          ),
        ),
      ),
    );
  }

  /// One independently loading / failing section: a skeleton or a retry in a
  /// [MapCard] until its read answers, then [empty] (in a card) or [data].
  static Widget _section<T>({
    required AsyncValue<T> value,
    required VoidCallback onRetry,
    required bool Function(T) isEmpty,
    required Widget Function(T) empty,
    required Widget Function(T) data,
  }) {
    return value.when(
      skipLoadingOnRefresh: true,
      loading: () => const MapCard(child: AppSkeleton(lines: 2)),
      error: (_, _) => MapCard(child: SectionRetry(onRetry: onRetry)),
      data: (value) =>
          isEmpty(value) ? MapCard(child: empty(value)) : data(value),
    );
  }
}

/// A section label in the map's saffron eyebrow ink, with the gap under it.
class _Overline extends StatelessWidget {
  const _Overline(this.label);

  final String label;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(
        left: 2,
        right: 2,
        bottom: CommunityNetworkScreen._gap,
      ),
      child: Semantics(
        header: true,
        child: MapOverline(label, color: AppColors.textEyebrow),
      ),
    );
  }
}

/// The count pills under the title: groups, connected teachers and requests
/// waiting. A pill shows only once its read has answered (never a guessed 0),
/// and requests only when there are some.
class _CountPills extends StatelessWidget {
  const _CountPills({this.groups, this.teachers, this.requests});

  final int? groups;
  final int? teachers;
  final int? requests;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final groups = this.groups;
    final teachers = this.teachers;
    final requests = this.requests;
    final pills = <Widget>[
      if (groups != null)
        _CountPill(label: l10n.cmNetGroupCount(groups), tint: MapTint.indigo),
      if (teachers != null)
        _CountPill(
          label: l10n.cmGroupTeacherCount(teachers),
          tint: MapTint.leaf,
        ),
      if (requests != null && requests > 0)
        _CountPill(
          label: l10n.communityRequestsWaiting(requests),
          tint: MapTint.saffron,
        ),
    ];
    if (pills.isEmpty) return const SizedBox.shrink();
    return Wrap(
      spacing: AppSpacing.space2,
      runSpacing: AppSpacing.space2,
      children: pills,
    );
  }
}

class _CountPill extends StatelessWidget {
  const _CountPill({required this.label, required this.tint});

  final String label;
  final MapTint tint;

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: ShapeDecoration(
        color: tint.fill,
        shape: const StadiumBorder(),
      ),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
        child: Text(
          label,
          style: Theme.of(context).textTheme.labelMedium?.copyWith(
            fontSize: 12.5,
            fontWeight: FontWeight.w700,
            color: tint.ink,
          ),
        ),
      ),
    );
  }
}

/// A grid of [columns] equal-width cells; each row is as tall as its tallest
/// tile, so long names wrap without clipping or uneven tiles.
class _Grid extends StatelessWidget {
  const _Grid({
    required this.columns,
    required this.gap,
    required this.children,
  });

  final int columns;
  final double gap;
  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    final rows = <Widget>[];
    for (var start = 0; start < children.length; start += columns) {
      if (rows.isNotEmpty) rows.add(SizedBox(height: gap));
      rows.add(
        IntrinsicHeight(
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              for (var i = 0; i < columns; i++) ...[
                if (i > 0) SizedBox(width: gap),
                Expanded(
                  child: start + i < children.length
                      ? children[start + i]
                      : const SizedBox.shrink(),
                ),
              ],
            ],
          ),
        ),
      );
    }
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      mainAxisSize: MainAxisSize.min,
      children: rows,
    );
  }
}

/// One of the teacher's groups: the group's tinted band with its glyph, the
/// name, and "N teachers · active …". The whole tile opens the group.
class _GroupTile extends StatelessWidget {
  const _GroupTile({super.key, required this.group, required this.onTap});

  final Group group;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final text = Theme.of(context).textTheme;
    final tint = groupTint(group);
    return Semantics(
      button: true,
      child: MapCard(
        onTap: onTap,
        padding: EdgeInsets.zero,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Container(
              height: 46,
              color: tint.fill,
              padding: const EdgeInsets.symmetric(horizontal: 12),
              alignment: AlignmentDirectional.centerStart,
              child: ExcludeSemantics(
                child: Icon(groupIcon(group), size: 20, color: tint.ink),
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(12, 10, 12, 12),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    group.name,
                    style: text.titleLarge?.copyWith(
                      fontSize: 14,
                      height: 1.25,
                      fontWeight: FontWeight.w700,
                      color: AppColors.textStrong,
                    ),
                  ),
                  const SizedBox(height: 3),
                  Text(
                    groupMemberLine(l10n, group),
                    style: text.bodySmall?.copyWith(
                      fontSize: 12,
                      height: 1.35,
                      color: AppColors.textMuted,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// A group's 40px icon tile in its tint.
class _GroupGlyph extends StatelessWidget {
  const _GroupGlyph({required this.group});

  final Group group;

  @override
  Widget build(BuildContext context) {
    final tint = groupTint(group);
    return ExcludeSemantics(
      child: Container(
        width: 40,
        height: 40,
        decoration: BoxDecoration(
          color: tint.fill,
          borderRadius: AppRadius.rRow,
        ),
        child: Icon(groupIcon(group), size: 18, color: tint.ink),
      ),
    );
  }
}

/// One card holding [children] as rows, with a hairline between rows.
class _RowsCard extends StatelessWidget {
  const _RowsCard({required this.children});

  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    return MapCard(
      padding: const EdgeInsets.symmetric(vertical: 2),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        mainAxisSize: MainAxisSize.min,
        children: [
          for (var i = 0; i < children.length; i++) ...[
            if (i > 0)
              const Divider(
                height: 1,
                thickness: 1,
                indent: 14,
                endIndent: 14,
                color: AppColors.borderHairline,
              ),
            children[i],
          ],
        ],
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

/// The map's `.row`: a leading glyph, a bold display-face title over a muted
/// line (and anything [below] it), and an optional trailing action. Text wraps
/// (never ellipsized); the row is at least 72dp tall and, with [onTap], one
/// ink target.
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
  final Widget? below;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final text = Theme.of(context).textTheme;
    final subtitle = this.subtitle;
    final trailing = this.trailing;
    final body = ConstrainedBox(
      constraints: const BoxConstraints(minHeight: 72),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
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
                    style: text.titleLarge?.copyWith(
                      fontSize: 14.5,
                      fontWeight: FontWeight.w700,
                      color: AppColors.textStrong,
                    ),
                  ),
                  if (subtitle != null && subtitle.isNotEmpty) ...[
                    const SizedBox(height: 2),
                    Text(
                      subtitle,
                      style: text.bodySmall?.copyWith(
                        fontSize: 12.5,
                        height: 1.35,
                        color: AppColors.textMuted,
                      ),
                    ),
                  ],
                  ?below,
                ],
              ),
            ),
            if (trailing != null) ...[
              const SizedBox(width: AppSpacing.space2),
              trailing,
            ],
          ],
        ),
      ),
    );
    if (onTap == null) return body;
    return Semantics(
      button: true,
      child: Material(
        type: MaterialType.transparency,
        child: InkWell(onTap: onTap, child: body),
      ),
    );
  }
}

/// One suggested teacher as a row: avatar, name, "subject · class · school"
/// from their profile, the translated reason they are suggested as a small
/// tinted chip, and the shared connection control.
class TeacherRow extends StatelessWidget {
  const TeacherRow({super.key, required this.teacher});

  final TeacherSuggestion teacher;

  /// A reason's tint: a shared subject or class leaf, the same school indigo,
  /// nearby saffron, anything else amber.
  static MapTint _reasonTint(String? reason) {
    final value = reason?.trim() ?? '';
    if (value == 'Same School') return MapTint.indigo;
    if (value == 'Nearby Peer') return MapTint.saffron;
    if (value.endsWith(' Peer')) return MapTint.leaf;
    return MapTint.amber;
  }

  static String? _first(List<String> values) =>
      values.map((s) => s.trim()).where((s) => s.isNotEmpty).firstOrNull;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final reason = communityReasonLabel(l10n, teacher.recommendationReason);
    final school = teacher.schoolName?.trim();
    // The map's "Science · Class 8 · Govt. High School": only what the
    // profile says.
    final meta = [
      ?_first(teacher.subjects),
      ?_first(teacher.gradeLevels),
      if (school != null && school.isNotEmpty) school,
    ].join(' · ');
    final name = networkDisplayName(teacher.displayName);
    final tint = _reasonTint(teacher.recommendationReason);
    return _NetworkRow(
      leading: StaffroomAvatar(
        name: name,
        photoUrl: teacher.photoURL,
        size: 46,
      ),
      title: name,
      subtitle: meta,
      below: reason == null
          ? null
          : Padding(
              padding: const EdgeInsets.only(top: 5),
              child: DecoratedBox(
                decoration: ShapeDecoration(
                  color: tint.fill,
                  shape: const StadiumBorder(),
                ),
                child: Padding(
                  padding: const EdgeInsets.symmetric(
                    horizontal: AppSpacing.space2,
                    vertical: 2,
                  ),
                  child: Text(
                    reason,
                    style: Theme.of(context).textTheme.labelSmall?.copyWith(
                      fontSize: 11.5,
                      fontWeight: FontWeight.w600,
                      color: tint.ink,
                    ),
                  ),
                ),
              ),
            ),
      trailing: TeacherConnectionAction(
        uid: teacher.uid,
        displayName: teacher.displayName,
        photoURL: teacher.photoURL,
        compact: true,
        filled: true,
        respond: true,
      ),
    );
  }
}

/// The teacher's accepted connections, named via the public-profile lookup,
/// as a three-column grid of tiles.
class _ConnectionsGrid extends ConsumerWidget {
  const _ConnectionsGrid({required this.uids});

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
      data: (byUid) => _Grid(
        columns: 3,
        gap: CommunityNetworkScreen._gap,
        children: [
          for (final uid in uids)
            _TeacherTile(
              key: ValueKey<String>('network-connection-$uid'),
              teacher:
                  byUid[uid] ??
                  TeacherSuggestion(
                    uid: uid,
                    displayName: l10n.communityUnknownTeacher,
                  ),
            ),
        ],
      ),
    );
  }
}

/// A connected teacher: avatar, name and "Message". A tap opens the DM; press
/// and hold (or the screen reader's actions menu) offers Disconnect, after a
/// confirmation. A failure shows as a snackbar, never silently.
class _TeacherTile extends ConsumerStatefulWidget {
  const _TeacherTile({super.key, required this.teacher});

  final TeacherSuggestion teacher;

  @override
  ConsumerState<_TeacherTile> createState() => _TeacherTileState();
}

class _TeacherTileState extends ConsumerState<_TeacherTile> {
  bool _busy = false;

  void _snack(String message) {
    ScaffoldMessenger.maybeOf(context)
      ?..hideCurrentSnackBar()
      ..showSnackBar(SnackBar(content: Text(message)));
  }

  Future<void> _message() async {
    if (_busy) return;
    final l10n = context.l10n;
    setState(() => _busy = true);
    try {
      await openDirectMessage(
        context,
        ref,
        otherUid: widget.teacher.uid,
        displayName: widget.teacher.displayName,
        photoURL: widget.teacher.photoURL,
      );
    } catch (error) {
      if (mounted) {
        _snack(
          communityErrorText(
            l10n,
            error,
            fallback: l10n.communityMessageFailed,
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _disconnect() async {
    if (_busy) return;
    final l10n = context.l10n;
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text(l10n.staffroomDisconnectConfirmTitle),
        content: Text(l10n.staffroomDisconnectConfirmBody),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(false),
            child: Text(l10n.staffroomDisconnectCancel),
          ),
          TextButton(
            onPressed: () => Navigator.of(context).pop(true),
            style: TextButton.styleFrom(foregroundColor: AppColors.danger),
            child: Text(l10n.staffroomDisconnect),
          ),
        ],
      ),
    );
    if (confirmed != true || !mounted) return;
    setState(() => _busy = true);
    try {
      await ref
          .read(connectionsControllerProvider.notifier)
          .disconnect(widget.teacher.uid);
    } catch (error) {
      if (mounted) {
        _snack(
          communityErrorText(
            l10n,
            error,
            fallback: l10n.staffroomConnectionFailed,
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final text = Theme.of(context).textTheme;
    final name = networkDisplayName(widget.teacher.displayName);
    return Semantics(
      button: true,
      label: '$name. ${l10n.staffroomMessage}',
      excludeSemantics: true,
      onTap: _message,
      customSemanticsActions: {
        CustomSemanticsAction(label: l10n.staffroomDisconnect): _disconnect,
      },
      child: MapCard(
        onTap: _message,
        padding: EdgeInsets.zero,
        child: GestureDetector(
          onLongPress: _disconnect,
          behavior: HitTestBehavior.opaque,
          child: Padding(
            padding: const EdgeInsets.fromLTRB(8, 14, 8, 12),
            child: Column(
              children: [
                StaffroomAvatar(
                  name: name,
                  photoUrl: widget.teacher.photoURL,
                  size: 50,
                ),
                const SizedBox(height: 6),
                Text(
                  name,
                  textAlign: TextAlign.center,
                  style: text.titleLarge?.copyWith(
                    fontSize: 13.5,
                    height: 1.25,
                    fontWeight: FontWeight.w700,
                    color: AppColors.textStrong,
                  ),
                ),
                const Spacer(),
                const SizedBox(height: 6),
                if (_busy)
                  const SizedBox.square(
                    dimension: 16,
                    child: CircularProgressIndicator(
                      strokeWidth: 2,
                      color: AppColors.textLink,
                    ),
                  )
                else
                  Text(
                    l10n.staffroomMessage,
                    textAlign: TextAlign.center,
                    style: text.labelMedium?.copyWith(
                      fontSize: 12.5,
                      fontWeight: FontWeight.w700,
                      color: AppColors.textLink,
                    ),
                  ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// **Join** for a suggested group: `POST /api/groups/{id}/membership`, then
/// every membership-dependent read is refreshed (the group moves to "Your
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
            Icon(
              LucideIcons.check,
              size: AppIconSize.micro,
              color: MapTint.leaf.ink,
            ),
            const SizedBox(width: AppSpacing.space1),
            Text(
              l10n.staffroomJoined,
              style: Theme.of(context).textTheme.labelMedium?.copyWith(
                fontWeight: FontWeight.w700,
                color: MapTint.leaf.ink,
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
