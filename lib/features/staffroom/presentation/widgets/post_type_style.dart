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

/// A post type's tint, as the map's `t-*` chips and pills colour them.
MapTint postTypeTint(PostType type) => switch (type) {
  PostType.resource => MapTint.saffron,
  PostType.share => MapTint.amber,
  PostType.celebrate => MapTint.leaf,
  PostType.askHelp => MapTint.indigo,
};
