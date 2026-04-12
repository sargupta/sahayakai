import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/theme/glassmorphic/glass_components.dart';
import '../../data/notification_repository.dart';
import '../../domain/notification_models.dart';

/// Full-screen notifications list with glassmorphic design.
class NotificationsScreen extends ConsumerStatefulWidget {
  const NotificationsScreen({super.key});

  @override
  ConsumerState<NotificationsScreen> createState() =>
      _NotificationsScreenState();
}

class _NotificationsScreenState extends ConsumerState<NotificationsScreen> {
  List<AppNotification> _notifications = [];
  bool _isLoading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _loadNotifications();
  }

  Future<void> _loadNotifications() async {
    setState(() {
      _isLoading = true;
      _error = null;
    });

    try {
      final repo = ref.read(notificationRepositoryProvider);
      final notifications = await repo.getNotifications();
      if (!mounted) return;
      setState(() {
        _notifications = notifications;
        _isLoading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = 'Failed to load notifications. Please try again.';
        _isLoading = false;
      });
    }
  }

  Future<void> _markAsRead(String id) async {
    final repo = ref.read(notificationRepositoryProvider);
    await repo.markAsRead(id);
    if (!mounted) return;
    setState(() {
      _notifications = _notifications
          .map((n) => n.id == id ? n.copyWith(isRead: true) : n)
          .toList();
    });
    // Invalidate unread count so badges update.
    ref.invalidate(unreadNotificationCountProvider);
  }

  Future<void> _markAllAsRead() async {
    final repo = ref.read(notificationRepositoryProvider);
    await repo.markAllAsRead();
    if (!mounted) return;
    setState(() {
      _notifications =
          _notifications.map((n) => n.copyWith(isRead: true)).toList();
    });
    ref.invalidate(unreadNotificationCountProvider);
  }

  @override
  Widget build(BuildContext context) {
    return GlassScaffold(
      title: 'Notifications',
      actions: [
        IconButton(
          icon: const Icon(Icons.done_all_rounded, size: 22),
          tooltip: 'Mark all read',
          color: GlassColors.textSecondary,
          onPressed: _notifications.any((n) => !n.isRead)
              ? _markAllAsRead
              : null,
        ),
      ],
      body: _buildBody(),
    );
  }

  Widget _buildBody() {
    if (_isLoading) {
      return _buildShimmerLoading();
    }

    if (_error != null) {
      return _buildErrorState();
    }

    if (_notifications.isEmpty) {
      return _buildEmptyState();
    }

    return RefreshIndicator(
      color: GlassColors.primary,
      backgroundColor: GlassColors.surface,
      onRefresh: _loadNotifications,
      child: ListView.separated(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.symmetric(
          horizontal: GlassSpacing.lg,
          vertical: GlassSpacing.md,
        ),
        itemCount: _notifications.length,
        separatorBuilder: (_, __) => const SizedBox(height: GlassSpacing.sm),
        itemBuilder: (context, index) {
          final notification = _notifications[index];
          return _NotificationTile(
            notification: notification,
            onTap: () => _markAsRead(notification.id),
          );
        },
      ),
    );
  }

  // ---------------------------------------------------------------------------
  // Loading shimmer
  // ---------------------------------------------------------------------------

  Widget _buildShimmerLoading() {
    return ListView.separated(
      physics: const NeverScrollableScrollPhysics(),
      padding: const EdgeInsets.symmetric(
        horizontal: GlassSpacing.lg,
        vertical: GlassSpacing.md,
      ),
      itemCount: 6,
      separatorBuilder: (_, __) => const SizedBox(height: GlassSpacing.sm),
      itemBuilder: (_, __) => const _ShimmerNotificationTile(),
    );
  }

  // ---------------------------------------------------------------------------
  // Empty state
  // ---------------------------------------------------------------------------

  Widget _buildEmptyState() {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(GlassSpacing.xxxl),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              Icons.notifications_none_rounded,
              size: 72,
              color: GlassColors.textTertiary.withOpacity(0.5),
            ),
            const SizedBox(height: GlassSpacing.lg),
            Text(
              'No notifications yet',
              style: GlassTypography.headline3(
                color: GlassColors.textSecondary,
              ),
            ),
            const SizedBox(height: GlassSpacing.sm),
            Text(
              'When you receive notifications,\nthey will appear here.',
              textAlign: TextAlign.center,
              style: GlassTypography.bodyMedium(
                color: GlassColors.textTertiary,
              ),
            ),
          ],
        ),
      ),
    );
  }

  // ---------------------------------------------------------------------------
  // Error state
  // ---------------------------------------------------------------------------

  Widget _buildErrorState() {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(GlassSpacing.xxxl),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              Icons.error_outline_rounded,
              size: 64,
              color: GlassColors.error.withOpacity(0.7),
            ),
            const SizedBox(height: GlassSpacing.lg),
            Text(
              _error!,
              textAlign: TextAlign.center,
              style: GlassTypography.bodyMedium(
                color: GlassColors.textSecondary,
              ),
            ),
            const SizedBox(height: GlassSpacing.xl),
            GlassCard(
              onTap: _loadNotifications,
              padding: const EdgeInsets.symmetric(
                horizontal: GlassSpacing.xl,
                vertical: GlassSpacing.md,
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Icon(Icons.refresh_rounded,
                      size: 18, color: GlassColors.primary),
                  const SizedBox(width: GlassSpacing.sm),
                  Text('Retry', style: GlassTypography.labelLarge(
                    color: GlassColors.primary,
                  )),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// =============================================================================
// Notification tile
// =============================================================================

class _NotificationTile extends StatelessWidget {
  final AppNotification notification;
  final VoidCallback onTap;

  const _NotificationTile({
    required this.notification,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return GlassCard(
      onTap: onTap,
      backgroundColor: notification.isRead
          ? Colors.white
          : GlassColors.primary,
      backgroundOpacity: notification.isRead ? 0.4 : 0.05,
      padding: const EdgeInsets.all(GlassSpacing.lg),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Type icon
          _NotificationIcon(type: notification.type),
          const SizedBox(width: GlassSpacing.md),

          // Message body
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text.rich(
                  TextSpan(
                    children: [
                      TextSpan(
                        text: notification.senderName,
                        style: GlassTypography.labelLarge(),
                      ),
                      TextSpan(
                        text: ' ${_messageWithoutSender(notification)}',
                        style: GlassTypography.bodyMedium(),
                      ),
                    ],
                  ),
                  maxLines: 3,
                  overflow: TextOverflow.ellipsis,
                ),
                const SizedBox(height: GlassSpacing.xs),
                Text(
                  _formatTimeAgo(notification.createdAt),
                  style: GlassTypography.bodySmall(
                    color: GlassColors.textTertiary,
                  ),
                ),
              ],
            ),
          ),

          // Unread dot
          if (!notification.isRead)
            Padding(
              padding: const EdgeInsets.only(
                left: GlassSpacing.sm,
                top: GlassSpacing.xs,
              ),
              child: Container(
                width: 8,
                height: 8,
                decoration: const BoxDecoration(
                  shape: BoxShape.circle,
                  color: GlassColors.primary,
                ),
              ),
            ),
        ],
      ),
    );
  }

  /// Returns the notification message with the sender name stripped from the
  /// beginning so we can bold the name separately in the RichText.
  String _messageWithoutSender(AppNotification n) {
    final full = n.message;
    if (full.startsWith(n.senderName)) {
      return full.substring(n.senderName.length);
    }
    // For self-referential messages like "You earned..."
    return full;
  }

  /// Formats a [DateTime] as a human-readable "time ago" string.
  String _formatTimeAgo(DateTime dateTime) {
    final diff = DateTime.now().difference(dateTime);
    if (diff.inSeconds < 60) return 'Just now';
    if (diff.inMinutes < 60) {
      final m = diff.inMinutes;
      return '${m}m ago';
    }
    if (diff.inHours < 24) {
      final h = diff.inHours;
      return '${h}h ago';
    }
    if (diff.inDays < 7) {
      final d = diff.inDays;
      return '${d}d ago';
    }
    if (diff.inDays < 30) {
      final w = diff.inDays ~/ 7;
      return '${w}w ago';
    }
    final months = diff.inDays ~/ 30;
    return '${months}mo ago';
  }
}

// =============================================================================
// Type-specific icon
// =============================================================================

class _NotificationIcon extends StatelessWidget {
  final NotificationType type;

  const _NotificationIcon({required this.type});

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 40,
      height: 40,
      decoration: BoxDecoration(
        color: _iconColor.withOpacity(0.12),
        borderRadius: BorderRadius.circular(GlassRadius.sm),
      ),
      child: Icon(_iconData, size: 20, color: _iconColor),
    );
  }

  IconData get _iconData {
    switch (type) {
      case NotificationType.follow:
        return Icons.person_add_rounded;
      case NotificationType.newPost:
        return Icons.article_rounded;
      case NotificationType.badgeEarned:
        return Icons.emoji_events_rounded;
      case NotificationType.like:
        return Icons.favorite_rounded;
      case NotificationType.resourceSaved:
        return Icons.bookmark_rounded;
      case NotificationType.comment:
        return Icons.comment_rounded;
      case NotificationType.connectRequest:
        return Icons.person_add_alt_1_rounded;
      case NotificationType.connectAccepted:
        return Icons.handshake_rounded;
    }
  }

  Color get _iconColor {
    switch (type) {
      case NotificationType.follow:
        return const Color(0xFF3B82F6); // Blue
      case NotificationType.newPost:
        return const Color(0xFF8B5CF6); // Purple
      case NotificationType.badgeEarned:
        return GlassColors.primary; // Saffron
      case NotificationType.like:
        return const Color(0xFFEF4444); // Red
      case NotificationType.resourceSaved:
        return const Color(0xFF10B981); // Green
      case NotificationType.comment:
        return const Color(0xFF6366F1); // Indigo
      case NotificationType.connectRequest:
        return const Color(0xFF0EA5E9); // Sky blue
      case NotificationType.connectAccepted:
        return const Color(0xFF10B981); // Green
    }
  }
}

// =============================================================================
// Shimmer placeholder tile
// =============================================================================

class _ShimmerNotificationTile extends StatefulWidget {
  const _ShimmerNotificationTile();

  @override
  State<_ShimmerNotificationTile> createState() =>
      _ShimmerNotificationTileState();
}

class _ShimmerNotificationTileState extends State<_ShimmerNotificationTile>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller;
  late final Animation<double> _opacity;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1200),
    )..repeat(reverse: true);
    _opacity = Tween<double>(begin: 0.3, end: 0.7).animate(
      CurvedAnimation(parent: _controller, curve: Curves.easeInOut),
    );
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _opacity,
      builder: (context, _) {
        return GlassCard(
          padding: const EdgeInsets.all(GlassSpacing.lg),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Icon placeholder
              Container(
                width: 40,
                height: 40,
                decoration: BoxDecoration(
                  color: GlassColors.textTertiary
                      .withOpacity(_opacity.value * 0.3),
                  borderRadius: BorderRadius.circular(GlassRadius.sm),
                ),
              ),
              const SizedBox(width: GlassSpacing.md),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // Name line
                    Container(
                      width: 160,
                      height: 14,
                      decoration: BoxDecoration(
                        color: GlassColors.textTertiary
                            .withOpacity(_opacity.value * 0.3),
                        borderRadius:
                            BorderRadius.circular(GlassRadius.xs / 2),
                      ),
                    ),
                    const SizedBox(height: GlassSpacing.sm),
                    // Message line
                    Container(
                      width: double.infinity,
                      height: 12,
                      decoration: BoxDecoration(
                        color: GlassColors.textTertiary
                            .withOpacity(_opacity.value * 0.2),
                        borderRadius:
                            BorderRadius.circular(GlassRadius.xs / 2),
                      ),
                    ),
                    const SizedBox(height: GlassSpacing.xs),
                    // Time line
                    Container(
                      width: 60,
                      height: 10,
                      decoration: BoxDecoration(
                        color: GlassColors.textTertiary
                            .withOpacity(_opacity.value * 0.15),
                        borderRadius:
                            BorderRadius.circular(GlassRadius.xs / 2),
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        );
      },
    );
  }
}

