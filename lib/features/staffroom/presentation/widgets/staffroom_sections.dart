import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons/lucide_icons.dart';

import '../../../../core/i18n/l10n_ext.dart';
import '../../../../core/platform/clock.dart';
import '../../../../core/router/routes.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../shared/widgets/map_card.dart';
import '../../../../shared/widgets/map_icon_tile.dart';
import '../../../../shared/widgets/primary_button.dart';
import '../../../inbox/presentation/inbox_time.dart';
import '../../data/chat_stream_provider.dart';
import '../../domain/chat_message.dart';
import '../../domain/group.dart';
import '../../domain/staff_room_glance.dart';
import '../../domain/teacher.dart';
import '../community_network_screen.dart' show openCommunityNetwork;
import '../share_to_community_sheet.dart';
import 'connection_action.dart';
import 'post_type_style.dart';
import 'staffroom_avatar.dart';

// The Staffroom pane's own sections (the approved Community canvas): the live
// staff room, Share with teachers, Your groups as a row of cards, and
// teachers you may know as a row inside the feed. Every name and count comes
// from the live providers; a section with nothing to show is left out.

/// An overline with an optional link on the right ("Your network ›").
class StaffroomSectionHead extends StatelessWidget {
  const StaffroomSectionHead({
    super.key,
    required this.label,
    this.linkLabel,
    this.onLink,
  });

  final String label;
  final String? linkLabel;
  final VoidCallback? onLink;

  @override
  Widget build(BuildContext context) {
    final link = linkLabel;
    return Row(
      children: [
        Expanded(child: MapOverline(label, color: AppColors.textEyebrow)),
        if (link != null && onLink != null)
          Semantics(
            button: true,
            label: link,
            excludeSemantics: true,
            child: InkWell(
              onTap: onLink,
              borderRadius: AppRadius.rPill,
              child: ConstrainedBox(
                constraints: const BoxConstraints(minHeight: 44),
                child: Padding(
                  padding: const EdgeInsetsDirectional.only(start: 8),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(
                        link,
                        style: Theme.of(context).textTheme.labelLarge?.copyWith(
                          fontSize: 13,
                          fontWeight: FontWeight.w700,
                          color: AppColors.textEyebrow,
                        ),
                      ),
                      const Icon(
                        LucideIcons.chevronRight,
                        size: 15,
                        color: AppColors.textEyebrow,
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ),
      ],
    );
  }
}

// ─── The staff room, live ───────────────────────────────────────────────────

/// Who is talking in the staff room today, the newest message (an AI
/// teacher's is marked), and "Join the conversation".
class StaffRoomLiveCard extends ConsumerWidget {
  const StaffRoomLiveCard({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = context.l10n;
    final text = Theme.of(context).textTheme;
    final now = ref.watch(nowProvider)();
    final messages = ref
        .watch(staffRoomChatProvider)
        .maybeWhen(
          data: (snapshot) => snapshot.isReady ? snapshot.data : null,
          orElse: () => null,
        );
    final glance = messages == null
        ? StaffRoomGlance.empty
        : glanceAtStaffRoom(messages, now);
    final talkers = glance.talkersToday;
    final latest = glance.latest;

    String? whoLine;
    if (talkers.length == 1) {
      whoLine = l10n.cmFeedInChatOne(_first(talkers[0].authorName));
    } else if (talkers.length == 2) {
      whoLine = l10n.cmFeedInChatTwo(
        _first(talkers[0].authorName),
        _first(talkers[1].authorName),
      );
    } else if (talkers.length > 2) {
      whoLine = l10n.cmFeedInChatMany(
        _first(talkers[0].authorName),
        _first(talkers[1].authorName),
        talkers.length - 2,
      );
    }

    return Container(
      key: const ValueKey('staffroom-live'),
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: AppColors.surfaceCard,
        borderRadius: BorderRadius.circular(24),
        border: Border.all(color: AppColors.borderGlass),
        boxShadow: const [
          BoxShadow(
            color: Color(0x12171310),
            blurRadius: 24,
            offset: Offset(0, 8),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              Expanded(
                child: MapOverline(
                  l10n.cmFeedStaffRoom,
                  color: AppColors.textEyebrow,
                ),
              ),
              if (talkers.isNotEmpty)
                Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Container(
                      width: 8,
                      height: 8,
                      decoration: const BoxDecoration(
                        color: AppColors.leaf500,
                        shape: BoxShape.circle,
                      ),
                    ),
                    const SizedBox(width: 6),
                    Text(
                      l10n.cmFeedTalkingToday(talkers.length),
                      style: text.labelMedium?.copyWith(
                        fontWeight: FontWeight.w600,
                        color: AppColors.tileLeafInk,
                      ),
                    ),
                  ],
                ),
            ],
          ),
          if (whoLine != null) ...[
            const SizedBox(height: AppSpacing.space3),
            Row(
              children: [
                _AvatarStack(talkers: talkers),
                const SizedBox(width: AppSpacing.space3),
                Expanded(
                  child: Text(
                    whoLine,
                    style: text.bodyMedium?.copyWith(
                      fontSize: 13.5,
                      color: AppColors.textBody,
                    ),
                  ),
                ),
              ],
            ),
          ],
          if (latest != null) ...[
            const SizedBox(height: AppSpacing.space3),
            _LatestMessage(message: latest, now: now),
          ] else ...[
            const SizedBox(height: AppSpacing.space2),
            Text(
              l10n.cmFeedChatQuiet,
              style: text.bodyMedium?.copyWith(color: AppColors.textBody),
            ),
          ],
          const SizedBox(height: AppSpacing.space3),
          PrimaryButton(
            key: const ValueKey('staffroom-join-chat'),
            label: l10n.cmFeedJoinChat,
            icon: LucideIcons.messageCircle,
            onPressed: () => context.push(Routes.staffRoomChat),
          ),
        ],
      ),
    );
  }

  static String _first(String name) {
    final words = name.trim().split(RegExp(r'\s+'));
    return words.isEmpty ? name : words.first;
  }
}

class _AvatarStack extends StatelessWidget {
  const _AvatarStack({required this.talkers});

  final List<ChatMessage> talkers;

  @override
  Widget build(BuildContext context) {
    final shown = talkers.take(3).toList();
    final extra = talkers.length - shown.length;
    final count = shown.length + (extra > 0 ? 1 : 0);
    return ExcludeSemantics(
      child: SizedBox(
        width: 34.0 + 24.0 * (count - 1),
        height: 34,
        child: Stack(
          children: [
            for (var i = 0; i < shown.length; i++)
              PositionedDirectional(
                start: 24.0 * i,
                child: DecoratedBox(
                  decoration: const BoxDecoration(
                    shape: BoxShape.circle,
                    color: AppColors.milk50,
                  ),
                  child: Padding(
                    padding: const EdgeInsets.all(2),
                    child: StaffroomAvatar(
                      name: shown[i].authorName,
                      photoUrl: shown[i].authorPhotoURL,
                      size: 30,
                    ),
                  ),
                ),
              ),
            if (extra > 0)
              PositionedDirectional(
                start: 24.0 * shown.length,
                child: Container(
                  width: 34,
                  height: 34,
                  alignment: Alignment.center,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: AppColors.ink900,
                    border: Border.all(color: AppColors.milk50, width: 2),
                  ),
                  child: Text(
                    '+$extra',
                    style: Theme.of(context).textTheme.labelSmall?.copyWith(
                      fontWeight: FontWeight.w700,
                      color: AppColors.milk100,
                    ),
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }
}

/// The newest message, quoted in a warm box: the author (an AI teacher is
/// marked), when, and the text (two lines at most: a preview of someone
/// else's words; the chat holds the rest).
class _LatestMessage extends StatelessWidget {
  const _LatestMessage({required this.message, required this.now});

  final ChatMessage message;
  final DateTime now;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final text = Theme.of(context).textTheme;
    final when = inboxRelativeTime(message.createdAt, now, l10n);
    final body = message.text.trim().isEmpty
        ? l10n.cmFeedVoiceNote
        : message.text.trim();
    return Container(
      padding: const EdgeInsets.fromLTRB(14, 12, 14, 12),
      decoration: BoxDecoration(
        color: AppColors.mapStrategyBg,
        borderRadius: BorderRadius.circular(16),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Wrap(
            spacing: 6,
            runSpacing: 4,
            crossAxisAlignment: WrapCrossAlignment.center,
            children: [
              Text(
                message.authorName,
                style: text.labelLarge?.copyWith(
                  fontSize: 12.5,
                  fontWeight: FontWeight.w700,
                  color: AppColors.saffron700,
                ),
              ),
              if (message.isDemoPersona)
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 8,
                    vertical: 1,
                  ),
                  decoration: const ShapeDecoration(
                    color: AppColors.tileSaffronBg,
                    shape: StadiumBorder(),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const Icon(
                        LucideIcons.sparkles,
                        size: 11,
                        color: AppColors.tileSaffronInk,
                      ),
                      const SizedBox(width: 4),
                      Text(
                        l10n.staffroomChatAiBadge,
                        style: text.labelSmall?.copyWith(
                          fontWeight: FontWeight.w600,
                          color: AppColors.tileSaffronInk,
                        ),
                      ),
                    ],
                  ),
                ),
              if (when.isNotEmpty)
                Text(
                  when,
                  style: text.labelMedium?.copyWith(color: AppColors.textMuted),
                ),
            ],
          ),
          const SizedBox(height: 4),
          Text(
            body,
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
            style: text.bodyLarge?.copyWith(
              fontSize: 14.5,
              color: AppColors.textStrong,
            ),
          ),
        ],
      ),
    );
  }
}

// ─── Share with teachers ────────────────────────────────────────────────────

/// "What did you do today?" with the four kinds of post one tap away. Each
/// opens Share with teachers on that kind; the field opens it on Tried this.
class ShareWithTeachersCard extends StatelessWidget {
  const ShareWithTeachersCard({super.key});

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final text = Theme.of(context).textTheme;
    return MapCard(
      key: const ValueKey('share-with-teachers'),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Semantics(
            button: true,
            label: l10n.communityComposerPrompt,
            excludeSemantics: true,
            child: InkWell(
              onTap: () => showShareWithTeachers(context),
              borderRadius: AppRadius.rPill,
              child: Container(
                constraints: const BoxConstraints(minHeight: 46),
                padding: const EdgeInsets.symmetric(horizontal: 16),
                decoration: BoxDecoration(
                  color: AppColors.surfaceAskBar,
                  borderRadius: AppRadius.rPill,
                  border: Border.all(color: AppColors.borderAskBar),
                ),
                child: Row(
                  children: [
                    const Icon(
                      LucideIcons.pencil,
                      size: 16,
                      color: AppColors.textEyebrow,
                    ),
                    const SizedBox(width: AppSpacing.space2),
                    Expanded(
                      child: Text(
                        l10n.communityComposerPrompt,
                        style: text.bodyLarge?.copyWith(
                          fontSize: 14.5,
                          color: AppColors.textMuted,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
          const SizedBox(height: AppSpacing.space3),
          IntrinsicHeight(
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                for (final (i, kind) in kPostKinds.indexed) ...[
                  if (i > 0) const SizedBox(width: 6),
                  Expanded(child: _KindStart(kind: kind)),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _KindStart extends StatelessWidget {
  const _KindStart({required this.kind});

  final PostType kind;

  @override
  Widget build(BuildContext context) {
    final label = postTypeLabel(context.l10n, kind);
    final tint = postTypeTint(kind);
    return Semantics(
      button: true,
      label: label,
      excludeSemantics: true,
      child: InkWell(
        key: ValueKey('share-kind-${kind.wire}'),
        onTap: () => showShareWithTeachers(context, type: kind),
        borderRadius: BorderRadius.circular(14),
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 6, horizontal: 2),
          child: Column(
            children: [
              Container(
                width: 34,
                height: 34,
                decoration: BoxDecoration(
                  color: tint.fill,
                  borderRadius: BorderRadius.circular(11),
                ),
                child: Icon(postTypeIcon(kind), size: 17, color: tint.ink),
              ),
              const SizedBox(height: 6),
              Text(
                label,
                textAlign: TextAlign.center,
                style: Theme.of(context).textTheme.labelMedium?.copyWith(
                  fontWeight: FontWeight.w600,
                  color: AppColors.textBody,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

// ─── Your groups ────────────────────────────────────────────────────────────

/// A group's tint and icon on its card, from what kind of group it is.
(MapTint, IconData) groupLook(GroupType type) => switch (type) {
  GroupType.subjectGrade => (MapTint.indigo, LucideIcons.bookOpen),
  GroupType.school => (MapTint.saffron, LucideIcons.school),
  GroupType.region => (MapTint.leaf, LucideIcons.mapPin),
  GroupType.interest => (MapTint.amber, LucideIcons.users),
};

/// The teacher's groups as a row of cards (a tinted band with the group's
/// icon, the name, members and when it was last active), then "Find more
/// groups".
class YourGroupsRail extends ConsumerWidget {
  const YourGroupsRail({super.key, required this.groups});

  final List<Group> groups;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = context.l10n;
    final now = ref.watch(nowProvider)();
    return SingleChildScrollView(
      key: const ValueKey('your-groups-rail'),
      scrollDirection: Axis.horizontal,
      clipBehavior: Clip.none,
      child: IntrinsicHeight(
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            for (final group in groups) ...[
              SizedBox(
                width: 156,
                child: _GroupCard(group: group, now: now),
              ),
              const SizedBox(width: 10),
            ],
            SizedBox(
              width: 120,
              child: Semantics(
                button: true,
                label: l10n.cmFeedFindGroups,
                excludeSemantics: true,
                child: InkWell(
                  onTap: () => openCommunityNetwork(context),
                  borderRadius: BorderRadius.circular(18),
                  child: Container(
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: AppColors.surfaceCard.withValues(alpha: 0.5),
                      borderRadius: BorderRadius.circular(18),
                      border: Border.all(
                        color: AppColors.accentFill.withValues(alpha: 0.4),
                        width: 1.5,
                      ),
                    ),
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Container(
                          width: 36,
                          height: 36,
                          decoration: BoxDecoration(
                            color: AppColors.tileSaffronBg,
                            borderRadius: BorderRadius.circular(12),
                          ),
                          child: const Icon(
                            LucideIcons.plus,
                            size: 18,
                            color: AppColors.textEyebrow,
                          ),
                        ),
                        const SizedBox(height: 8),
                        Text(
                          l10n.cmFeedFindGroups,
                          textAlign: TextAlign.center,
                          style: Theme.of(context).textTheme.labelLarge
                              ?.copyWith(
                                fontSize: 13,
                                fontWeight: FontWeight.w700,
                                color: AppColors.textEyebrow,
                              ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _GroupCard extends StatelessWidget {
  const _GroupCard({required this.group, required this.now});

  final Group group;
  final DateTime now;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final text = Theme.of(context).textTheme;
    final (tint, icon) = groupLook(group.type);
    final active = inboxRelativeTime(group.lastActivityAt, now, l10n);
    final meta = [
      l10n.staffroomMemberCount(group.memberCount),
      if (active.isNotEmpty) active,
    ].join(' · ');
    return Semantics(
      button: true,
      label: '${group.name}, $meta',
      excludeSemantics: true,
      child: Material(
        color: AppColors.surfaceCard,
        borderRadius: BorderRadius.circular(18),
        clipBehavior: Clip.antiAlias,
        child: InkWell(
          key: ValueKey('group-card-${group.id}'),
          onTap: () =>
              context.push(Routes.groupDetailPath(group.id), extra: group),
          child: DecoratedBox(
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(18),
              border: Border.all(color: AppColors.borderHairline),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Container(
                  height: 48,
                  color: tint.fill,
                  padding: const EdgeInsets.symmetric(horizontal: 12),
                  alignment: AlignmentDirectional.centerStart,
                  child: Icon(icon, size: 20, color: tint.ink),
                ),
                Padding(
                  padding: const EdgeInsets.fromLTRB(12, 10, 12, 12),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        group.name,
                        style: text.titleLarge?.copyWith(
                          fontSize: 14,
                          height: 1.25,
                          color: AppColors.textStrong,
                        ),
                      ),
                      const SizedBox(height: 3),
                      Text(
                        meta,
                        style: text.bodySmall?.copyWith(
                          fontSize: 12,
                          color: AppColors.textMuted,
                        ),
                      ),
                    ],
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

// ─── Teachers you may know ──────────────────────────────────────────────────

/// Suggested teachers as a row of cards: avatar, name, what and where they
/// teach, why they are suggested, and Connect.
class PeopleRail extends StatelessWidget {
  const PeopleRail({super.key, required this.people});

  final List<TeacherSuggestion> people;

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      key: const ValueKey('people-rail'),
      scrollDirection: Axis.horizontal,
      clipBehavior: Clip.none,
      child: IntrinsicHeight(
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            for (final (i, teacher) in people.indexed) ...[
              if (i > 0) const SizedBox(width: 10),
              SizedBox(width: 172, child: _PersonCard(teacher: teacher)),
            ],
          ],
        ),
      ),
    );
  }
}

class _PersonCard extends StatelessWidget {
  const _PersonCard({required this.teacher});

  final TeacherSuggestion teacher;

  @override
  Widget build(BuildContext context) {
    final text = Theme.of(context).textTheme;
    final teaches = [
      if (teacher.subjects.isNotEmpty) teacher.subjects.take(2).join(', '),
      if (teacher.gradeLevels.isNotEmpty) teacher.gradeLevels.first,
    ].join(' · ');
    final school = teacher.schoolName?.trim() ?? '';
    final reason = teacher.recommendationReason?.trim() ?? '';
    return MapCard(
      key: ValueKey('person-card-${teacher.uid}'),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          StaffroomAvatar(
            name: teacher.displayName,
            photoUrl: teacher.photoURL,
            size: 44,
          ),
          const SizedBox(height: 8),
          Text(
            teacher.displayName,
            style: text.titleLarge?.copyWith(
              fontSize: 14.5,
              height: 1.25,
              color: AppColors.textStrong,
            ),
          ),
          if (teaches.isNotEmpty || school.isNotEmpty) ...[
            const SizedBox(height: 3),
            Text(
              [teaches, school].where((s) => s.isNotEmpty).join('\n'),
              style: text.bodySmall?.copyWith(
                fontSize: 12.5,
                color: AppColors.textMuted,
              ),
            ),
          ],
          if (reason.isNotEmpty) ...[
            const SizedBox(height: 6),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
              decoration: const ShapeDecoration(
                color: AppColors.tileLeafBg,
                shape: StadiumBorder(),
              ),
              child: Text(
                reason,
                style: text.labelSmall?.copyWith(
                  fontWeight: FontWeight.w600,
                  color: AppColors.tileLeafInk,
                ),
              ),
            ),
          ],
          const Spacer(),
          const SizedBox(height: 8),
          TeacherConnectionAction(
            uid: teacher.uid,
            displayName: teacher.displayName,
            photoURL: teacher.photoURL,
            filled: true,
          ),
        ],
      ),
    );
  }
}
