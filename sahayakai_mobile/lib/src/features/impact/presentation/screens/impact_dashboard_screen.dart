import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:fl_chart/fl_chart.dart'; // Ensure this dependency adds to pubspec if not already

class ImpactDashboardScreen extends StatelessWidget {
  const ImpactDashboardScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text("Impact Dashboard", style: GoogleFonts.outfit(fontWeight: FontWeight.bold, color: Colors.black)),
        backgroundColor: Colors.white,
        elevation: 0,
        iconTheme: const IconThemeData(color: Colors.black),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // Summary Cards
            Row(
              children: [
                Expanded(child: _buildMetricCard("Lessons", "134", Icons.book, Colors.blue)),
                const SizedBox(width: 12),
                Expanded(child: _buildMetricCard("Students", "1.2k", Icons.people, Colors.orange)),
              ],
            ),
            const SizedBox(height: 12),
            Row(
              children: [
                Expanded(child: _buildMetricCard("Hours Saved", "56", Icons.schedule, Colors.purple)),
                const SizedBox(width: 12),
                Expanded(child: _buildMetricCard("Engagement", "88%", Icons.trending_up, Colors.green)),
              ],
            ),
            const SizedBox(height: 32),

            // Mock Chart: Weekly Lesson Creation
            Text("Weekly Activity", style: GoogleFonts.outfit(fontSize: 20, fontWeight: FontWeight.bold)),
             const SizedBox(height: 16),
            Container(
              height: 200,
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(16),
                boxShadow: const [BoxShadow(color: Colors.black12, blurRadius: 4)],
              ),
              child: BarChart(
                BarChartData(
                  alignment: BarChartAlignment.spaceAround,
                  maxY: 10,
                  titlesData: FlTitlesData(
                    show: true,
                    bottomTitles: AxisTitles(
                      sideTitles: SideTitles(
                        showTitles: true,
                        getTitlesWidget: (val, meta) {
                          const days = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
                          if (val.toInt() >= 0 && val.toInt() < days.length) {
                             return Text(days[val.toInt()], style: GoogleFonts.inter(fontSize: 12));
                          }
                          return const Text('');
                        },
                      ),
                    ),
                    leftTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
                    topTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
                    rightTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
                  ),
                  gridData: const FlGridData(show: false),
                  borderData: FlBorderData(show: false),
                  barGroups: [
                    _makeGroupData(0, 5, Colors.blue),
                    _makeGroupData(1, 8, Colors.blue),
                    _makeGroupData(2, 6, Colors.blue),
                    _makeGroupData(3, 4, Colors.blue),
                    _makeGroupData(4, 9, Colors.orange),
                    _makeGroupData(5, 3, Colors.blue),
                    _makeGroupData(6, 2, Colors.blue),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 32),
            
            // Recent Milestones
             Text("Recent Milestones", style: GoogleFonts.outfit(fontSize: 20, fontWeight: FontWeight.bold)),
             const SizedBox(height: 16),
             _buildMilestone("Created 100th Lesson Plan", "Yesterday", Icons.emoji_events, Colors.amber),
             _buildMilestone("Reached 1000 Students", "Last Week", Icons.star, Colors.purple),
          ],
        ),
      ),
    );
  }
  
  BarChartGroupData _makeGroupData(int x, double y, Color color) {
    return BarChartGroupData(
      x: x,
      barRods: [
        BarChartRodData(toY: y, color: color, width: 16, borderRadius: BorderRadius.circular(4)),
      ],
    );
  }

  Widget _buildMetricCard(String label, String value, IconData icon, Color color) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          BoxShadow(color: Colors.black.withOpacity(0.05), blurRadius: 8, offset: const Offset(0, 2)),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(color: color.withOpacity(0.1), shape: BoxShape.circle),
            child: Icon(icon, color: color, size: 20),
          ),
          const SizedBox(height: 12),
          Text(value, style: GoogleFonts.outfit(fontSize: 24, fontWeight: FontWeight.bold)),
          Text(label, style: GoogleFonts.inter(color: Colors.grey, fontSize: 13)),
        ],
      ),
    );
  }
  
  Widget _buildMilestone(String title, String date, IconData icon, Color color) {
    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      child: ListTile(
        leading: Container(
          padding: const EdgeInsets.all(8),
          decoration: BoxDecoration(color: color.withOpacity(0.1), shape: BoxShape.circle),
          child: Icon(icon, color: color),
        ),
        title: Text(title, style: GoogleFonts.inter(fontWeight: FontWeight.w600)),
        subtitle: Text(date, style: GoogleFonts.inter(fontSize: 12)),
      ),
    );
  }
}
