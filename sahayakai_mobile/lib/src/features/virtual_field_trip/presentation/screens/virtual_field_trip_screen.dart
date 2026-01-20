import 'package:flutter/material.dart';
import '../../../../core/theme/glassmorphic/glass_components.dart';

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

    await Future.delayed(const Duration(seconds: 1));

    setState(() {
      _currentImage = _destinations[newValue];
      _isLoading = false;
    });
  }

  @override
  Widget build(BuildContext context) {
    return GlassScaffold(
      title: 'Virtual Field Trip',
      showBackButton: true,
      actions: [GlassMenuButton(onPressed: () {})],
      body: Column(
        children: [
          // Destination Selector
          Padding(
            padding: const EdgeInsets.all(GlassSpacing.xl),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Decorative Header
                Text(
                  'Exploring the World...',
                  style: GlassTypography.decorativeLabel(),
                ),
                const SizedBox(height: GlassSpacing.xs),
                Text(
                  'Choose Destination',
                  style: GlassTypography.headline2(),
                ),
                const SizedBox(height: GlassSpacing.lg),

                // Destination Dropdown
                GlassDropdown<String>(
                  labelText: 'Select Destination',
                  value: _selectedDestination,
                  items: _destinations.keys
                      .map((dest) => DropdownMenuItem(
                            value: dest,
                            child: Text(dest),
                          ))
                      .toList(),
                  onChanged: _isLoading ? null : _changeDestination,
                ),
              ],
            ),
          ),

          // Image Viewer
          Expanded(
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: GlassSpacing.xl),
              child: ClipRRect(
                borderRadius: BorderRadius.circular(GlassRadius.lg),
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
                              return Center(
                                child: GlassLoadingIndicator(
                                  message: 'Loading...',
                                ),
                              );
                            },
                          ),
                        ),
                      ),

                    if (_isLoading)
                      Container(
                        color: Colors.black54,
                        child: Center(
                          child: Column(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              const CircularProgressIndicator(
                                color: Colors.white,
                              ),
                              const SizedBox(height: GlassSpacing.lg),
                              Text(
                                'Traveling...',
                                style: GlassTypography.labelLarge(
                                  color: Colors.white,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),

                    // Overlay Controls
                    Positioned(
                      bottom: GlassSpacing.lg,
                      right: GlassSpacing.lg,
                      child: GlassIconButton(
                        icon: Icons.vrpano_rounded,
                        onPressed: () {
                          ScaffoldMessenger.of(context).showSnackBar(
                            const SnackBar(
                              content: Text('VR Mode coming soon!'),
                            ),
                          );
                        },
                        backgroundColor: Colors.white,
                      ),
                    ),

                    Positioned(
                      bottom: GlassSpacing.lg,
                      left: GlassSpacing.lg,
                      child: Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: GlassSpacing.lg,
                          vertical: GlassSpacing.sm,
                        ),
                        decoration: BoxDecoration(
                          color: Colors.black.withOpacity(0.6),
                          borderRadius: BorderRadius.circular(GlassRadius.pill),
                        ),
                        child: Row(
                          children: [
                            const Icon(
                              Icons.info_outline_rounded,
                              color: Colors.white,
                              size: 16,
                            ),
                            const SizedBox(width: GlassSpacing.sm),
                            Text(
                              'Pinch to Zoom • Drag to Pan',
                              style: GlassTypography.labelSmall(
                                color: Colors.white,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
          const SizedBox(height: GlassSpacing.xxl),
        ],
      ),
    );
  }
}
