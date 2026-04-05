import 'dart:convert';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_markdown_plus/flutter_markdown_plus.dart';
import 'package:image_picker/image_picker.dart';
import '../../../../core/theme/glassmorphic/glass_components.dart';
import '../../data/worksheet_repository.dart';
import '../../../../core/providers/language_provider.dart';
import '../../../lesson_plan/presentation/widgets/voice_input_widget.dart';
import '../../../../components/tts_play_button.dart';
import '../../../../components/share_to_community_button.dart';

class WorksheetWizardScreen extends ConsumerStatefulWidget {
  final Map<String, dynamic>? initialParams;

  const WorksheetWizardScreen({super.key, this.initialParams});

  @override
  ConsumerState<WorksheetWizardScreen> createState() =>
      _WorksheetWizardScreenState();
}

class _WorksheetWizardScreenState extends ConsumerState<WorksheetWizardScreen> {
  final _topicController = TextEditingController();
  bool _isGenerating = false;
  String? _generatedWorksheet;

  // Image upload state
  File? _pickedImage;
  String? _imageDataUri;
  final _imagePicker = ImagePicker();

  @override
  void initState() {
    super.initState();
    // Pre-fill from VIDYA action cards or cross-feature navigation
    final params = widget.initialParams;
    if (params != null) {
      if (params['topic'] != null) {
        _topicController.text = params['topic'] as String;
      }
      if (params['gradeLevel'] != null) {
        final grade = params['gradeLevel'] as String;
        if (_grades.contains(grade)) _selectedGrade = grade;
      }
      if (params['board'] != null) {
        final board = params['board'] as String;
        if (_boards.contains(board)) _selectedBoard = board;
      }
    }
  }

  bool _includeAnswerKey = true;
  bool _vocabularyBank = false;

  String _selectedBoard = 'CBSE';
  String _selectedGrade = 'Class 8';

  final List<String> _boards = ['CBSE', 'ICSE', 'State Board', 'Cambridge'];
  final List<String> _grades = ['Class 1', 'Class 2', 'Class 3', 'Class 4', 'Class 5',
                                 'Class 6', 'Class 7', 'Class 8', 'Class 9', 'Class 10',
                                 'Class 11', 'Class 12'];

  final List<String> _questionTypes = ['MCQ', 'True/False', 'Short Answer', 'Fill in Blanks'];
  final Set<String> _selectedTypes = {'MCQ', 'Short Answer'};

  /// Pick an image from camera or gallery, compress, and convert to base64 data URI.
  Future<void> _pickImage(ImageSource source) async {
    try {
      final xFile = await _imagePicker.pickImage(
        source: source,
        maxWidth: 1024,
        imageQuality: 80,
      );
      if (xFile == null) return;

      final file = File(xFile.path);
      final bytes = await file.readAsBytes();
      final base64Str = base64Encode(bytes);

      // Determine MIME type from extension
      final ext = xFile.path.split('.').last.toLowerCase();
      final mime = ext == 'png' ? 'image/png' : 'image/jpeg';

      setState(() {
        _pickedImage = file;
        _imageDataUri = 'data:$mime;base64,$base64Str';
      });
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Failed to pick image: $e'),
            backgroundColor: Colors.red,
          ),
        );
      }
    }
  }

  void _removeImage() {
    setState(() {
      _pickedImage = null;
      _imageDataUri = null;
    });
  }

  Future<void> _generateWorksheet() async {
    if (_topicController.text.trim().isEmpty) return;

    setState(() => _isGenerating = true);

    try {
      final language = ref.read(languageProvider);
      final repo = ref.read(worksheetRepositoryProvider);

      final prompt = "Create a worksheet about '${_topicController.text}'. "
          "Include these question types: ${_selectedTypes.join(', ')}. "
          "${_includeAnswerKey ? 'Include an Answer Key at the end.' : ''}"
          "${_vocabularyBank ? 'Include a Vocabulary Bank section.' : ''}";

      final result = await repo.generate(
        prompt: prompt,
        gradeLevel: _selectedGrade,
        language: language,
        imageDataUri: _imageDataUri,
      );

      setState(() {
        _isGenerating = false;
        _generatedWorksheet = result.worksheetContent;
      });
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text("Error: $e"), backgroundColor: Colors.red));
        setState(() => _isGenerating = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return GlassScaffold(
      title: 'Worksheet Wizard',
      showBackButton: true,
      actions: [GlassMenuButton(onPressed: () {})],
      floatingActionButton: _generatedWorksheet == null
          ? GlassFloatingButton(
              label: 'Generate Worksheet',
              icon: Icons.auto_awesome,
              onPressed: _isGenerating ? null : _generateWorksheet,
              isLoading: _isGenerating,
            )
          : null,
      floatingActionButtonLocation: FloatingActionButtonLocation.centerFloat,
      body: _generatedWorksheet != null ? _buildResultView() : _buildInputForm(),
    );
  }

  Widget _buildInputForm() {
    return SingleChildScrollView(
          keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
      padding: const EdgeInsets.only(
        left: GlassSpacing.xl,
        right: GlassSpacing.xl,
        top: GlassSpacing.sm,
        bottom: 120, // Space for floating button
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Decorative Header
          Text(
            'Drafting New Worksheet...',
            style: GlassTypography.decorativeLabel(),
          ),
          const SizedBox(height: GlassSpacing.xs),
          Text(
            'The Notebook Layout',
            style: GlassTypography.headline1(),
          ),
          const SizedBox(height: GlassSpacing.sm),
          Container(
            width: 60,
            height: 2,
            color: GlassColors.textTertiary.withOpacity(0.3),
          ),
          const SizedBox(height: GlassSpacing.xxl),

          // Lesson Details Card
          GlassIconCard(
            icon: Icons.menu_book_rounded,
            iconColor: GlassColors.primary,
            title: 'Lesson Details',
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Topic Input
                GlassTextField(
                  controller: _topicController,
                  labelText: 'Topic or Chapter',
                  hintText: 'e.g. Mughal Architecture',
                  suffixIcon: VoiceInputWidget(
                    onResult: (val) => setState(() => _topicController.text = val),
                  ),
                ),
                const SizedBox(height: GlassSpacing.xl),

                // Image Upload Section
                _buildImageUploadSection(),
                const SizedBox(height: GlassSpacing.xl),

                // Board and Grade Row
                Row(
                  children: [
                    Expanded(
                      child: GlassDropdown<String>(
                        labelText: 'Board',
                        value: _selectedBoard,
                        items: _boards
                            .map((board) => DropdownMenuItem(
                                  value: board,
                                  child: Text(board),
                                ))
                            .toList(),
                        onChanged: (value) {
                          if (value != null) {
                            setState(() => _selectedBoard = value);
                          }
                        },
                      ),
                    ),
                    const SizedBox(width: GlassSpacing.lg),
                    Expanded(
                      child: GlassDropdown<String>(
                        labelText: 'Grade',
                        value: _selectedGrade,
                        items: _grades
                            .map((grade) => DropdownMenuItem(
                                  value: grade,
                                  child: Text(grade),
                                ))
                            .toList(),
                        onChanged: (value) {
                          if (value != null) {
                            setState(() => _selectedGrade = value);
                          }
                        },
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
          const SizedBox(height: GlassSpacing.xl),

          // Configuration Card
          GlassIconCard(
            icon: Icons.tune_rounded,
            iconColor: GlassColors.primary,
            title: 'Configuration',
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Answer Key Toggle
                GlassSwitch(
                  title: 'Include Answer Key',
                  description: 'Detailed solutions on final page',
                  value: _includeAnswerKey,
                  onChanged: (v) => setState(() => _includeAnswerKey = v),
                ),
                const SizedBox(height: GlassSpacing.lg),

                // Vocabulary Bank Toggle
                GlassSwitch(
                  title: 'Vocabulary Bank',
                  description: 'Glossary for difficult terms',
                  value: _vocabularyBank,
                  onChanged: (v) => setState(() => _vocabularyBank = v),
                ),
                const SizedBox(height: GlassSpacing.xl),

                // Question Types
                GlassChipGroup(
                  labelText: 'Question Types',
                  options: _questionTypes,
                  selectedOptions: _selectedTypes,
                  onToggle: (type) {
                    setState(() {
                      if (_selectedTypes.contains(type)) {
                        if (_selectedTypes.length > 1) {
                          _selectedTypes.remove(type);
                        }
                      } else {
                        _selectedTypes.add(type);
                      }
                    });
                  },
                ),
              ],
            ),
          ),
          const SizedBox(height: GlassSpacing.xl),

          // Preview Card
          const GlassPreviewCard(
            label: 'The Notebook Theme',
          ),
        ],
      ),
    );
  }

  /// Builds the image upload section with camera/gallery buttons and preview.
  Widget _buildImageUploadSection() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'Reference Image (optional)',
          style: GlassTypography.bodySmall().copyWith(
            color: GlassColors.textSecondary,
          ),
        ),
        const SizedBox(height: GlassSpacing.sm),

        if (_pickedImage != null) ...[
          // Image preview with remove button
          Stack(
            children: [
              GlassCard(
                padding: const EdgeInsets.all(GlassSpacing.sm),
                child: ClipRRect(
                  borderRadius: BorderRadius.circular(8),
                  child: Image.file(
                    _pickedImage!,
                    height: 160,
                    width: double.infinity,
                    fit: BoxFit.cover,
                  ),
                ),
              ),
              Positioned(
                top: GlassSpacing.sm,
                right: GlassSpacing.sm,
                child: GlassIconButton(
                  icon: Icons.close_rounded,
                  onPressed: _removeImage,
                ),
              ),
            ],
          ),
        ] else ...[
          // Camera and Gallery picker buttons
          Row(
            children: [
              Expanded(
                child: GlassCard(
                  padding: const EdgeInsets.all(GlassSpacing.md),
                  child: InkWell(
                    onTap: () => _pickImage(ImageSource.camera),
                    child: Column(
                      children: [
                        Icon(
                          Icons.camera_alt_rounded,
                          color: GlassColors.primary,
                          size: 28,
                        ),
                        const SizedBox(height: GlassSpacing.xs),
                        Text(
                          'Camera',
                          style: GlassTypography.bodySmall().copyWith(
                            color: GlassColors.textSecondary,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
              const SizedBox(width: GlassSpacing.md),
              Expanded(
                child: GlassCard(
                  padding: const EdgeInsets.all(GlassSpacing.md),
                  child: InkWell(
                    onTap: () => _pickImage(ImageSource.gallery),
                    child: Column(
                      children: [
                        Icon(
                          Icons.photo_library_rounded,
                          color: GlassColors.primary,
                          size: 28,
                        ),
                        const SizedBox(height: GlassSpacing.xs),
                        Text(
                          'Gallery',
                          style: GlassTypography.bodySmall().copyWith(
                            color: GlassColors.textSecondary,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ],
          ),
        ],
      ],
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
                onPressed: () => setState(() => _generatedWorksheet = null),
              ),
              const Spacer(),
              TTSPlayButton(text: _generatedWorksheet!),
              const SizedBox(width: GlassSpacing.sm),
              GlassIconButton(
                icon: Icons.print_rounded,
                onPressed: () {},
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

        // Generated Content
        Expanded(
          child: SingleChildScrollView(
          keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
            padding: const EdgeInsets.symmetric(horizontal: GlassSpacing.xl),
            child: GlassCard(
              padding: const EdgeInsets.all(GlassSpacing.xxl),
              child: MarkdownBody(
                data: _generatedWorksheet!,
                styleSheet: MarkdownStyleSheet(
                  h1: GlassTypography.headline1(),
                  h2: GlassTypography.headline2(),
                  h3: GlassTypography.headline3(),
                  p: GlassTypography.bodyLarge(),
                ),
              ),
            ),
          ),
        ),
        const SizedBox(height: GlassSpacing.md),

        // Share to Community
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: GlassSpacing.xl),
          child: ShareToCommunityButton(
            type: 'worksheet',
            title: _topicController.text.isNotEmpty
                ? 'Worksheet: ${_topicController.text}'
                : 'Generated Worksheet',
            data: {'content': _generatedWorksheet},
          ),
        ),
        const SizedBox(height: GlassSpacing.md),

        // Regenerate Button
        Padding(
          padding: const EdgeInsets.symmetric(
            horizontal: GlassSpacing.xl,
            vertical: GlassSpacing.lg,
          ),
          child: GlassPrimaryButton(
            label: 'Regenerate',
            icon: Icons.refresh_rounded,
            onPressed: _generateWorksheet,
            isLoading: _isGenerating,
          ),
        ),
      ],
    );
  }
}
