import 'package:flutter/widgets.dart';
import 'package:lucide_icons/lucide_icons.dart';

import '../../../../core/i18n/gen/app_localizations.dart';
import '../../../../shared/widgets/map_icon_tile.dart';
import '../../domain/group.dart';

/// A post type's name as the map writes it (Resource, Tried this, Celebrate,
/// Need help); null is "All".
String postTypeLabel(AppLocalizations l10n, PostType? type) => switch (type) {
  null => l10n.communityFilterAll,
  PostType.resource => l10n.staffroomPostTypeResource,
  PostType.share => l10n.communityTypeTried,
  PostType.celebrate => l10n.communityTypeCelebrate,
  PostType.askHelp => l10n.communityTypeNeedHelp,
};

/// The line a post's kind strip reads: "Tried this in class", "Asking for
/// help", "Celebrating", "Shared a resource".
String postKindLine(AppLocalizations l10n, PostType type) => switch (type) {
  PostType.resource => l10n.cmPostKindResource,
  PostType.share => l10n.cmPostKindTried,
  PostType.celebrate => l10n.cmPostKindCelebrate,
  PostType.askHelp => l10n.cmPostKindHelp,
};

/// One short line under each kind in Share with teachers.
String postKindHint(AppLocalizations l10n, PostType type) => switch (type) {
  PostType.resource => l10n.cmPostKindResourceHint,
  PostType.share => l10n.cmPostKindTriedHint,
  PostType.celebrate => l10n.cmPostKindCelebrateHint,
  PostType.askHelp => l10n.cmPostKindHelpHint,
};

/// A post type's tint, as the map's `t-*` chips and pills colour them.
MapTint postTypeTint(PostType type) => switch (type) {
  PostType.resource => MapTint.saffron,
  PostType.share => MapTint.amber,
  PostType.celebrate => MapTint.leaf,
  PostType.askHelp => MapTint.indigo,
};

/// A post type's icon: never the only signal, always beside its words.
IconData postTypeIcon(PostType type) => switch (type) {
  PostType.resource => LucideIcons.bookOpen,
  PostType.share => LucideIcons.flaskConical,
  PostType.celebrate => LucideIcons.award,
  PostType.askHelp => LucideIcons.helpCircle,
};

/// The four kinds in the order Share with teachers and the quick-starts show
/// them.
const List<PostType> kPostKinds = [
  PostType.share,
  PostType.askHelp,
  PostType.celebrate,
  PostType.resource,
];
