import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../../../core/theme/app_theme.dart';

class VirtualFieldTripScreen extends StatefulWidget {
  const VirtualFieldTripScreen({super.key});

  @override
  State<VirtualFieldTripScreen> createState() => _VirtualFieldTripScreenState();
}

class _VirtualFieldTripScreenState extends State<VirtualFieldTripScreen> {
  String _selectedDestination = "Taj Mahal, India";
  bool _isLoading = false;
  String? _currentImage;

  final Map<String, String> _destinations = {
    "Taj Mahal, India": "https://images.unsplash.com/photo-1564507592333-c60657eea523?ixlib=rb-1.2.1&auto=format&fit=crop&w=1000&q=80",
    "Great Wall of China": "https://images.unsplash.com/photo-1508804185872-d7badad00f7d?ixlib=rb-1.2.1&auto=format&fit=crop&w=1000&q=80",
    "Pyramids of Giza, Egypt": "https://images.unsplash.com/photo-1503177119275-0aa32b3a9368?ixlib=rb-1.2.1&auto=format&fit=crop&w=1000&q=80",
    "Eiffel Tower, Paris": "https://images.unsplash.com/photo-1511739001486-91d17730e182?ixlib=rb-1.2.1&auto=format&fit=crop&w=1000&q=80",
    "Machu Picchu, Peru": "https://images.unsplash.com/photo-1526392060635-9d6019884377?ixlib=rb-1.2.1&auto=format&fit=crop&w=1000&q=80",
  };

  @override
  void initState() {
    super.initState();
    _currentImage = _destinations[_selectedDestination];
  }

  void _changeDestination(String? newValue) async {
    if (newValue == null) return;
    setState(() {
      _selectedDestination = newValue;
      _isLoading = true;
    });
    
    // Simulate network load
    await Future.delayed(const Duration(seconds: 1));
    
    setState(() {
      _currentImage = _destinations[newValue];
      _isLoading = false;
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text("Virtual Field Trip", style: GoogleFonts.outfit(fontWeight: FontWeight.bold, color: Colors.black)),
        backgroundColor: Colors.white,
        elevation: 0,
        iconTheme: const IconThemeData(color: Colors.black),
      ),
      body: Column(
        children: [
          // 1. Controls
          Container(
            padding: const EdgeInsets.all(16),
            color: Colors.white,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Text("Select Destination", style: GoogleFonts.inter(fontWeight: FontWeight.w600)),
                const SizedBox(height: 8),
                DropdownButtonFormField<String>(
                  value: _selectedDestination,
                  items: _destinations.keys.map((d) => DropdownMenuItem(value: d, child: Text(d))).toList(),
                  onChanged: _isLoading ? null : _changeDestination,
                  decoration: InputDecoration(
                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                    contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                    prefixIcon: const Icon(Icons.public, color: AppColors.primary),
                  ),
                ),
              ],
            ),
          ),

          // 2. Viewer
          Expanded(
            child: Stack(
              children: [
                if (_currentImage != null)
                  Positioned.fill(
                    child: InteractiveViewer(
                      minScale: 1.0,
                      maxScale: 4.0,
                      child: Image.network(
                        _currentImage!,
                        fit: BoxFit.cover,
                        loadingBuilder: (context, child, loadingProgress) {
                          if (loadingProgress == null) return child;
                          return const Center(child: CircularProgressIndicator());
                        },
                      ),
                    ),
                  ),
                
                if (_isLoading)
                  Container(
                    color: Colors.black54,
                    child: const Center(
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          CircularProgressIndicator(color: Colors.white),
                          SizedBox(height: 16),
                          Text("Traveling...", style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold))
                        ],
                      ),
                    ),
                  ),

                // Overlay Controls
                Positioned(
                  bottom: 24,
                  right: 24,
                  child: FloatingActionButton(
                    onPressed: () {
                      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text("VR Mode coming soon!")));
                    },
                    backgroundColor: Colors.white,
                    child: const Icon(Icons.vrpano, color: Colors.black),
                  ),
                ),
                
                Positioned(
                  bottom: 24,
                  left: 24,
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                    decoration: BoxDecoration(
                      color: Colors.black.withOpacity(0.6),
                      borderRadius: BorderRadius.circular(20),
                    ),
                    child: Row(
                      children: [
                        const Icon(Icons.info_outline, color: Colors.white, size: 16),
                        const SizedBox(width: 8),
                        Text(
                          "Pinch to Zoom • Drag to Pan",
                          style: GoogleFonts.inter(color: Colors.white, fontSize: 12),
                        ),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
