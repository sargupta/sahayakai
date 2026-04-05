import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../../core/theme/glassmorphic/glass_components.dart';
import '../../../../core/providers/language_provider.dart';
import '../../../../components/tts_play_button.dart';
import '../../../lesson_plan/presentation/widgets/voice_input_widget.dart';
import '../../data/field_trip_repository.dart';

class VirtualFieldTripScreen extends ConsumerStatefulWidget {
  const VirtualFieldTripScreen({super.key});

  @override
  ConsumerState<VirtualFieldTripScreen> createState() =>
      _VirtualFieldTripScreenState();
}

class _VirtualFieldTripScreenState
    extends ConsumerState<VirtualFieldTripScreen> {
  final _topicController = TextEditingController();
  String _selectedGrade = 'Class 8';
  bool _isGenerating = false;
  FieldTripOutput? _result;

  final List<String> _grades = [
    'Class 5', 'Class 6', 'Class 7', 'Class 8',
    'Class 9', 'Class 10', 'Class 11', 'Class 12',
  ];

  Future<void> _generate() async {
    if (_topicController.text.trim().isEmpty) return;
    setState(() => _isGenerating = true);

    try {
      final language = ref.read(languageProvider);
      final repo = ref.read(fieldTripRepositoryProvider);

      final result = await repo.generate(
        topic: _topicController.text.trim(),
        gradeLevel: _selectedGrade,
        language: language,
      );

      setState(() { _isGenerating = false; _result = result; });
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Error: $e'), backgroundColor: Colors.red),
        );
        setState(() => _isGenerating = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return GlassScaffold(
      title: 'Virtual Field Trip',
      showBackButton: true,
      floatingActionButton: _result == null
          ? GlassFloatingButton(
              label: 'Plan Trip',
              icon: Icons.travel_explore_rounded,
              onPressed: _isGenerating ? null : _generate,
              isLoading: _isGenerating,
            )
          : null,
      floatingActionButtonLocation: FloatingActionButtonLocation.centerFloat,
      body: _result != null ? _buildStops() : _buildForm(),
    );
  }

  Widget _buildForm() {
    return SingleChildScrollView(
          keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
      padding: const EdgeInsets.all(GlassSpacing.xl),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Exploring the World...', style: GlassTypography.decorativeLabel()),
          const SizedBox(height: GlassSpacing.xs),
          Text('Plan Your Journey', style: GlassTypography.headline1()),
          const SizedBox(height: GlassSpacing.xxl),

          GlassIconCard(
            icon: Icons.map_rounded,
            iconColor: GlassColors.primary,
            title: 'Trip Details',
            child: Column(
              children: [
                GlassTextField(
                  controller: _topicController,
                  labelText: 'TOPIC',
                  hintText: 'e.g. The Great Barrier Reef, Ancient Rome',
                  suffixIcon: VoiceInputWidget(
                    onResult: (val) => setState(() => _topicController.text = val),
                  ),
                ),
                const SizedBox(height: GlassSpacing.lg),
                GlassDropdown<String>(
                  labelText: 'GRADE',
                  value: _selectedGrade,
                  items: _grades
                      .map((g) => DropdownMenuItem(value: g, child: Text(g)))
                      .toList(),
                  onChanged: (v) {
                    if (v != null) setState(() => _selectedGrade = v);
                  },
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildStops() {
    return Column(
      children: [
        // Header
        Padding(
          padding: const EdgeInsets.all(GlassSpacing.xl),
          child: Row(
            children: [
              GlassIconButton(
                icon: Icons.arrow_back_rounded,
                onPressed: () => setState(() => _result = null),
              ),
              const SizedBox(width: GlassSpacing.md),
              Expanded(
                child: Text(_result!.title, style: GlassTypography.headline2()),
              ),
              TTSPlayButton(
                text: '${_result!.title}. ${_result!.stops.map((s) => '${s.name}. ${s.description}. ${s.educationalFact}').join('. ')}',
              ),
            ],
          ),
        ),

        // Stops list
        Expanded(
          child: ListView.builder(
            padding: const EdgeInsets.symmetric(horizontal: GlassSpacing.xl),
            itemCount: _result!.stops.length,
            itemBuilder: (context, index) {
              final stop = _result!.stops[index];
              return Padding(
                padding: const EdgeInsets.only(bottom: GlassSpacing.lg),
                child: GlassCard(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      // Stop header
                      Row(
                        children: [
                          CircleAvatar(
                            backgroundColor: GlassColors.primary.withOpacity(0.1),
                            child: Text(
                              '${index + 1}',
                              style: TextStyle(
                                color: GlassColors.primary,
                                fontWeight: FontWeight.bold,
                              ),
                            ),
                          ),
                          const SizedBox(width: GlassSpacing.md),
                          Expanded(
                            child: Text(stop.name,
                                style: GlassTypography.labelLarge()),
                          ),
                          TTSPlayButton(
                            text: '${stop.name}. ${stop.description}. ${stop.educationalFact}',
                            size: 32,
                          ),
                        ],
                      ),
                      const SizedBox(height: GlassSpacing.md),

                      Text(stop.description, style: GlassTypography.bodyMedium()),
                      const SizedBox(height: GlassSpacing.md),

                      // Educational fact
                      Container(
                        padding: const EdgeInsets.all(GlassSpacing.md),
                        decoration: BoxDecoration(
                          color: GlassColors.primary.withOpacity(0.05),
                          borderRadius: BorderRadius.circular(GlassRadius.sm),
                        ),
                        child: Row(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Icon(Icons.lightbulb_rounded,
                                size: 18, color: GlassColors.primary),
                            const SizedBox(width: GlassSpacing.sm),
                            Expanded(
                              child: Text(stop.educationalFact,
                                  style: GlassTypography.bodySmall()),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(height: GlassSpacing.md),

                      // Reflection prompt
                      Text('Reflect:', style: GlassTypography.labelMedium()),
                      const SizedBox(height: GlassSpacing.xs),
                      Text(stop.reflectionPrompt,
                          style: GlassTypography.bodySmall(
                              color: GlassColors.textSecondary)),

                      // Cultural analogy
                      if (stop.culturalAnalogy != null) ...[
                        const SizedBox(height: GlassSpacing.md),
                        Text('Bharat Connection:',
                            style: GlassTypography.labelMedium()),
                        const SizedBox(height: GlassSpacing.xs),
                        Text(stop.culturalAnalogy!,
                            style: GlassTypography.bodySmall(
                                color: GlassColors.textSecondary)),
                      ],

                      // Google Earth link
                      if (stop.googleEarthUrl != null) ...[
                        const SizedBox(height: GlassSpacing.md),
                        GlassSecondaryButton(
                          label: 'Open in Google Earth',
                          icon: Icons.public_rounded,
                          onPressed: () async {
                            final uri = Uri.parse(stop.googleEarthUrl!);
                            if (await canLaunchUrl(uri)) {
                              await launchUrl(uri,
                                  mode: LaunchMode.externalApplication);
                            }
                          },
                        ),
                      ],
                    ],
                  ),
                ),
              );
            },
          ),
        ),

        // Regenerate
        Padding(
          padding: const EdgeInsets.all(GlassSpacing.xl),
          child: GlassPrimaryButton(
            label: 'Plan Another Trip',
            icon: Icons.refresh_rounded,
            onPressed: () => setState(() => _result = null),
          ),
        ),
      ],
    );
  }
}
