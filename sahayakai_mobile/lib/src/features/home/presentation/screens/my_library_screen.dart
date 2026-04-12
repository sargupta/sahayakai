import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/services/metrics_service.dart';
import '../../../../core/theme/glassmorphic/glass_components.dart';
import '../../../../core/theme/glassmorphic/glass_skeleton.dart';
import '../../../content/data/content_repository.dart';
import '../../../content/domain/content_models.dart';
import '../../../content/presentation/providers/content_provider.dart';

class MyLibraryScreen extends ConsumerStatefulWidget {
  const MyLibraryScreen({super.key});

  @override
  ConsumerState<MyLibraryScreen> createState() => _MyLibraryScreenState();
}

class _MyLibraryScreenState extends ConsumerState<MyLibraryScreen> {
  String? _selectedType; // null = all types
  String _searchQuery = '';
  String _sortBy = 'newest'; // newest, oldest, az
  final _searchController = TextEditingController();

  @override
  void initState() {
    super.initState();
    MetricsService.trackScreenView('my_library');
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  List<ContentItem> _filterAndSort(List<ContentItem> items) {
    var filtered = items;

    // Apply search filter
    if (_searchQuery.isNotEmpty) {
      final query = _searchQuery.toLowerCase();
      filtered = filtered
          .where((item) =>
              item.title.toLowerCase().contains(query) ||
              (item.subject?.toLowerCase().contains(query) ?? false) ||
              (item.topic?.toLowerCase().contains(query) ?? false))
          .toList();
    }

    // Apply sort
    switch (_sortBy) {
      case 'oldest':
        filtered.sort((a, b) =>
            (a.createdAt ?? '').compareTo(b.createdAt ?? ''));
      case 'az':
        filtered.sort(
            (a, b) => a.title.toLowerCase().compareTo(b.title.toLowerCase()));
      case 'newest':
      default:
        filtered.sort((a, b) =>
            (b.createdAt ?? '').compareTo(a.createdAt ?? ''));
    }

    return filtered;
  }

  @override
  Widget build(BuildContext context) {
    final filter = ContentFilter(type: _selectedType, limit: 50);
    final contentAsync = ref.watch(contentListProvider(filter));

    return Container(
      decoration: const BoxDecoration(
        gradient: GlassColors.warmBackgroundGradient,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Header
          Padding(
            padding: const EdgeInsets.all(GlassSpacing.xl),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('Your Collection',
                    style: GlassTypography.decorativeLabel()),
                const SizedBox(height: GlassSpacing.xs),
                Text('My Library', style: GlassTypography.headline1()),
                const SizedBox(height: GlassSpacing.sm),
                Container(
                  width: 60,
                  height: 2,
                  color: GlassColors.textTertiary.withOpacity(0.3),
                ),
              ],
            ),
          ),

          // Search bar + sort
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: GlassSpacing.xl),
            child: Row(
              children: [
                Expanded(
                  child: TextField(
                    controller: _searchController,
                    onChanged: (value) =>
                        setState(() => _searchQuery = value),
                    decoration: InputDecoration(
                      hintText: 'Search library...',
                      hintStyle:
                          TextStyle(color: GlassColors.textTertiary, fontSize: 14),
                      prefixIcon: const Icon(Icons.search_rounded,
                          color: GlassColors.textTertiary, size: 20),
                      suffixIcon: _searchQuery.isNotEmpty
                          ? IconButton(
                              icon: const Icon(Icons.clear, size: 18),
                              onPressed: () {
                                _searchController.clear();
                                setState(() => _searchQuery = '');
                              },
                            )
                          : null,
                      filled: true,
                      fillColor: GlassColors.inputBackground,
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(12),
                        borderSide: BorderSide.none,
                      ),
                      contentPadding: const EdgeInsets.symmetric(
                          horizontal: 16, vertical: 10),
                    ),
                  ),
                ),
                const SizedBox(width: GlassSpacing.sm),
                PopupMenuButton<String>(
                  icon: Icon(
                    Icons.sort_rounded,
                    color: GlassColors.textSecondary,
                  ),
                  tooltip: 'Sort',
                  onSelected: (value) => setState(() => _sortBy = value),
                  itemBuilder: (_) => [
                    PopupMenuItem(
                      value: 'newest',
                      child: Row(
                        children: [
                          Icon(Icons.arrow_downward, size: 16,
                              color: _sortBy == 'newest'
                                  ? GlassColors.primary
                                  : GlassColors.textSecondary),
                          const SizedBox(width: 8),
                          Text('Newest First',
                              style: TextStyle(
                                  color: _sortBy == 'newest'
                                      ? GlassColors.primary
                                      : null)),
                        ],
                      ),
                    ),
                    PopupMenuItem(
                      value: 'oldest',
                      child: Row(
                        children: [
                          Icon(Icons.arrow_upward, size: 16,
                              color: _sortBy == 'oldest'
                                  ? GlassColors.primary
                                  : GlassColors.textSecondary),
                          const SizedBox(width: 8),
                          Text('Oldest First',
                              style: TextStyle(
                                  color: _sortBy == 'oldest'
                                      ? GlassColors.primary
                                      : null)),
                        ],
                      ),
                    ),
                    PopupMenuItem(
                      value: 'az',
                      child: Row(
                        children: [
                          Icon(Icons.sort_by_alpha, size: 16,
                              color: _sortBy == 'az'
                                  ? GlassColors.primary
                                  : GlassColors.textSecondary),
                          const SizedBox(width: 8),
                          Text('A → Z',
                              style: TextStyle(
                                  color: _sortBy == 'az'
                                      ? GlassColors.primary
                                      : null)),
                        ],
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
          const SizedBox(height: GlassSpacing.md),

          // Type filter chips
          SizedBox(
            height: 40,
            child: ListView(
              scrollDirection: Axis.horizontal,
              padding:
                  const EdgeInsets.symmetric(horizontal: GlassSpacing.xl),
              children: [
                _buildFilterChip('All', null),
                const SizedBox(width: GlassSpacing.sm),
                ...contentTypes.map((type) {
                  return Padding(
                    padding:
                        const EdgeInsets.only(right: GlassSpacing.sm),
                    child: _buildFilterChip(
                        contentTypeLabels[type] ?? type, type),
                  );
                }),
              ],
            ),
          ),
          const SizedBox(height: GlassSpacing.lg),

          // Content list
          Expanded(
            child: contentAsync.when(
              data: (response) {
                final items = _filterAndSort(response.items);
                if (items.isEmpty) {
                  return GlassEmptyState(
                    icon: _searchQuery.isNotEmpty
                        ? Icons.search_off_rounded
                        : Icons.library_books_rounded,
                    title: _searchQuery.isNotEmpty
                        ? 'No Results'
                        : 'No Content Yet',
                    message: _searchQuery.isNotEmpty
                        ? 'No items match "$_searchQuery"'
                        : _selectedType != null
                            ? 'No ${contentTypeLabels[_selectedType] ?? _selectedType} items saved.'
                            : 'Generate content and save it here.',
                  );
                }
                return RefreshIndicator(
                  onRefresh: () async {
                    ref.invalidate(contentListProvider(filter));
                  },
                  child: ListView.builder(
                    padding: const EdgeInsets.symmetric(
                      horizontal: GlassSpacing.xl,
                    ),
                    itemCount: items.length,
                    itemBuilder: (context, index) {
                      final item = items[index];
                      return _buildContentCard(context, item);
                    },
                  ),
                );
              },
              loading: () => Padding(
                padding: const EdgeInsets.symmetric(
                  horizontal: GlassSpacing.xl,
                ),
                child: GlassSkeletonList(itemCount: 6),
              ),
              error: (err, _) => GlassEmptyState(
                icon: Icons.error_outline_rounded,
                title: 'Failed to Load',
                message: 'Pull down to retry.',
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildFilterChip(String label, String? type) {
    final isSelected = _selectedType == type;
    return ChoiceChip(
      label: Text(label),
      selected: isSelected,
      selectedColor: GlassColors.primary.withOpacity(0.2),
      onSelected: (_) {
        setState(() => _selectedType = type);
      },
      side: BorderSide(
        color: isSelected ? GlassColors.primary : GlassColors.border,
      ),
      labelStyle: TextStyle(
        color: isSelected ? GlassColors.primary : GlassColors.textSecondary,
        fontWeight: isSelected ? FontWeight.w600 : FontWeight.normal,
        fontSize: 13,
      ),
    );
  }

  Widget _buildContentCard(BuildContext context, ContentItem item) {
    return Padding(
      padding: const EdgeInsets.only(bottom: GlassSpacing.md),
      child: Dismissible(
        key: Key(item.id),
        direction: DismissDirection.endToStart,
        background: Container(
          alignment: Alignment.centerRight,
          padding: const EdgeInsets.only(right: 20),
          decoration: BoxDecoration(
            color: Colors.red.withOpacity(0.1),
            borderRadius: BorderRadius.circular(GlassRadius.md),
          ),
          child: const Icon(Icons.delete_rounded, color: Colors.red),
        ),
        confirmDismiss: (_) async {
          return await showDialog<bool>(
            context: context,
            builder: (ctx) => AlertDialog(
              title: const Text('Delete Content'),
              content: Text('Delete "${item.title}"?'),
              actions: [
                TextButton(
                  onPressed: () => Navigator.pop(ctx, false),
                  child: const Text('Cancel'),
                ),
                FilledButton(
                  onPressed: () => Navigator.pop(ctx, true),
                  style: FilledButton.styleFrom(backgroundColor: Colors.red),
                  child: const Text('Delete'),
                ),
              ],
            ),
          );
        },
        onDismissed: (_) async {
          try {
            await ref.read(contentRepositoryProvider).deleteContent(item.id);
            ref.invalidate(
                contentListProvider(ContentFilter(type: _selectedType)));
          } catch (e) {
            if (mounted) {
              ScaffoldMessenger.of(context).showSnackBar(
                SnackBar(content: Text('Delete failed: $e')),
              );
            }
          }
        },
        child: GlassListItem(
          icon: _iconForType(item.type),
          iconColor: _colorForType(item.type),
          iconBackgroundColor: _colorForType(item.type).withOpacity(0.1),
          title: item.title,
          subtitle:
              '${item.typeLabel}${item.gradeLevel != null ? ' • ${item.gradeLevel}' : ''}',
          onTap: () {
            // TODO: Navigate to content detail screen based on type
          },
        ),
      ),
    );
  }

  IconData _iconForType(String type) {
    switch (type) {
      case 'lesson-plan':
        return Icons.book_rounded;
      case 'quiz':
        return Icons.extension_rounded;
      case 'worksheet':
        return Icons.assignment_rounded;
      case 'visual-aid':
        return Icons.image_rounded;
      case 'rubric':
        return Icons.grading_rounded;
      case 'virtual-field-trip':
        return Icons.travel_explore_rounded;
      case 'teacher-training':
        return Icons.school_rounded;
      case 'exam-paper':
        return Icons.description_rounded;
      default:
        return Icons.article_rounded;
    }
  }

  Color _colorForType(String type) {
    switch (type) {
      case 'lesson-plan':
        return const Color(0xFFDC2626);
      case 'quiz':
        return const Color(0xFF2563EB);
      case 'worksheet':
        return const Color(0xFF16A34A);
      case 'visual-aid':
        return const Color(0xFF9333EA);
      case 'rubric':
        return const Color(0xFFF59E0B);
      case 'exam-paper':
        return const Color(0xFF0D9488);
      default:
        return GlassColors.primary;
    }
  }
}
