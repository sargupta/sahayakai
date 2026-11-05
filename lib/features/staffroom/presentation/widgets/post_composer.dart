import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons/lucide_icons.dart';

import '../../../../core/i18n/l10n_ext.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../shared/widgets/map_card.dart';
import '../../../../shared/widgets/map_chip.dart';
import '../../../../shared/widgets/map_select.dart';
import '../../../../shared/widgets/primary_button.dart';
import '../../data/staffroom_providers.dart';
import '../../data/staffroom_transport.dart';
import '../../domain/group.dart';
import '../community_errors.dart';
import 'post_type_style.dart';

/// The `POST /api/groups/{id}/posts` content cap (`content.length > 2000` is
/// rejected server-side; characters, like the web).
const int kGroupPostMaxChars = 2000;

/// The map's "What did you do today?" composer.
///
/// Collapsed it is the map's quiet input pill; tapped, it opens in place to a
/// text field, the four post types the backend accepts (`share`, `ask_help`,
/// `celebrate`, `resource`), and — when the post has no fixed group — a
/// [MapSelect] of the teacher's own groups, since every post belongs to a
/// group. The caller hides the composer entirely when the teacher has no group
/// to post to.
///
/// Posting calls `createGroupPost`; on success the composer collapses and the
/// feed, the group's posts and the groups list are refreshed so the new post
/// appears without a manual pull. A failure (429 rate limit, 403 non-member,
/// offline) keeps the draft and shows a translated reason.
class PostComposer extends ConsumerStatefulWidget {
  const PostComposer({super.key, required this.groups, this.fixedGroupId})
      : assert(groups.length > 0 || fixedGroupId != null);

  /// The groups the teacher may post to (their own groups). Ignored when
  /// [fixedGroupId] is set.
  final List<Group> groups;

  /// Post to this group only (group detail) — no picker is shown.
  final String? fixedGroupId;

  @override
  ConsumerState<PostComposer> createState() => _PostComposerState();
}

class _PostComposerState extends ConsumerState<PostComposer> {
  final TextEditingController _text = TextEditingController();
  bool _open = false;
  bool _busy = false;
  String? _error;
  PostType _type = PostType.share;
  String? _groupId;

  @override
  void initState() {
    super.initState();
    _text.addListener(_onChanged);
  }

  @override
  void dispose() {
    _text
      ..removeListener(_onChanged)
      ..dispose();
    super.dispose();
  }

  void _onChanged() => setState(() {});

  /// The group the post goes to: the fixed one, the teacher's pick, or the
  /// first of their groups (the list is lastActivityAt-desc, so the most
  /// active one) — always one the teacher belongs to.
  String? get _targetGroupId {
    if (widget.fixedGroupId != null) return widget.fixedGroupId;
    final picked = _groupId;
    if (picked != null && widget.groups.any((g) => g.id == picked)) {
      return picked;
    }
    return widget.groups.isEmpty ? null : widget.groups.first.id;
  }

  Future<void> _post() async {
    final groupId = _targetGroupId;
    final content = _text.text.trim();
    if (_busy || groupId == null || content.isEmpty) return;
    final l10n = context.l10n;
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await ref.read(staffroomTransportProvider).createGroupPost(
            groupId: groupId,
            content: content,
            postType: _type,
          );
      if (!mounted) return;
      ref
        ..invalidate(unifiedFeedProvider)
        ..invalidate(groupPostsProvider(groupId))
        ..invalidate(myGroupsProvider);
      _text.clear();
      setState(() {
        _busy = false;
        _open = false;
        _type = PostType.share;
      });
      ScaffoldMessenger.maybeOf(context)
        ?..hideCurrentSnackBar()
        ..showSnackBar(SnackBar(content: Text(l10n.communityComposerPosted)));
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _busy = false;
        _error = communityErrorText(
          l10n,
          error,
          fallback: l10n.communityComposerFailed,
        );
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final text = Theme.of(context).textTheme;

    if (!_open) {
      return Semantics(
        button: true,
        label: l10n.communityComposerPrompt,
        excludeSemantics: true,
        onTap: () => setState(() => _open = true),
        child: Material(
          color: AppColors.surfaceAskBar,
          shape: const StadiumBorder(
            side: BorderSide(color: AppColors.borderAskBar),
          ),
          clipBehavior: Clip.antiAlias,
          child: InkWell(
            onTap: () => setState(() => _open = true),
            child: ConstrainedBox(
              constraints: const BoxConstraints(minHeight: 48),
              child: Padding(
                padding: const EdgeInsets.symmetric(
                  horizontal: AppSpacing.space4,
                  vertical: 11,
                ),
                child: Row(
                  children: [
                    const Icon(
                      LucideIcons.pencil,
                      size: 17,
                      color: AppColors.textMuted,
                    ),
                    const SizedBox(width: AppSpacing.space2),
                    Expanded(
                      child: Text(
                        l10n.communityComposerPrompt,
                        style: text.bodyMedium?.copyWith(
                          color: AppColors.textMuted,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      );
    }

    final groupId = _targetGroupId;
    final canPost =
        !_busy && groupId != null && _text.text.trim().isNotEmpty;

    return MapCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        mainAxisSize: MainAxisSize.min,
        children: [
          Row(
            children: [
              Expanded(child: MapOverline(l10n.communityComposerPrompt)),
              IconButton(
                tooltip: l10n.communityComposerClose,
                onPressed: _busy ? null : () => setState(() => _open = false),
                icon: const Icon(
                  LucideIcons.x,
                  size: 18,
                  color: AppColors.textMuted,
                ),
              ),
            ],
          ),
          TextField(
            controller: _text,
            autofocus: true,
            minLines: 3,
            maxLines: 8,
            enabled: !_busy,
            keyboardType: TextInputType.multiline,
            textInputAction: TextInputAction.newline,
            inputFormatters: [
              LengthLimitingTextInputFormatter(kGroupPostMaxChars),
            ],
            decoration: InputDecoration(
              hintText: l10n.communityComposerHint,
              filled: true,
              fillColor: Colors.white,
              border: const OutlineInputBorder(
                borderRadius: AppRadius.rField,
                borderSide: BorderSide(color: AppColors.borderHairline),
              ),
              enabledBorder: const OutlineInputBorder(
                borderRadius: AppRadius.rField,
                borderSide: BorderSide(color: AppColors.borderHairline),
              ),
            ),
          ),
          const SizedBox(height: AppSpacing.space3),
          Text(
            l10n.communityComposerTypeLabel,
            style: text.labelMedium?.copyWith(
              fontWeight: FontWeight.w700,
              color: AppColors.textMuted,
            ),
          ),
          Wrap(
            spacing: 7,
            children: [
              // The map's order: Resource, Tried this, Celebrate, Need help.
              for (final type in const <PostType>[
                PostType.resource,
                PostType.share,
                PostType.celebrate,
                PostType.askHelp,
              ])
                MapChip(
                  label: postTypeLabel(l10n, type),
                  selected: _type == type,
                  selectedFill: AppColors.accentFill,
                  idleFill: postTypeTint(type).fill,
                  idleInk: postTypeTint(type).ink,
                  onTap: () => setState(() => _type = type),
                ),
            ],
          ),
          if (widget.fixedGroupId == null && widget.groups.isNotEmpty) ...[
            const SizedBox(height: AppSpacing.space2),
            MapSelect<String>(
              label: l10n.communityComposerPostTo,
              value: groupId ?? widget.groups.first.id,
              options: <(String, String)>[
                for (final g in widget.groups) (g.id, g.name),
              ],
              onChanged: (id) => setState(() => _groupId = id),
            ),
          ],
          if (_error != null) ...[
            const SizedBox(height: AppSpacing.space2),
            Text(
              _error!,
              style: text.bodyMedium?.copyWith(color: AppColors.danger),
            ),
          ],
          const SizedBox(height: AppSpacing.space3),
          PrimaryButton(
            label: l10n.communityComposerPost,
            icon: LucideIcons.send,
            isBusy: _busy,
            onPressed: canPost ? _post : null,
          ),
        ],
      ),
    );
  }
}
