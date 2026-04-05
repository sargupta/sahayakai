import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:share_plus/share_plus.dart';

import 'package:pdf/pdf.dart';
import 'package:pdf/widgets.dart' as pw;
import 'package:printing/printing.dart';

import '../../../../components/tts_play_button.dart';
import '../../../../components/share_to_community_button.dart';
import '../../../../core/theme/glassmorphic/glass_components.dart';
import '../../domain/exam_paper_models.dart';
import '../providers/exam_paper_provider.dart';

class ExamPaperResultScreen extends ConsumerStatefulWidget {
  const ExamPaperResultScreen({super.key});

  @override
  ConsumerState<ExamPaperResultScreen> createState() =>
      _ExamPaperResultScreenState();
}

class _ExamPaperResultScreenState
    extends ConsumerState<ExamPaperResultScreen> {
  bool _answerKeyExpanded = false;
  bool _markingExpanded = false;
  bool _instructionsExpanded = false;
  bool _isSaving = false;

  String _buildFullText(ExamPaperOutput paper) {
    final buf = StringBuffer();
    buf.writeln(paper.title);
    buf.writeln('${paper.board} | ${paper.gradeLevel} | ${paper.subject}');
    buf.writeln('Duration: ${paper.duration} | Max Marks: ${paper.maxMarks}');
    buf.writeln();
    for (final section in paper.sections) {
      buf.writeln('${section.name}: ${section.label}');
      for (var i = 0; i < section.questions.length; i++) {
        final q = section.questions[i];
        buf.writeln('${i + 1}. ${q.text} [${q.marks} marks]');
        if (q.options != null) {
          for (var j = 0; j < q.options!.length; j++) {
            buf.writeln('   ${String.fromCharCode(65 + j)}) ${q.options![j]}');
          }
        }
      }
      buf.writeln();
    }
    return buf.toString();
  }

  Future<void> _saveToLibrary(ExamPaperOutput paper) async {
    setState(() => _isSaving = true);
    final contentId = await ref
        .read(examPaperControllerProvider.notifier)
        .saveToLibrary(paper);
    setState(() => _isSaving = false);
    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(contentId != null
              ? 'Saved to library!'
              : 'Could not save. Please check your connection.'),
          duration: const Duration(seconds: 3),
        ),
      );
    }
  }

  Future<void> _exportPdf(ExamPaperOutput paper) async {
    final text = _buildFullText(paper);
    final pdfDoc = pw.Document();
    pdfDoc.addPage(
      pw.MultiPage(
        pageFormat: PdfPageFormat.a4,
        build: (_) => [
          pw.Text(
            paper.title,
            style: pw.TextStyle(
                fontSize: 18, fontWeight: pw.FontWeight.bold),
          ),
          pw.SizedBox(height: 8),
          pw.Text(
            '${paper.board} | ${paper.gradeLevel} | ${paper.subject}',
            style: const pw.TextStyle(fontSize: 12, color: PdfColors.grey700),
          ),
          pw.Text(
            'Duration: ${paper.duration}   Max Marks: ${paper.maxMarks}',
            style: const pw.TextStyle(fontSize: 12, color: PdfColors.grey700),
          ),
          pw.Divider(),
          pw.SizedBox(height: 8),
          pw.Text(text, style: const pw.TextStyle(fontSize: 11)),
        ],
      ),
    );
    await Printing.layoutPdf(
      onLayout: (_) async => pdfDoc.save(),
      name: '${paper.title.replaceAll(' ', '_')}.pdf',
    );
  }

  @override
  Widget build(BuildContext context) {
    final paper = ref.watch(examPaperResultProvider);

    if (paper == null) {
      return Scaffold(
        backgroundColor: const Color(0xFF1A0A2E),
        body: SafeArea(
          child: Column(
            children: [
              _buildAppBar(context, null),
              const Expanded(
                child: Center(
                  child: Text(
                    'No paper generated yet.',
                    style: TextStyle(color: Colors.white60),
                  ),
                ),
              ),
            ],
          ),
        ),
      );
    }

    return Scaffold(
      backgroundColor: const Color(0xFF1A0A2E),
      body: SafeArea(
        child: Column(
          children: [
            _buildAppBar(context, paper),
            Expanded(
              child: ListView(
                padding: const EdgeInsets.all(GlassSpacing.lg),
                children: [
                  _buildPaperHeader(paper),
                  const SizedBox(height: GlassSpacing.lg),
                  _buildInstructionsCard(paper),
                  const SizedBox(height: GlassSpacing.lg),
                  ...paper.sections.map((s) => _buildSectionCard(s)),
                  if (paper.blueprintSummary != null) ...[
                    const SizedBox(height: GlassSpacing.lg),
                    _buildBlueprintCard(paper.blueprintSummary!),
                  ],
                  if (paper.pyqSources != null &&
                      paper.pyqSources!.isNotEmpty) ...[
                    const SizedBox(height: GlassSpacing.lg),
                    _buildPYQSourcesCard(paper.pyqSources!),
                  ],
                  const SizedBox(height: 80),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  // ─── AppBar ───

  Widget _buildAppBar(BuildContext context, ExamPaperOutput? paper) {
    return Container(
      padding: const EdgeInsets.symmetric(
          horizontal: GlassSpacing.md, vertical: GlassSpacing.sm),
      child: Row(
        children: [
          IconButton(
            icon: const Icon(Icons.arrow_back_ios_new_rounded,
                color: Colors.white70),
            onPressed: () {
              ref.read(examPaperControllerProvider.notifier).clearResult();
              context.pop();
            },
          ),
          Expanded(
            child: Text(
              paper?.title ?? 'Exam Paper',
              style: GlassTypography.headline3()
                  .copyWith(color: Colors.white),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
          ),
          if (paper != null) ...[
            TTSPlayButton(text: _buildFullText(paper)),
            ShareToCommunityButton(
              type: 'exam-paper',
              title: paper.title,
              data: {
                'title': paper.title,
                'board': paper.board,
                'gradeLevel': paper.gradeLevel,
                'subject': paper.subject,
                'duration': paper.duration,
                'maxMarks': paper.maxMarks,
              },
              gradeLevel: paper.gradeLevel,
              subject: paper.subject,
            ),
            PopupMenuButton<String>(
              icon: const Icon(Icons.more_vert, color: Colors.white70),
              color: const Color(0xFF2D1B5E),
              onSelected: (value) {
                if (value == 'share') {
                  Share.share(_buildFullText(paper));
                } else if (value == 'pdf') {
                  _exportPdf(paper);
                } else if (value == 'save') {
                  _saveToLibrary(paper);
                }
              },
              itemBuilder: (_) => [
                PopupMenuItem(
                  value: 'save',
                  child: Row(children: [
                    if (_isSaving)
                      const SizedBox(
                          width: 16,
                          height: 16,
                          child: CircularProgressIndicator(strokeWidth: 2))
                    else
                      const Icon(Icons.bookmark_add_outlined,
                          size: 18, color: Colors.white70),
                    const SizedBox(width: 8),
                    const Text('Save to Library',
                        style: TextStyle(color: Colors.white70)),
                  ]),
                ),
                const PopupMenuItem(
                  value: 'pdf',
                  child: Row(children: [
                    Icon(Icons.picture_as_pdf_outlined,
                        size: 18, color: Colors.white70),
                    SizedBox(width: 8),
                    Text('Export PDF',
                        style: TextStyle(color: Colors.white70)),
                  ]),
                ),
                const PopupMenuItem(
                  value: 'share',
                  child: Row(children: [
                    Icon(Icons.share_outlined,
                        size: 18, color: Colors.white70),
                    SizedBox(width: 8),
                    Text('Share', style: TextStyle(color: Colors.white70)),
                  ]),
                ),
              ],
            ),
          ],
        ],
      ),
    );
  }

  // ─── Paper Header ───

  Widget _buildPaperHeader(ExamPaperOutput paper) {
    return Container(
      padding: const EdgeInsets.all(GlassSpacing.lg),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [Color(0xFF6A0DAD), Color(0xFF2D1B5E)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(16),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            paper.title,
            style: GoogleFonts.outfit(
              fontSize: 18,
              fontWeight: FontWeight.w700,
              color: Colors.white,
            ),
          ),
          const SizedBox(height: 8),
          _buildMetaRow(Icons.school_rounded, paper.board),
          _buildMetaRow(Icons.grade_rounded, '${paper.gradeLevel} — ${paper.subject}'),
          _buildMetaRow(Icons.timer_rounded, 'Duration: ${paper.duration}'),
          _buildMetaRow(Icons.star_rounded, 'Max Marks: ${paper.maxMarks}'),
        ],
      ),
    );
  }

  Widget _buildMetaRow(IconData icon, String text) {
    return Padding(
      padding: const EdgeInsets.only(top: 4),
      child: Row(
        children: [
          Icon(icon, size: 14, color: Colors.white60),
          const SizedBox(width: 6),
          Expanded(
            child: Text(
              text,
              style: GoogleFonts.outfit(
                  fontSize: 13, color: const Color(0xCCFFFFFF)),
            ),
          ),
        ],
      ),
    );
  }

  // ─── General Instructions ───

  Widget _buildInstructionsCard(ExamPaperOutput paper) {
    if (paper.generalInstructions.isEmpty) return const SizedBox.shrink();
    return _buildExpandableCard(
      title: 'General Instructions',
      icon: Icons.info_outline_rounded,
      isExpanded: _instructionsExpanded,
      onTap: () =>
          setState(() => _instructionsExpanded = !_instructionsExpanded),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: paper.generalInstructions
            .asMap()
            .entries
            .map((e) => Padding(
                  padding: const EdgeInsets.only(bottom: 6),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('${e.key + 1}. ',
                          style: const TextStyle(
                              color: Colors.white60, fontSize: 13)),
                      Expanded(
                        child: Text(
                          e.value,
                          style: const TextStyle(
                              color: Color(0xDEFFFFFF), fontSize: 13),
                        ),
                      ),
                    ],
                  ),
                ))
            .toList(),
      ),
    );
  }

  // ─── Section Card ───

  Widget _buildSectionCard(ExamSection section) {
    return Padding(
      padding: const EdgeInsets.only(bottom: GlassSpacing.md),
      child: Container(
        decoration: BoxDecoration(
          color: Colors.white.withOpacity(0.05),
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: Colors.white.withOpacity(0.1)),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Section header
            Container(
              padding: const EdgeInsets.all(GlassSpacing.md),
              decoration: BoxDecoration(
                color: const Color(0xFF6A0DAD).withOpacity(0.3),
                borderRadius: const BorderRadius.vertical(
                    top: Radius.circular(16)),
              ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          section.name,
                          style: GoogleFonts.outfit(
                            fontSize: 14,
                            fontWeight: FontWeight.w700,
                            color: const Color(0xFFCE93D8),
                            letterSpacing: 1,
                          ),
                        ),
                        Text(
                          section.label,
                          style: GoogleFonts.outfit(
                              fontSize: 12, color: Colors.white60),
                        ),
                      ],
                    ),
                  ),
                  Container(
                    padding:
                        const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                    decoration: BoxDecoration(
                      color: const Color(0xFF6A0DAD).withOpacity(0.5),
                      borderRadius: BorderRadius.circular(20),
                    ),
                    child: Text(
                      '${section.totalMarks} marks',
                      style: GoogleFonts.outfit(
                          fontSize: 12,
                          fontWeight: FontWeight.w600,
                          color: Colors.white),
                    ),
                  ),
                ],
              ),
            ),
            // Questions
            ...section.questions.asMap().entries.map(
                  (e) => _buildQuestionTile(e.key + 1, e.value),
                ),
          ],
        ),
      ),
    );
  }

  Widget _buildQuestionTile(int number, ExamQuestion question) {
    return Padding(
      padding: const EdgeInsets.all(GlassSpacing.md),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                width: 24,
                height: 24,
                alignment: Alignment.center,
                decoration: BoxDecoration(
                  color: const Color(0xFF6A0DAD).withOpacity(0.4),
                  shape: BoxShape.circle,
                ),
                child: Text(
                  '$number',
                  style: GoogleFonts.outfit(
                      fontSize: 11,
                      fontWeight: FontWeight.w700,
                      color: Colors.white),
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Expanded(
                          child: Text(
                            question.text,
                            style: GoogleFonts.outfit(
                                fontSize: 14, color: Colors.white70),
                          ),
                        ),
                        const SizedBox(width: 8),
                        Text(
                          '[${question.marks}]',
                          style: GoogleFonts.outfit(
                              fontSize: 12,
                              color: const Color(0xFFCE93D8),
                              fontWeight: FontWeight.w600),
                        ),
                      ],
                    ),
                    if (question.options != null &&
                        question.options!.isNotEmpty) ...[
                      const SizedBox(height: 6),
                      ...question.options!.asMap().entries.map(
                            (opt) => Padding(
                              padding: const EdgeInsets.only(top: 3),
                              child: Text(
                                '${String.fromCharCode(65 + opt.key)}) ${opt.value}',
                                style: GoogleFonts.outfit(
                                    fontSize: 13,
                                    color: Colors.white60),
                              ),
                            ),
                          ),
                    ],
                    // Answer (shown if present and answer key expanded)
                    if (_answerKeyExpanded &&
                        question.answer != null &&
                        question.answer!.isNotEmpty) ...[
                      const SizedBox(height: 6),
                      Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 10, vertical: 4),
                        decoration: BoxDecoration(
                          color: Colors.green.withOpacity(0.15),
                          borderRadius: BorderRadius.circular(8),
                          border: Border.all(
                              color: Colors.green.withOpacity(0.3)),
                        ),
                        child: Text(
                          'Answer: ${question.answer}',
                          style: GoogleFonts.outfit(
                              fontSize: 12, color: Colors.green[300]),
                        ),
                      ),
                    ],
                  ],
                ),
              ),
            ],
          ),
          if (number <
              (question.solution != null ? 999 : 999)) // separator
            Divider(
                color: Colors.white.withOpacity(0.07), height: 16),
        ],
      ),
    );
  }

  // ─── Blueprint Summary ───

  Widget _buildBlueprintCard(BlueprintSummary summary) {
    return _buildExpandableCard(
      title: 'Blueprint Summary',
      icon: Icons.pie_chart_outline_rounded,
      isExpanded: _markingExpanded,
      onTap: () => setState(() => _markingExpanded = !_markingExpanded),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (summary.chapterWise.isNotEmpty) ...[
            _buildSubheading('Chapter-wise Distribution'),
            ...summary.chapterWise.entries.map(
              (e) => _buildDistributionRow(e.key, e.value),
            ),
            const SizedBox(height: 8),
          ],
          if (summary.difficultyWise.isNotEmpty) ...[
            _buildSubheading('Difficulty Distribution'),
            ...summary.difficultyWise.entries.map(
              (e) => _buildDistributionRow(e.key, e.value),
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildPYQSourcesCard(List<PYQSource> sources) {
    return Container(
      padding: const EdgeInsets.all(GlassSpacing.md),
      decoration: BoxDecoration(
        color: Colors.white.withOpacity(0.04),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: Colors.white.withOpacity(0.08)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(children: [
            const Icon(Icons.history_edu_rounded,
                size: 16, color: Color(0xFFCE93D8)),
            const SizedBox(width: 6),
            Text(
              'Based on Past Year Questions',
              style: GoogleFonts.outfit(
                  fontSize: 13,
                  fontWeight: FontWeight.w600,
                  color: const Color(0xFFCE93D8)),
            ),
          ]),
          const SizedBox(height: 8),
          ...sources.map(
            (s) => Padding(
              padding: const EdgeInsets.only(bottom: 4),
              child: Text(
                '• ${s.year} — ${s.chapter}',
                style: GoogleFonts.outfit(
                    fontSize: 12, color: Colors.white54),
              ),
            ),
          ),
        ],
      ),
    );
  }

  // ─── Helpers ───

  Widget _buildExpandableCard({
    required String title,
    required IconData icon,
    required bool isExpanded,
    required VoidCallback onTap,
    required Widget child,
  }) {
    return Container(
      decoration: BoxDecoration(
        color: Colors.white.withOpacity(0.05),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: Colors.white.withOpacity(0.1)),
      ),
      child: Column(
        children: [
          InkWell(
            onTap: onTap,
            borderRadius: BorderRadius.circular(12),
            child: Padding(
              padding: const EdgeInsets.all(GlassSpacing.md),
              child: Row(
                children: [
                  Icon(icon, size: 18, color: const Color(0xFFCE93D8)),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      title,
                      style: GoogleFonts.outfit(
                        fontSize: 14,
                        fontWeight: FontWeight.w600,
                        color: Colors.white,
                      ),
                    ),
                  ),
                  Icon(
                    isExpanded
                        ? Icons.keyboard_arrow_up_rounded
                        : Icons.keyboard_arrow_down_rounded,
                    color: Colors.white54,
                  ),
                ],
              ),
            ),
          ),
          if (isExpanded)
            Padding(
              padding: const EdgeInsets.fromLTRB(
                  GlassSpacing.md, 0, GlassSpacing.md, GlassSpacing.md),
              child: child,
            ),
        ],
      ),
    );
  }

  Widget _buildSubheading(String text) => Padding(
        padding: const EdgeInsets.only(bottom: 4),
        child: Text(
          text,
          style: GoogleFonts.outfit(
              fontSize: 12,
              fontWeight: FontWeight.w600,
              color: Colors.white54,
              letterSpacing: 0.5),
        ),
      );

  Widget _buildDistributionRow(String label, int marks) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 4),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Expanded(
            child: Text(label,
                style: const TextStyle(fontSize: 13, color: Colors.white70)),
          ),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
            decoration: BoxDecoration(
              color: const Color(0xFF6A0DAD).withOpacity(0.3),
              borderRadius: BorderRadius.circular(8),
            ),
            child: Text(
              '$marks marks',
              style: GoogleFonts.outfit(
                  fontSize: 11,
                  fontWeight: FontWeight.w600,
                  color: const Color(0xFFCE93D8)),
            ),
          ),
        ],
      ),
    );
  }
}
