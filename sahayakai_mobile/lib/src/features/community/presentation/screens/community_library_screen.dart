import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/theme/glassmorphic/glass_components.dart';
import '../../data/community_repository.dart';
import '../../domain/community_models.dart';

// ---------------------------------------------------------------------------
// Content type filter definition
// ---------------------------------------------------------------------------

/// Filter options used in the horizontal chip row.
/// The [value] is the raw string sent to the API (null = "All").
class _ContentFilter {
  final String label;
  final String? value;
  const _ContentFilter(this.label, this.value);
}

const List<_ContentFilter> _kFilters = [
  _ContentFilter('All', null),
  _ContentFilter('Lesson Plan', 'lessonPlan'),
  _ContentFilter('Quiz', 'quiz'),
  _ContentFilter('Worksheet', 'worksheet'),
  _ContentFilter('Visual Aid', 'visualAid'),
  _ContentFilter('Rubric', 'rubric'),
];

/// Maps a resource [type] string to a Material icon.
IconData _iconForType(String? type) {
  switch (type) {
    case 'lessonPlan':
      return Icons.menu_book_rounded;
    case 'quiz':
      return Icons.quiz_rounded;
    case 'worksheet':
      return Icons.assignment_rounded;
    case 'visualAid':
      return Icons.image_rounded;
    case 'rubric':
      return Icons.grading_rounded;
    default:
      return Icons.description_rounded;
  }
}

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

class CommunityLibraryScreen extends ConsumerStatefulWidget {
  const CommunityLibraryScreen({super.key});

  @override
  ConsumerState<CommunityLibraryScreen> createState() =>
      _CommunityLibraryScreenState();
}

class _CommunityLibraryScreenState
    extends ConsumerState<CommunityLibraryScreen>
    with SingleTickerProviderStateMixin {
  // Search
  final _searchController = TextEditingController();
  Timer? _debounce;
  String _searchQuery = '';

  // Filter
  String? _selectedContentType; // null = All

  // Tabs
  late final TabController _tabController;

  // Data
  List<CommunityResource> _resources = [];
  bool _isLoading = true;
  String? _errorMessage;

  // ---------- Lifecycle ----------

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 2, vsync: this);
    _tabController.addListener(_onTabChanged);
    _fetchResources();
  }

  @override
  void dispose() {
    _debounce?.cancel();
    _searchController.dispose();
    _tabController.removeListener(_onTabChanged);
    _tabController.dispose();
    super.dispose();
  }

  // ---------- Data fetching ----------

  String get _currentTab =>
      _tabController.index == 0 ? 'trending' : 'following';

  void _onTabChanged() {
    if (!_tabController.indexIsChanging) {
      _fetchResources();
    }
  }

  void _onSearchChanged(String value) {
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 500), () {
      if (mounted && value != _searchQuery) {
        setState(() => _searchQuery = value);
        _fetchResources();
      }
    });
  }

  Future<void> _fetchResources() async {
    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });
    try {
      final repo = ref.read(communityRepositoryProvider);
      final results = await repo.getLibraryResources(
        query: _searchQuery.isNotEmpty ? _searchQuery : null,
        type: _selectedContentType,
      );
      if (mounted) {
        setState(() {
          _resources = results;
          _isLoading = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _errorMessage = e.toString();
          _isLoading = false;
        });
      }
    }
  }

  // ---------- Actions ----------

  Future<void> _toggleLike(int index) async {
    final resource = _resources[index];
    final repo = ref.read(communityRepositoryProvider);

    // Optimistic update — create a new instance with toggled state.
    final wasLiked = resource.isLiked;
    final updatedResource = CommunityResource(
      id: resource.id,
      type: resource.type,
      title: resource.title,
      description: resource.description,
      authorId: resource.authorId,
      authorName: resource.authorName,
      language: resource.language,
      gradeLevel: resource.gradeLevel,
      subject: resource.subject,
      likesCount: resource.likesCount + (wasLiked ? -1 : 1),
      downloadsCount: resource.downloadsCount,
      isLiked: !wasLiked,
      isSaved: resource.isSaved,
      createdAt: resource.createdAt,
    );

    setState(() => _resources[index] = updatedResource);
    await repo.toggleLikeResource(resource.id);
  }

  Future<void> _toggleSave(int index) async {
    final resource = _resources[index];
    final repo = ref.read(communityRepositoryProvider);

    final updatedResource = CommunityResource(
      id: resource.id,
      type: resource.type,
      title: resource.title,
      description: resource.description,
      authorId: resource.authorId,
      authorName: resource.authorName,
      language: resource.language,
      gradeLevel: resource.gradeLevel,
      subject: resource.subject,
      likesCount: resource.likesCount,
      downloadsCount: resource.downloadsCount,
      isLiked: resource.isLiked,
      isSaved: !resource.isSaved,
      createdAt: resource.createdAt,
    );

    setState(() => _resources[index] = updatedResource);
    await repo.saveResource(resource.id);
  }

  // ---------- Build ----------

  @override
  Widget build(BuildContext context) {
    return GlassScaffold(
      title: 'Community Library',
      body: Column(
        children: [
          // Search bar
          Padding(
            padding: const EdgeInsets.symmetric(
              horizontal: GlassSpacing.xl,
              vertical: GlassSpacing.sm,
            ),
            child: GlassTextField(
              controller: _searchController,
              hintText: 'Search resources...',
              prefixIcon: const Icon(
                Icons.search_rounded,
                color: GlassColors.textTertiary,
              ),
              onChanged: _onSearchChanged,
            ),
          ),

          // Filter chips — horizontal scroll
          SizedBox(
            height: 48,
            child: ListView.separated(
              scrollDirection: Axis.horizontal,
              padding:
                  const EdgeInsets.symmetric(horizontal: GlassSpacing.xl),
              itemCount: _kFilters.length,
              separatorBuilder: (_, __) =>
                  const SizedBox(width: GlassSpacing.sm),
              itemBuilder: (context, index) {
                final filter = _kFilters[index];
                final isSelected =
                    filter.value == _selectedContentType;
                return GlassChip(
                  label: filter.label,
                  isSelected: isSelected,
                  onTap: () {
                    if (_selectedContentType != filter.value) {
                      setState(
                          () => _selectedContentType = filter.value);
                      _fetchResources();
                    }
                  },
                );
              },
            ),
          ),

          const SizedBox(height: GlassSpacing.sm),

          // Tab bar (Trending | Following)
          Container(
            margin:
                const EdgeInsets.symmetric(horizontal: GlassSpacing.xl),
            decoration: BoxDecoration(
              color: GlassColors.inputBackground,
              borderRadius: GlassRadius.inputRadius,
            ),
            child: TabBar(
              controller: _tabController,
              indicator: BoxDecoration(
                color: GlassColors.primary,
                borderRadius: GlassRadius.inputRadius,
              ),
              indicatorSize: TabBarIndicatorSize.tab,
              labelColor: Colors.white,
              unselectedLabelColor: GlassColors.textSecondary,
              labelStyle: GlassTypography.labelLarge(),
              unselectedLabelStyle: GlassTypography.labelLarge(),
              dividerHeight: 0,
              tabs: const [
                Tab(text: 'Trending'),
                Tab(text: 'Following'),
              ],
            ),
          ),

          const SizedBox(height: GlassSpacing.md),

          // Content area
          Expanded(child: _buildContent()),
        ],
      ),
    );
  }

  // ---------- Content states ----------

  Widget _buildContent() {
    if (_isLoading) {
      return _buildShimmerList();
    }

    if (_errorMessage != null) {
      return _buildErrorState();
    }

    if (_resources.isEmpty) {
      return const GlassEmptyState(
        icon: Icons.search_off_rounded,
        title: 'No resources found',
        message: 'No resources found. Try a different search.',
      );
    }

    return RefreshIndicator(
      color: GlassColors.primary,
      onRefresh: _fetchResources,
      child: ListView.builder(
        padding:
            const EdgeInsets.symmetric(horizontal: GlassSpacing.xl),
        itemCount: _resources.length,
        itemBuilder: (context, index) =>
            _buildResourceCard(_resources[index], index),
      ),
    );
  }

  // ---------- Resource card ----------

  Widget _buildResourceCard(CommunityResource resource, int index) {
    return Padding(
      padding: const EdgeInsets.only(bottom: GlassSpacing.lg),
      child: GlassCard(
        padding: EdgeInsets.zero,
        child: Padding(
          padding: const EdgeInsets.all(GlassSpacing.lg),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Top row: icon + title + author
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Content type icon
                  Container(
                    width: 44,
                    height: 44,
                    decoration: BoxDecoration(
                      color: GlassColors.primary.withOpacity(0.1),
                      borderRadius:
                          BorderRadius.circular(GlassRadius.md),
                    ),
                    child: Icon(
                      _iconForType(resource.type),
                      color: GlassColors.primary,
                      size: 22,
                    ),
                  ),
                  const SizedBox(width: GlassSpacing.md),
                  // Title + Author
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          resource.title,
                          style: GlassTypography.labelLarge(),
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                        ),
                        const SizedBox(height: 2),
                        Text(
                          resource.authorName,
                          style: GlassTypography.bodySmall(),
                        ),
                      ],
                    ),
                  ),
                ],
              ),

              const SizedBox(height: GlassSpacing.md),

              // Grade / Subject badges
              if (resource.gradeLevel != null ||
                  resource.subject != null)
                Padding(
                  padding:
                      const EdgeInsets.only(bottom: GlassSpacing.md),
                  child: Wrap(
                    spacing: GlassSpacing.sm,
                    runSpacing: GlassSpacing.xs,
                    children: [
                      if (resource.gradeLevel != null)
                        _buildBadge(resource.gradeLevel!),
                      if (resource.subject != null)
                        _buildBadge(resource.subject!),
                    ],
                  ),
                ),

              // Stats row + action buttons
              Row(
                children: [
                  // Likes
                  _buildStat(
                    Icons.favorite_rounded,
                    resource.likesCount,
                    const Color(0xFFEC4899),
                  ),
                  const SizedBox(width: GlassSpacing.lg),
                  // Downloads
                  _buildStat(
                    Icons.download_rounded,
                    resource.downloadsCount,
                    const Color(0xFF3B82F6),
                  ),
                  const Spacer(),
                  // Like button
                  GestureDetector(
                    onTap: () => _toggleLike(index),
                    child: Icon(
                      resource.isLiked
                          ? Icons.favorite_rounded
                          : Icons.favorite_border_rounded,
                      color: resource.isLiked
                          ? const Color(0xFFEC4899)
                          : GlassColors.textTertiary,
                      size: 22,
                    ),
                  ),
                  const SizedBox(width: GlassSpacing.lg),
                  // Save / bookmark button
                  GestureDetector(
                    onTap: () => _toggleSave(index),
                    child: Icon(
                      resource.isSaved
                          ? Icons.bookmark_rounded
                          : Icons.bookmark_border_rounded,
                      color: resource.isSaved
                          ? GlassColors.primary
                          : GlassColors.textTertiary,
                      size: 22,
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildBadge(String label) {
    return Container(
      padding: const EdgeInsets.symmetric(
        horizontal: GlassSpacing.md,
        vertical: GlassSpacing.xs,
      ),
      decoration: BoxDecoration(
        color: GlassColors.inputBackground,
        borderRadius: BorderRadius.circular(GlassRadius.pill),
      ),
      child: Text(label, style: GlassTypography.labelSmall()),
    );
  }

  Widget _buildStat(IconData icon, int count, Color color) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(icon, size: 16, color: color),
        const SizedBox(width: 4),
        Text(
          _formatCount(count),
          style: GlassTypography.labelSmall(
            color: GlassColors.textSecondary,
          ),
        ),
      ],
    );
  }

  String _formatCount(int count) {
    if (count >= 1000) {
      return '${(count / 1000).toStringAsFixed(1)}k';
    }
    return count.toString();
  }

  // ---------- Shimmer / skeleton loading ----------

  Widget _buildShimmerList() {
    return ListView.builder(
      padding:
          const EdgeInsets.symmetric(horizontal: GlassSpacing.xl),
      itemCount: 4,
      itemBuilder: (_, __) => _buildShimmerCard(),
    );
  }

  Widget _buildShimmerCard() {
    return Padding(
      padding: const EdgeInsets.only(bottom: GlassSpacing.lg),
      child: GlassCard(
        padding: const EdgeInsets.all(GlassSpacing.lg),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                _shimmerBox(44, 44,
                    borderRadius: GlassRadius.md),
                const SizedBox(width: GlassSpacing.md),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      _shimmerBox(double.infinity, 14),
                      const SizedBox(height: GlassSpacing.sm),
                      _shimmerBox(100, 10),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: GlassSpacing.md),
            Row(
              children: [
                _shimmerBox(60, 24,
                    borderRadius: GlassRadius.pill),
                const SizedBox(width: GlassSpacing.sm),
                _shimmerBox(60, 24,
                    borderRadius: GlassRadius.pill),
              ],
            ),
            const SizedBox(height: GlassSpacing.md),
            Row(
              children: [
                _shimmerBox(50, 14),
                const SizedBox(width: GlassSpacing.lg),
                _shimmerBox(50, 14),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _shimmerBox(
    double width,
    double height, {
    double borderRadius = 6,
  }) {
    return Container(
      width: width,
      height: height,
      decoration: BoxDecoration(
        color: GlassColors.textTertiary.withOpacity(0.15),
        borderRadius: BorderRadius.circular(borderRadius),
      ),
    );
  }

  // ---------- Error state ----------

  Widget _buildErrorState() {
    return GlassEmptyState(
      icon: Icons.error_outline_rounded,
      title: 'Something went wrong',
      message: _errorMessage ?? 'An unexpected error occurred.',
      action: GlassPrimaryButton(
        label: 'Retry',
        icon: Icons.refresh_rounded,
        isExpanded: false,
        onPressed: _fetchResources,
      ),
    );
  }
}
