
import 'package:pdf/pdf.dart';
import 'package:pdf/widgets.dart' as pw;
import 'package:printing/printing.dart';
import 'package:sahayakai_mobile/src/features/lesson_plan/domain/lesson_plan_models.dart';

// Alias models to avoid naming conflicts with PDF widgets if any, 
// though Activity is distinct enough.
typedef LessonActivity = Activity;

class PdfGeneratorService {
  Future<void> generateLessonPlanPdf(LessonPlanOutput plan) async {
    final pdf = pw.Document();

    // Load fonts or use default
    final font = await PdfGoogleFonts.interRegular();
    final boldFont = await PdfGoogleFonts.interBold();

    pdf.addPage(
      pw.MultiPage(
        pageFormat: PdfPageFormat.a4,
        theme: pw.ThemeData.withFont(
          base: font,
          bold: boldFont,
        ),
        build: (pw.Context context) {
          return [
            _buildHeader(plan),
            pw.SizedBox(height: 20),
            _buildSectionTitle("Objectives"),
            pw.Text(plan.objectives.join('\n• ')), // Fixed List<String> -> String
            pw.SizedBox(height: 10),
            _buildSectionTitle("Materials Needed"),
            pw.Text(plan.materials.join('\n• ')), // Fixed List<String> -> String
            pw.SizedBox(height: 10),
            _buildSectionTitle("Activities"),
            ...plan.activities.map((activity) => _buildActivityItem(activity)),
            pw.SizedBox(height: 10),
            _buildSectionTitle("Assessment"),
            pw.Text(plan.assessment),
          ];
        },
      ),
    );

    // Save/Share
    await Printing.layoutPdf(
      onLayout: (PdfPageFormat format) async => pdf.save(),
      name: 'Lesson_Plan_${plan.title.replaceAll(' ', '_')}.pdf',
    );
  }

  pw.Widget _buildHeader(LessonPlanOutput plan) {
    return pw.Column(
      crossAxisAlignment: pw.CrossAxisAlignment.start,
      children: [
        pw.Text(plan.title, style: pw.TextStyle(fontSize: 24, fontWeight: pw.FontWeight.bold)),
        pw.SizedBox(height: 5),
        pw.Row(
          mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
          children: [
            pw.Text("${plan.subject} • ${plan.gradeLevel}", style: const pw.TextStyle(fontSize: 14, color: PdfColors.grey700)),
            pw.Text("Duration: ${plan.duration}", style: const pw.TextStyle(fontSize: 14, color: PdfColors.grey700)),
          ],
        ),
        pw.Divider(),
      ],
    );
  }

  pw.Widget _buildSectionTitle(String title) {
    return pw.Padding(
      padding: const pw.EdgeInsets.only(bottom: 5),
      child: pw.Text(
        title,
        style: pw.TextStyle(fontSize: 18, fontWeight: pw.FontWeight.bold, color: PdfColors.deepPurple700),
      ),
    );
  }

  pw.Widget _buildActivityItem(LessonActivity activity) {
    return pw.Container(
      margin: const pw.EdgeInsets.only(bottom: 8),
      padding: const pw.EdgeInsets.all(10),
      decoration: pw.BoxDecoration(
        border: pw.Border.all(color: PdfColors.grey300),
        borderRadius: const pw.BorderRadius.all(pw.Radius.circular(4)),
      ),
      child: pw.Column(
        crossAxisAlignment: pw.CrossAxisAlignment.start,
        children: [
          pw.Row(
            mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
            children: [
              pw.Text(activity.name, style: pw.TextStyle(fontWeight: pw.FontWeight.bold)),
              pw.Text(activity.duration, style: const pw.TextStyle(fontSize: 10, color: PdfColors.grey600)),
            ],
          ),
          pw.SizedBox(height: 4),
          pw.Text(activity.description, style: const pw.TextStyle(fontSize: 12)),
        ],
      ),
    );
  }
}
