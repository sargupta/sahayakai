import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../../../core/theme/app_theme.dart';

class ReviewItem {
  final String title;
  final String author;
  final String type;
  final DateTime date;

  ReviewItem({required this.title, required this.author, required this.type, required this.date});
}

class ReviewPanelScreen extends StatefulWidget {
  const ReviewPanelScreen({super.key});

  @override
  State<ReviewPanelScreen> createState() => _ReviewPanelScreenState();
}

class _ReviewPanelScreenState extends State<ReviewPanelScreen> {
  final List<ReviewItem> _pendingItems = [
    ReviewItem(title: "Solar System Quiz", author: "Ravi Kumar", type: "Quiz", date: DateTime.now().subtract(const Duration(hours: 2))),
    ReviewItem(title: "Algebra Basics Worksheet", author: "Priya Singh", type: "Worksheet", date: DateTime.now().subtract(const Duration(hours: 5))),
    ReviewItem(title: "History of Indua", author: "Amit Patel", type: "Lesson Plan", date: DateTime.now().subtract(const Duration(days: 1))),
  ];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text("Admin Review Panel", style: GoogleFonts.outfit(fontWeight: FontWeight.bold, color: Colors.black)),
        backgroundColor: Colors.white,
        elevation: 0,
        iconTheme: const IconThemeData(color: Colors.black),
      ),
      body: _pendingItems.isEmpty 
        ? Center(child: Text("No pending items", style: GoogleFonts.inter(color: Colors.grey)))
        : ListView.builder(
            padding: const EdgeInsets.all(16),
            itemCount: _pendingItems.length,
            itemBuilder: (context, index) {
              final item = _pendingItems[index];
              return Card(
                margin: const EdgeInsets.only(bottom: 12),
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                            decoration: BoxDecoration(color: Colors.blue.shade50, borderRadius: BorderRadius.circular(4)),
                            child: Text(item.type, style: GoogleFonts.inter(fontSize: 12, color: Colors.blue)),
                          ),
                          const Spacer(),
                          Text("${item.date.hour}:${item.date.minute}", style: GoogleFonts.inter(fontSize: 12, color: Colors.grey)),
                        ],
                      ),
                      const SizedBox(height: 8),
                      Text(item.title, style: GoogleFonts.inter(fontWeight: FontWeight.bold, fontSize: 16)),
                      Text("by ${item.author}", style: GoogleFonts.inter(color: Colors.grey, fontSize: 14)),
                      const SizedBox(height: 16),
                      Row(
                        children: [
                          Expanded(
                            child: OutlinedButton(
                              onPressed: () => _handleAction(index, "Rejected"),
                              style: OutlinedButton.styleFrom(foregroundColor: Colors.red),
                              child: const Text("Reject"),
                            ),
                          ),
                          const SizedBox(width: 16),
                          Expanded(
                            child: ElevatedButton(
                              onPressed: () => _handleAction(index, "Approved"),
                              style: ElevatedButton.styleFrom(backgroundColor: Colors.green),
                              child: const Text("Approve"),
                            ),
                          ),
                        ],
                      )
                    ],
                  ),
                ),
              );
            },
        ),
    );
  }

  void _handleAction(int index, String action) {
    setState(() {
      _pendingItems.removeAt(index);
    });
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text("Item $action")));
  }
}
