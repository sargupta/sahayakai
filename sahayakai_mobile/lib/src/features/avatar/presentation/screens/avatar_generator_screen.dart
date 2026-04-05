import 'dart:convert';
import 'dart:typed_data';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:share_plus/share_plus.dart';
import 'package:path_provider/path_provider.dart';
import 'dart:io';

import '../../../../core/theme/glassmorphic/glass_components.dart';
import '../../data/avatar_repository.dart';

// ---------------------------------------------------------------------------
// Style model
// ---------------------------------------------------------------------------

enum AvatarStyle {
  cartoon('Cartoon', Icons.face_rounded, 'cartoon'),
  realistic('Realistic', Icons.camera_alt_rounded, 'realistic'),
  pixelArt('Pixel Art', Icons.grid_on_rounded, 'pixel_art'),
  watercolor('Watercolor', Icons.brush_rounded, 'watercolor'),
  minimal('Minimal', Icons.circle_outlined, 'minimal'),
  abstract_('Abstract', Icons.auto_awesome_rounded, 'abstract');

  const AvatarStyle(this.label, this.icon, this.apiValue);

  final String label;
  final IconData icon;
  final String apiValue;
}

// ---------------------------------------------------------------------------
// Generation state
// ---------------------------------------------------------------------------

enum _GenerationPhase { idle, loading, success, error }

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

class AvatarGeneratorScreen extends ConsumerStatefulWidget {
  const AvatarGeneratorScreen({super.key});

  @override
  ConsumerState<AvatarGeneratorScreen> createState() =>
      _AvatarGeneratorScreenState();
}

class _AvatarGeneratorScreenState
    extends ConsumerState<AvatarGeneratorScreen> {
  final _topicController = TextEditingController();

  AvatarStyle _selectedStyle = AvatarStyle.cartoon;
  _GenerationPhase _phase = _GenerationPhase.idle;

  String? _imageBase64;
  String? _errorMessage;

  // Quota
  int _quotaUsed = 0;
  int _quotaLimit = 5;
  bool _quotaLoaded = false;

  @override
  void initState() {
    super.initState();
    _loadQuota();
  }

  @override
  void dispose() {
    _topicController.dispose();
    super.dispose();
  }

  // ---------------------------------------------------------------------------
  // Data loading
  // ---------------------------------------------------------------------------

  Future<void> _loadQuota() async {
    try {
      final repo = ref.read(avatarRepositoryProvider);
      final quota = await repo.getQuota();
      if (mounted) {
        setState(() {
          _quotaUsed = quota.used;
          _quotaLimit = quota.limit;
          _quotaLoaded = true;
        });
      }
    } catch (_) {
      // Silently fail -- we'll still show a default quota bar.
      if (mounted) setState(() => _quotaLoaded = true);
    }
  }

  // ---------------------------------------------------------------------------
  // Generation
  // ---------------------------------------------------------------------------

  Future<void> _generate() async {
    if (_quotaUsed >= _quotaLimit) {
      _showSnack('Daily avatar limit reached. Try again tomorrow!');
      return;
    }

    setState(() {
      _phase = _GenerationPhase.loading;
      _imageBase64 = null;
      _errorMessage = null;
    });

    try {
      final repo = ref.read(avatarRepositoryProvider);
      final topic = _topicController.text.trim();

      final base64 = await repo.generateAvatar(
        style: _selectedStyle.apiValue,
        topic: topic.isNotEmpty ? topic : null,
      );

      if (mounted) {
        setState(() {
          _imageBase64 = base64;
          _phase = _GenerationPhase.success;
          _quotaUsed++;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _errorMessage = e.toString().replaceFirst('Exception: ', '');
          _phase = _GenerationPhase.error;
        });
      }
    }
  }

  void _resetToIdle() {
    setState(() {
      _phase = _GenerationPhase.idle;
      _imageBase64 = null;
      _errorMessage = null;
    });
  }

  // ---------------------------------------------------------------------------
  // Share
  // ---------------------------------------------------------------------------

  Future<void> _shareAvatar() async {
    if (_imageBase64 == null) return;

    try {
      final bytes = base64Decode(_imageBase64!);
      final dir = await getTemporaryDirectory();
      final file = File('${dir.path}/sahayak_avatar.png');
      await file.writeAsBytes(bytes);

      await Share.shareXFiles(
        [XFile(file.path)],
        text: 'My AI Avatar from SahayakAI',
      );
    } catch (_) {
      _showSnack('Could not share avatar. Please try again.');
    }
  }

  // ---------------------------------------------------------------------------
  // Save to profile (placeholder -- hook into user profile update)
  // ---------------------------------------------------------------------------

  void _saveToProfile() {
    // TODO: Integrate with user profile repository to persist avatar.
    _showSnack('Avatar saved to your profile!');
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  void _showSnack(String message) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(message)),
    );
  }

  // ---------------------------------------------------------------------------
  // Build
  // ---------------------------------------------------------------------------

  @override
  Widget build(BuildContext context) {
    return GlassScaffold(
      title: 'AI Avatar',
      actions: [
        if (_phase == _GenerationPhase.success)
          GlassIconButton(
            icon: Icons.share_rounded,
            onPressed: _shareAvatar,
            size: 40,
            isOutlined: true,
          ),
      ],
      body: SingleChildScrollView(
        padding: GlassSpacing.screenPadding,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Quota bar
            _buildQuotaBar(),
            const SizedBox(height: GlassSpacing.xxl),

            // Phase-dependent content
            switch (_phase) {
              _GenerationPhase.idle => _buildIdleContent(),
              _GenerationPhase.loading => _buildLoadingContent(),
              _GenerationPhase.success => _buildSuccessContent(),
              _GenerationPhase.error => _buildErrorContent(),
            },
          ],
        ),
      ),
    );
  }

  // ---------------------------------------------------------------------------
  // Quota bar
  // ---------------------------------------------------------------------------

  Widget _buildQuotaBar() {
    final progress = _quotaLimit > 0 ? _quotaUsed / _quotaLimit : 0.0;
    final isExhausted = _quotaUsed >= _quotaLimit;

    return GlassCard(
      padding: const EdgeInsets.symmetric(
        horizontal: GlassSpacing.lg,
        vertical: GlassSpacing.md,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(
                Icons.auto_awesome_rounded,
                size: 18,
                color: isExhausted
                    ? GlassColors.error
                    : GlassColors.primary,
              ),
              const SizedBox(width: GlassSpacing.sm),
              Expanded(
                child: Text(
                  _quotaLoaded
                      ? '$_quotaUsed/$_quotaLimit avatars used today'
                      : 'Loading quota...',
                  style: GlassTypography.labelLarge(
                    color: isExhausted
                        ? GlassColors.error
                        : GlassColors.textPrimary,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: GlassSpacing.sm),
          ClipRRect(
            borderRadius: BorderRadius.circular(GlassRadius.xs),
            child: LinearProgressIndicator(
              value: progress.clamp(0.0, 1.0),
              minHeight: 6,
              backgroundColor: GlassColors.inputBackground,
              valueColor: AlwaysStoppedAnimation<Color>(
                isExhausted ? GlassColors.error : GlassColors.primary,
              ),
            ),
          ),
        ],
      ),
    );
  }

  // ---------------------------------------------------------------------------
  // Idle: style grid + topic + generate button
  // ---------------------------------------------------------------------------

  Widget _buildIdleContent() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text('CHOOSE A STYLE', style: GlassTypography.sectionHeader()),
        const SizedBox(height: GlassSpacing.md),
        _buildStyleGrid(),
        const SizedBox(height: GlassSpacing.xxl),

        // Optional topic
        GlassTextField(
          controller: _topicController,
          labelText: 'Topic (Optional)',
          hintText: 'e.g., Science teacher, Math lover',
          prefixIcon: const Icon(
            Icons.lightbulb_outline_rounded,
            color: GlassColors.textTertiary,
          ),
        ),
        const SizedBox(height: GlassSpacing.xxxl),

        // Generate button
        GlassPrimaryButton(
          label: 'Generate Avatar',
          icon: Icons.auto_awesome_rounded,
          onPressed: _generate,
        ),
      ],
    );
  }

  Widget _buildStyleGrid() {
    return GridView.count(
      crossAxisCount: 3,
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      mainAxisSpacing: GlassSpacing.md,
      crossAxisSpacing: GlassSpacing.md,
      childAspectRatio: 1.0,
      children: AvatarStyle.values.map((style) {
        final isSelected = _selectedStyle == style;
        return GlassCard(
          onTap: () => setState(() => _selectedStyle = style),
          backgroundOpacity: isSelected ? 0.6 : 0.35,
          borderOpacity: isSelected ? 0.8 : 0.3,
          padding: const EdgeInsets.all(GlassSpacing.sm),
          child: Container(
            decoration: isSelected
                ? BoxDecoration(
                    borderRadius: BorderRadius.circular(GlassRadius.lg),
                    border: Border.all(
                      color: GlassColors.primary,
                      width: 2,
                    ),
                  )
                : null,
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(
                  style.icon,
                  size: 32,
                  color: isSelected
                      ? GlassColors.primary
                      : GlassColors.textSecondary,
                ),
                const SizedBox(height: GlassSpacing.sm),
                Text(
                  style.label,
                  style: GlassTypography.labelMedium(
                    color: isSelected
                        ? GlassColors.primary
                        : GlassColors.textPrimary,
                  ),
                  textAlign: TextAlign.center,
                ),
              ],
            ),
          ),
        );
      }).toList(),
    );
  }

  // ---------------------------------------------------------------------------
  // Loading: pulsing placeholder
  // ---------------------------------------------------------------------------

  Widget _buildLoadingContent() {
    return Center(
      child: Column(
        children: [
          const SizedBox(height: GlassSpacing.xxxl),
          _PulsingPlaceholder(size: 200),
          const SizedBox(height: GlassSpacing.xxl),
          Text(
            'Creating your avatar...',
            style: GlassTypography.headline3(
              color: GlassColors.textSecondary,
            ),
          ),
          const SizedBox(height: GlassSpacing.sm),
          Text(
            'Style: ${_selectedStyle.label}',
            style: GlassTypography.bodyMedium(
              color: GlassColors.textTertiary,
            ),
          ),
        ],
      ),
    );
  }

  // ---------------------------------------------------------------------------
  // Success: avatar image + action buttons
  // ---------------------------------------------------------------------------

  Widget _buildSuccessContent() {
    final Uint8List imageBytes = base64Decode(_imageBase64!);

    return Column(
      children: [
        // Avatar image
        GlassCard(
          padding: const EdgeInsets.all(GlassSpacing.lg),
          child: ClipRRect(
            borderRadius: BorderRadius.circular(GlassRadius.md),
            child: Image.memory(
              imageBytes,
              width: double.infinity,
              height: 300,
              fit: BoxFit.contain,
              errorBuilder: (_, __, ___) => SizedBox(
                height: 300,
                child: Center(
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      const Icon(
                        Icons.broken_image_rounded,
                        size: 48,
                        color: GlassColors.textTertiary,
                      ),
                      const SizedBox(height: GlassSpacing.sm),
                      Text(
                        'Could not render avatar',
                        style: GlassTypography.bodyMedium(
                          color: GlassColors.textTertiary,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ),
        ),
        const SizedBox(height: GlassSpacing.xxl),

        // Action buttons
        GlassPrimaryButton(
          label: 'Save to Profile',
          icon: Icons.person_rounded,
          onPressed: _saveToProfile,
        ),
        const SizedBox(height: GlassSpacing.md),
        GlassSecondaryButton(
          label: 'Generate Another',
          icon: Icons.refresh_rounded,
          onPressed: _resetToIdle,
        ),
      ],
    );
  }

  // ---------------------------------------------------------------------------
  // Error: message + retry
  // ---------------------------------------------------------------------------

  Widget _buildErrorContent() {
    return Center(
      child: Column(
        children: [
          const SizedBox(height: GlassSpacing.xxxl),
          GlassCard(
            padding: GlassSpacing.cardPadding,
            child: Column(
              children: [
                const Icon(
                  Icons.error_outline_rounded,
                  size: 48,
                  color: GlassColors.error,
                ),
                const SizedBox(height: GlassSpacing.lg),
                Text(
                  'Generation Failed',
                  style: GlassTypography.headline3(
                    color: GlassColors.error,
                  ),
                ),
                const SizedBox(height: GlassSpacing.sm),
                Text(
                  _errorMessage ?? 'An unexpected error occurred.',
                  style: GlassTypography.bodyMedium(
                    color: GlassColors.textSecondary,
                  ),
                  textAlign: TextAlign.center,
                ),
              ],
            ),
          ),
          const SizedBox(height: GlassSpacing.xxl),
          GlassPrimaryButton(
            label: 'Retry',
            icon: Icons.refresh_rounded,
            onPressed: _generate,
          ),
          const SizedBox(height: GlassSpacing.md),
          GlassSecondaryButton(
            label: 'Change Settings',
            icon: Icons.tune_rounded,
            onPressed: _resetToIdle,
          ),
        ],
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Pulsing placeholder animation
// ---------------------------------------------------------------------------

class _PulsingPlaceholder extends StatefulWidget {
  final double size;

  const _PulsingPlaceholder({required this.size});

  @override
  State<_PulsingPlaceholder> createState() => _PulsingPlaceholderState();
}

class _PulsingPlaceholderState extends State<_PulsingPlaceholder>
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

    _opacity = Tween<double>(begin: 0.3, end: 0.8).animate(
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
      animation: _controller,
      builder: (context, child) {
        return Container(
          width: widget.size,
          height: widget.size,
          decoration: BoxDecoration(
            color: GlassColors.primary.withOpacity(_opacity.value * 0.15),
            borderRadius: BorderRadius.circular(GlassRadius.xl),
            border: Border.all(
              color: GlassColors.primary.withOpacity(_opacity.value * 0.4),
              width: 2,
            ),
          ),
          child: Center(
            child: Icon(
              Icons.auto_awesome_rounded,
              size: widget.size * 0.3,
              color: GlassColors.primary.withOpacity(_opacity.value),
            ),
          ),
        );
      },
    );
  }
}
