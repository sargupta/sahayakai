import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_markdown_plus/flutter_markdown_plus.dart';

import '../../../../core/theme/glassmorphic/glass_components.dart';
import '../../../tools/data/tool_repository.dart';
import '../../../../core/providers/language_provider.dart';
import '../../../lesson_plan/presentation/widgets/voice_input_widget.dart';

class ContentCreatorScreen extends ConsumerStatefulWidget {
  const ContentCreatorScreen({super.key});

  @override
  ConsumerState<ContentCreatorScreen> createState() =>
      _ContentCreatorScreenState();
}

class _ContentCreatorScreenState extends ConsumerState<ContentCreatorScreen> {
  final _promptController = TextEditingController();
  final _subjectController = TextEditingController();
  String _selectedType = "Lesson Note";
  bool _isLoading = false;
  String? _generatedContent;

  final List<String> _contentTypes = [
    "Lesson Note",
    "Email to Parents",
    "Class Announcement",
    "Creative Story",
    "Student Feedback",
    "Worksheet Plan"
  ];

  String _selectedTone = "Professional";
  final List<String> _tones = ["Professional", "Friendly", "Formal", "Casual"];

  Future<void> _generateContent() async {
    if (_promptController.text.trim().isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Please enter key points'),
          backgroundColor: Colors.red,
        ),
      );
      return;
    }

    setState(() => _isLoading = true);

    try {
      final language = ref.read(languageProvider);
      final toolRepo = ref.read(toolRepositoryProvider);

      final result = await toolRepo.generateToolContent(
        toolName: _selectedType,
        prompt: _promptController.text,
        language: language,
        subject: _subjectController.text.isNotEmpty
            ? _subjectController.text
            : "General",
      );

      setState(() {
        _isLoading = false;
        _generatedContent = result;
      });
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text("Error: $e"), backgroundColor: Colors.red));
        setState(() => _isLoading = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return GlassScaffold(
      title: 'Editor\'s Desk',
      showBackButton: true,
      actions: [GlassMenuButton(onPressed: () {})],
      floatingActionButton: _generatedContent == null
          ? GlassFloatingButton(
              label: 'Generate Draft',
              icon: Icons.edit_document,
              onPressed: _isLoading ? null : _generateContent,
              isLoading: _isLoading,
            )
          : null,
      floatingActionButtonLocation: FloatingActionButtonLocation.centerFloat,
      body: _generatedContent != null ? _buildResultView() : _buildInputForm(),
    );
  }

  Widget _buildInputForm() {
    return SingleChildScrollView(
      padding: const EdgeInsets.only(
        left: GlassSpacing.xl,
        right: GlassSpacing.xl,
        top: GlassSpacing.sm,
        bottom: 120,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Decorative Header
          Text(
            'Drafting Professionally...',
            style: GlassTypography.decorativeLabel(),
          ),
          const SizedBox(height: GlassSpacing.xs),
          Text(
            'Professional Content',
            style: GlassTypography.headline1(),
          ),
          const SizedBox(height: GlassSpacing.sm),
          Container(
            width: 60,
            height: 2,
            color: GlassColors.textTertiary.withOpacity(0.3),
          ),
          const SizedBox(height: GlassSpacing.xxl),

          // Document Type Card
          GlassIconCard(
            icon: Icons.description_outlined,
            iconColor: GlassColors.primary,
            title: 'Document Type',
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'SELECT FORMAT',
                  style: GlassTypography.sectionHeader(),
                ),
                const SizedBox(height: GlassSpacing.md),
                Wrap(
                  spacing: GlassSpacing.sm,
                  runSpacing: GlassSpacing.sm,
                  children: _contentTypes.map((type) {
                    final isSelected = _selectedType == type;
                    return GlassChip(
                      label: type,
                      isSelected: isSelected,
                      onTap: () {
                        HapticFeedback.lightImpact();
                        setState(() => _selectedType = type);
                      },
                    );
                  }).toList(),
                ),
              ],
            ),
          ),
          const SizedBox(height: GlassSpacing.xl),

          // Content Details Card
          GlassIconCard(
            icon: Icons.edit_rounded,
            iconColor: GlassColors.primary,
            title: 'Content Details',
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                GlassTextField(
                  controller: _subjectController,
                  labelText: 'Subject / Context',
                  hintText: 'e.g. Annual Sports Day, Parent Meeting...',
                ),
                const SizedBox(height: GlassSpacing.xl),

                GlassTextField(
                  controller: _promptController,
                  labelText: 'Key Points',
                  hintText: 'Draft a polite email to parents reminding them about...',
                  maxLines: 4,
                  suffixIcon: VoiceInputWidget(
                    onResult: (val) =>
                        setState(() => _promptController.text += " $val"),
                  ),
                ),
                const SizedBox(height: GlassSpacing.xl),

                // Tone Selection
                Text(
                  'TONE',
                  style: GlassTypography.sectionHeader(),
                ),
                const SizedBox(height: GlassSpacing.md),
                Wrap(
                  spacing: GlassSpacing.sm,
                  runSpacing: GlassSpacing.sm,
                  children: _tones.map((tone) {
                    final isSelected = _selectedTone == tone;
                    return GlassChip(
                      label: tone,
                      isSelected: isSelected,
                      onTap: () {
                        HapticFeedback.lightImpact();
                        setState(() => _selectedTone = tone);
                      },
                    );
                  }).toList(),
                ),
              ],
            ),
          ),
          const SizedBox(height: GlassSpacing.xl),

          // Preview Card
          GlassPreviewCard(
            label: 'The Editor\'s Theme',
          ),
        ],
      ),
    );
  }

  Widget _buildResultView() {
    return Column(
      children: [
        // Action Bar
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: GlassSpacing.xl),
          child: Row(
            children: [
              GlassIconButton(
                icon: Icons.arrow_back_rounded,
                onPressed: () => setState(() => _generatedContent = null),
              ),
              const Spacer(),
              GlassIconButton(
                icon: Icons.copy_rounded,
                onPressed: () {
                  Clipboard.setData(ClipboardData(text: _generatedContent!));
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(content: Text('Copied to clipboard')),
                  );
                },
              ),
              const SizedBox(width: GlassSpacing.sm),
              GlassIconButton(
                icon: Icons.share_rounded,
                onPressed: () {},
              ),
            ],
          ),
        ),
        const SizedBox(height: GlassSpacing.lg),

        // Header
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: GlassSpacing.xl),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                _selectedType,
                style: GlassTypography.headline1(),
              ),
              if (_subjectController.text.isNotEmpty) ...[
                const SizedBox(height: GlassSpacing.xs),
                Text(
                  'Subject: ${_subjectController.text}',
                  style: GlassTypography.bodySmall(),
                ),
              ],
            ],
          ),
        ),
        const SizedBox(height: GlassSpacing.lg),

        // Generated Content
        Expanded(
          child: SingleChildScrollView(
            padding: const EdgeInsets.symmetric(horizontal: GlassSpacing.xl),
            child: GlassCard(
              padding: const EdgeInsets.all(GlassSpacing.xxl),
              child: MarkdownBody(
                data: _generatedContent!,
                styleSheet: MarkdownStyleSheet(
                  h1: GlassTypography.headline1(),
                  h2: GlassTypography.headline2(),
                  h3: GlassTypography.headline3(),
                  p: GlassTypography.bodyLarge().copyWith(height: 1.8),
                ),
              ),
            ),
          ),
        ),
        const SizedBox(height: GlassSpacing.lg),

        // Action Buttons
        Padding(
          padding: const EdgeInsets.symmetric(
            horizontal: GlassSpacing.xl,
            vertical: GlassSpacing.lg,
          ),
          child: Row(
            children: [
              Expanded(
                child: GlassSecondaryButton(
                  label: 'New Draft',
                  icon: Icons.refresh_rounded,
                  onPressed: () => setState(() => _generatedContent = null),
                ),
              ),
              const SizedBox(width: GlassSpacing.lg),
              Expanded(
                child: GlassPrimaryButton(
                  label: 'Export',
                  icon: Icons.send_rounded,
                  onPressed: () {},
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}
