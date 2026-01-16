import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:sahayakai_mobile/src/core/theme/extensions/sahayak_theme.dart';

class ProfileScreen extends StatelessWidget {
  const ProfileScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text("My Profile", style: GoogleFonts.outfit(fontWeight: FontWeight.bold, color: Colors.black)),
        backgroundColor: Colors.white,
        elevation: 0,
        actions: [
          IconButton(onPressed: () {}, icon: const Icon(Icons.settings, color: Colors.black))
        ],
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(24),
        child: Column(
          children: [
            const CircleAvatar(
              radius: 50,
              backgroundColor: Colors.orange,
              backgroundImage: NetworkImage('https://i.pravatar.cc/300?img=12'),
            ),
            const SizedBox(height: 16),
            Text("Sarthak Gupta", style: GoogleFonts.outfit(fontSize: 24, fontWeight: FontWeight.bold)),
            Text("Teacher • Grade 6-10", style: GoogleFonts.inter(color: Colors.grey, fontSize: 16)),
            const SizedBox(height: 32),

            // Use Impact Dashboard as a widget or just stats
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(16),
                boxShadow: const [BoxShadow(color: Colors.black12, blurRadius: 4, offset:Offset(0, 2))],
              ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceAround,
                 children: [
                   _buildStat(context, "128", "Lessons"),
                   _buildStat(context, "1.2k", "Students"),
                   _buildStat(context, "45", "Hours Saved"),
                 ],
              ),
            ),
            const SizedBox(height: 32),

            // Settings List
            _buildSettingItem(Icons.person_outline, "Edit Profile"),
            _buildSettingItem(Icons.notifications_outlined, "Notifications"),
            _buildSettingItem(Icons.language, "App Language"),
            _buildSettingItem(Icons.help_outline, "Help & Support"),
            const SizedBox(height: 32),
            
            OutlinedButton(
              onPressed: () {},
              style: OutlinedButton.styleFrom(
                foregroundColor: Colors.red,
                side: const BorderSide(color: Colors.red),
                padding: const EdgeInsets.symmetric(horizontal: 48, vertical: 12),
              ),
              child: const Text("Log Out"),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildStat(BuildContext context, String value, String label) {
    final theme = Theme.of(context).extension<SahayakTheme>()!;
    return Column(
      children: [
        Text(value, style: GoogleFonts.outfit(fontSize: 24, fontWeight: FontWeight.bold, color: theme.primary)),
        Text(label, style: GoogleFonts.inter(color: Colors.grey, fontSize: 12)),
      ],
    );
  }

  Widget _buildSettingItem(IconData icon, String title) {
    return ListTile(
      leading: Container(
        padding: const EdgeInsets.all(8),
        decoration: BoxDecoration(color: Colors.grey.shade100, borderRadius: BorderRadius.circular(8)),
        child: Icon(icon, color: Colors.black87),
      ),
      title: Text(title, style: GoogleFonts.inter(fontWeight: FontWeight.w600)),
      trailing: const Icon(Icons.arrow_forward_ios, size: 16, color: Colors.grey),
      onTap: () {},
    );
  }
}
