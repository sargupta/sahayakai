import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/theme/glassmorphic/glass_components.dart';
import '../../data/community_repository.dart';
import '../../domain/community_models.dart';

// ---------------------------------------------------------------------------
// Riverpod providers (auto-dispose so data refreshes on re-enter)
// ---------------------------------------------------------------------------

final _connectionsProvider =
    FutureProvider.autoDispose<List<TeacherConnection>>((ref) {
  return ref.watch(communityRepositoryProvider).getConnections();
});

final _requestsProvider =
    FutureProvider.autoDispose<List<ConnectionRequest>>((ref) {
  return ref.watch(communityRepositoryProvider).getConnectionRequests();
});

final _discoverProvider =
    FutureProvider.autoDispose<List<TeacherConnection>>((ref) {
  return ref.watch(communityRepositoryProvider).getDiscoverTeachers();
});

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

class ConnectionsScreen extends ConsumerStatefulWidget {
  const ConnectionsScreen({super.key});

  @override
  ConsumerState<ConnectionsScreen> createState() => _ConnectionsScreenState();
}

class _ConnectionsScreenState extends ConsumerState<ConnectionsScreen>
    with SingleTickerProviderStateMixin {
  late final TabController _tabController;

  /// Local copies for optimistic removal / state changes.
  List<ConnectionRequest>? _localRequests;
  final Map<String, ConnectionStatus> _discoverStatus = {};

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 3, vsync: this);
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  // -----------------------------------------------------------------------
  // Build
  // -----------------------------------------------------------------------

  @override
  Widget build(BuildContext context) {
    return GlassScaffold(
      title: 'Connections',
      body: Column(
        children: [
          _buildTabBar(),
          Expanded(
            child: TabBarView(
              controller: _tabController,
              children: [
                _ConnectedTab(ref: ref),
                _buildRequestsTab(),
                _buildDiscoverTab(),
              ],
            ),
          ),
        ],
      ),
    );
  }

  // -----------------------------------------------------------------------
  // Tab bar
  // -----------------------------------------------------------------------

  Widget _buildTabBar() {
    return Padding(
      padding: const EdgeInsets.symmetric(
        horizontal: GlassSpacing.xl,
        vertical: GlassSpacing.sm,
      ),
      child: GlassCard(
        padding: const EdgeInsets.all(4),
        borderRadius: GlassRadius.pill,
        child: TabBar(
          controller: _tabController,
          indicator: BoxDecoration(
            color: GlassColors.primary,
            borderRadius: BorderRadius.circular(GlassRadius.pill),
          ),
          indicatorSize: TabBarIndicatorSize.tab,
          labelColor: Colors.white,
          unselectedLabelColor: GlassColors.textSecondary,
          labelStyle: GlassTypography.labelLarge(),
          unselectedLabelStyle: GlassTypography.labelMedium(),
          dividerHeight: 0,
          tabs: const [
            Tab(text: 'Connected'),
            Tab(text: 'Requests'),
            Tab(text: 'Discover'),
          ],
        ),
      ),
    );
  }

  // -----------------------------------------------------------------------
  // Requests tab
  // -----------------------------------------------------------------------

  Widget _buildRequestsTab() {
    final asyncRequests = ref.watch(_requestsProvider);

    return asyncRequests.when(
      loading: () => const Center(child: CircularProgressIndicator()),
      error: (e, _) => _emptyState('Something went wrong. Pull to retry.'),
      data: (serverRequests) {
        _localRequests ??= List.of(serverRequests);
        final requests = _localRequests!;

        if (requests.isEmpty) {
          return _emptyState('No pending requests');
        }

        return ListView.builder(
          padding: const EdgeInsets.symmetric(horizontal: GlassSpacing.xl),
          itemCount: requests.length,
          itemBuilder: (context, index) {
            final req = requests[index];
            return _RequestCard(
              request: req,
              onAccept: () => _handleAccept(req, index),
              onDecline: () => _handleDecline(req, index),
            );
          },
        );
      },
    );
  }

  Future<void> _handleAccept(ConnectionRequest req, int index) async {
    setState(() => _localRequests!.removeAt(index));
    await ref.read(communityRepositoryProvider).acceptConnection(req.id);
    // Refresh the connected list so the accepted teacher appears.
    ref.invalidate(_connectionsProvider);
  }

  Future<void> _handleDecline(ConnectionRequest req, int index) async {
    setState(() => _localRequests!.removeAt(index));
    await ref.read(communityRepositoryProvider).declineConnection(req.id);
  }

  // -----------------------------------------------------------------------
  // Discover tab
  // -----------------------------------------------------------------------

  Widget _buildDiscoverTab() {
    final asyncDiscover = ref.watch(_discoverProvider);

    return asyncDiscover.when(
      loading: () => const Center(child: CircularProgressIndicator()),
      error: (e, _) => _emptyState('Something went wrong. Pull to retry.'),
      data: (teachers) {
        if (teachers.isEmpty) {
          return _emptyState('No recommendations right now');
        }

        return ListView.builder(
          padding: const EdgeInsets.symmetric(horizontal: GlassSpacing.xl),
          itemCount: teachers.length,
          itemBuilder: (context, index) {
            final teacher = teachers[index];
            final status =
                _discoverStatus[teacher.id] ?? ConnectionStatus.none;
            return _DiscoverCard(
              teacher: teacher,
              currentStatus: status,
              onConnect: () => _handleConnect(teacher),
            );
          },
        );
      },
    );
  }

  Future<void> _handleConnect(TeacherConnection teacher) async {
    setState(() => _discoverStatus[teacher.id] = ConnectionStatus.pending);
    await ref
        .read(communityRepositoryProvider)
        .sendConnectionRequest(teacher.id);
  }

  // -----------------------------------------------------------------------
  // Shared helpers
  // -----------------------------------------------------------------------

  Widget _emptyState(String message) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(GlassSpacing.xxxl),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              Icons.people_outline_rounded,
              size: 64,
              color: GlassColors.textTertiary.withOpacity(0.5),
            ),
            const SizedBox(height: GlassSpacing.lg),
            Text(
              message,
              style: GlassTypography.bodyMedium(
                color: GlassColors.textSecondary,
              ),
              textAlign: TextAlign.center,
            ),
          ],
        ),
      ),
    );
  }
}

// ===========================================================================
// Connected tab (separate widget so RefreshIndicator works cleanly)
// ===========================================================================

class _ConnectedTab extends StatelessWidget {
  const _ConnectedTab({required this.ref});

  final WidgetRef ref;

  @override
  Widget build(BuildContext context) {
    final asyncConnections = ref.watch(_connectionsProvider);

    return asyncConnections.when(
      loading: () => const Center(child: CircularProgressIndicator()),
      error: (e, _) => _emptyMessage(
        'Something went wrong. Pull to retry.',
      ),
      data: (connections) {
        if (connections.isEmpty) {
          return _emptyMessage(
            'No connections yet.\nDiscover teachers below!',
          );
        }

        return RefreshIndicator(
          color: GlassColors.primary,
          onRefresh: () async => ref.invalidate(_connectionsProvider),
          child: ListView.builder(
            padding:
                const EdgeInsets.symmetric(horizontal: GlassSpacing.xl),
            itemCount: connections.length,
            itemBuilder: (context, index) =>
                _ConnectedCard(teacher: connections[index]),
          ),
        );
      },
    );
  }

  Widget _emptyMessage(String text) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(GlassSpacing.xxxl),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              Icons.group_add_outlined,
              size: 64,
              color: GlassColors.textTertiary.withOpacity(0.5),
            ),
            const SizedBox(height: GlassSpacing.lg),
            Text(
              text,
              style: GlassTypography.bodyMedium(
                color: GlassColors.textSecondary,
              ),
              textAlign: TextAlign.center,
            ),
          ],
        ),
      ),
    );
  }
}

// ===========================================================================
// Card widgets
// ===========================================================================

/// A card for a teacher the user is already connected with.
class _ConnectedCard extends StatelessWidget {
  const _ConnectedCard({required this.teacher});

  final TeacherConnection teacher;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: GlassSpacing.md),
      child: GlassCard(
        child: Row(
          children: [
            _TeacherAvatar(name: teacher.name),
            const SizedBox(width: GlassSpacing.md),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(teacher.name, style: GlassTypography.labelLarge()),
                  const SizedBox(height: GlassSpacing.xs),
                  _BadgeRow(
                    items: [...teacher.subjects, ...teacher.grades],
                  ),
                ],
              ),
            ),
            const SizedBox(width: GlassSpacing.sm),
            _SmallActionButton(
              label: 'Message',
              icon: Icons.chat_bubble_outline_rounded,
              color: GlassColors.primary,
              onPressed: () {
                Navigator.pushNamed(context, '/messages');
              },
            ),
          ],
        ),
      ),
    );
  }
}

/// A card for an incoming connection request.
class _RequestCard extends StatelessWidget {
  const _RequestCard({
    required this.request,
    required this.onAccept,
    required this.onDecline,
  });

  final ConnectionRequest request;
  final VoidCallback onAccept;
  final VoidCallback onDecline;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: GlassSpacing.md),
      child: GlassCard(
        child: Row(
          children: [
            _TeacherAvatar(name: request.fromName),
            const SizedBox(width: GlassSpacing.md),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    request.fromName,
                    style: GlassTypography.labelLarge(),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    'wants to connect',
                    style: GlassTypography.bodySmall(),
                  ),
                ],
              ),
            ),
            const SizedBox(width: GlassSpacing.sm),
            _SmallActionButton(
              label: 'Accept',
              icon: Icons.check_rounded,
              color: GlassColors.success,
              onPressed: onAccept,
            ),
            const SizedBox(width: GlassSpacing.sm),
            _SmallActionButton(
              label: 'Decline',
              icon: Icons.close_rounded,
              color: GlassColors.error,
              onPressed: onDecline,
            ),
          ],
        ),
      ),
    );
  }
}

/// A card for a recommended teacher in the Discover tab.
class _DiscoverCard extends StatelessWidget {
  const _DiscoverCard({
    required this.teacher,
    required this.currentStatus,
    required this.onConnect,
  });

  final TeacherConnection teacher;
  final ConnectionStatus currentStatus;
  final VoidCallback onConnect;

  @override
  Widget build(BuildContext context) {
    final isPending = currentStatus == ConnectionStatus.pending;

    return Padding(
      padding: const EdgeInsets.only(bottom: GlassSpacing.md),
      child: GlassCard(
        child: Row(
          children: [
            _TeacherAvatar(name: teacher.name),
            const SizedBox(width: GlassSpacing.md),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(teacher.name, style: GlassTypography.labelLarge()),
                  const SizedBox(height: GlassSpacing.xs),
                  if (teacher.subjects.isNotEmpty)
                    _BadgeRow(items: teacher.subjects),
                ],
              ),
            ),
            const SizedBox(width: GlassSpacing.sm),
            isPending
                ? Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: GlassSpacing.md,
                      vertical: GlassSpacing.sm,
                    ),
                    decoration: BoxDecoration(
                      color: GlassColors.chipUnselected,
                      borderRadius:
                          BorderRadius.circular(GlassRadius.pill),
                    ),
                    child: Text(
                      'Pending',
                      style: GlassTypography.labelSmall(
                        color: GlassColors.textSecondary,
                      ),
                    ),
                  )
                : _SmallActionButton(
                    label: 'Connect',
                    icon: Icons.person_add_alt_1_rounded,
                    color: GlassColors.primary,
                    onPressed: onConnect,
                  ),
          ],
        ),
      ),
    );
  }
}

// ===========================================================================
// Shared small widgets
// ===========================================================================

class _TeacherAvatar extends StatelessWidget {
  const _TeacherAvatar({required this.name});

  final String name;

  @override
  Widget build(BuildContext context) {
    return CircleAvatar(
      radius: 22,
      backgroundColor: GlassColors.primary.withOpacity(0.12),
      child: Text(
        name.isNotEmpty ? name[0].toUpperCase() : '?',
        style: GlassTypography.headline3(color: GlassColors.primary),
      ),
    );
  }
}

class _BadgeRow extends StatelessWidget {
  const _BadgeRow({required this.items});

  final List<String> items;

  @override
  Widget build(BuildContext context) {
    return Wrap(
      spacing: GlassSpacing.xs,
      runSpacing: GlassSpacing.xs,
      children: items
          .map(
            (item) => Container(
              padding: const EdgeInsets.symmetric(
                horizontal: GlassSpacing.sm,
                vertical: 2,
              ),
              decoration: BoxDecoration(
                color: GlassColors.chipUnselected,
                borderRadius: BorderRadius.circular(GlassRadius.pill),
                border: Border.all(
                  color: GlassColors.chipBorder,
                  width: 0.5,
                ),
              ),
              child: Text(
                item,
                style: GlassTypography.labelSmall(),
              ),
            ),
          )
          .toList(),
    );
  }
}

class _SmallActionButton extends StatelessWidget {
  const _SmallActionButton({
    required this.label,
    required this.icon,
    required this.color,
    required this.onPressed,
  });

  final String label;
  final IconData icon;
  final Color color;
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: color.withOpacity(0.1),
      borderRadius: BorderRadius.circular(GlassRadius.pill),
      child: InkWell(
        onTap: onPressed,
        borderRadius: BorderRadius.circular(GlassRadius.pill),
        child: Padding(
          padding: const EdgeInsets.symmetric(
            horizontal: GlassSpacing.md,
            vertical: GlassSpacing.sm,
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(icon, size: 16, color: color),
              const SizedBox(width: 4),
              Text(
                label,
                style: GlassTypography.labelSmall(color: color),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
