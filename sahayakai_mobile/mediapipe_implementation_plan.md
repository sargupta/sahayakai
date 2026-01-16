# MediaPipe LLM Integration - Implementation Plan
## SahayakAI Offline AI Capabilities

**Goal**: Enable on-device AI inference for offline lesson plan generation on Android  
**Timeline**: 8-10 weeks (3 phases)  
**Priority**: High - Critical for rural India use case  
**Status**: Planning  

---

## Overview

### What We're Building

A **hybrid AI system** that works both online (cloud quality) and offline (on-device):

```
Online Mode:  Flutter → Backend API → Gemini Pro (Current)
Offline Mode: Flutter → MediaPipe → Gemma 3N (NEW)
```

### Success Criteria

- ✅ 90%+ Android users can download model
- ✅ Offline lesson plans generated in <10 seconds
- ✅ Quality acceptable for basic teaching needs
- ✅ Battery drain <5% per hour
- ✅ 70% reduction in API costs

---

## Phase 1: Proof of Concept (Week 1-2)

**Goal**: Validate technical feasibility and performance

### Week 1: Native Android Prototype

**Tasks:**

1. **Setup Development Environment**
   ```bash
   # Create new Android project for testing
   cd ~/AndroidProjects
   npx react-native init MediaPipeTest
   ```

2. **Add Dependencies**
   ```gradle
   // android/app/build.gradle
   dependencies {
       implementation 'com.google.mediapipe:tasks-genai:0.10.27'
       implementation 'org.jetbrains.kotlinx:kotlinx-coroutines-android:1.7.3'
   }
   ```

3. **Download Gemma 3N-E2B Model**
   ```bash
   # Download from Hugging Face
   wget https://huggingface.co/google/gemma-3n-E2B-it-litert-lm/resolve/main/model.task
   
   # Push to Android device/emulator
   adb push model.task /data/local/tmp/llm/gemma3n_e2b.task
   ```

4. **Create Test Activity**
   ```kotlin
   // MainActivity.kt
   class MainActivity : AppCompatActivity() {
       private lateinit var llmInference: LlmInference
       
       override fun onCreate(savedInstanceState: Bundle?) {
           super.onCreate(savedInstanceState)
           
           // Initialize model
           val options = LlmInferenceOptions.builder()
               .setModelPath("/data/local/tmp/llm/gemma3n_e2b.task")
               .setMaxTokens(512)
               .setTemperature(0.7f)
               .build()
           
           llmInference = LlmInference.createFromOptions(this, options)
           
           // Test generation
           testLessonPlanGeneration()
       }
       
       private fun testLessonPlanGeneration() {
           val prompt = """
               Create a simple lesson plan for Grade 6 Science on Photosynthesis.
               Include objectives, materials, and main activity.
           """.trimIndent()
           
           lifecycleScope.launch {
               val startTime = System.currentTimeMillis()
               val result = llmInference.generateResponse(prompt)
               val duration = System.currentTimeMillis() - startTime
               
               Log.d("MediaPipe", "Result: $result")
               Log.d("MediaPipe", "Time taken: ${duration}ms")
           }
       }
   }
   ```

5. **Measure Performance**
   - Time to first token
   - Tokens per second
   - Memory usage (Android Profiler)
   - Battery drain (Battery Historian)
   - Output quality

**Deliverables:**
- [ ] Performance benchmark report
- [ ] Quality assessment (5 sample lesson plans)
- [ ] Device compatibility matrix
- [ ] Go/No-Go decision document

---

### Week 2: Flutter Platform Channel Design

**Tasks:**

1. **Design Platform Channel Interface**
   
   Create specification document:
   ```yaml
   # platform_channel_spec.yaml
   channels:
     method_channel: "com.sahayakai/llm"
       methods:
         - initializeModel(modelPath: String)
         - isModelDownloaded(): Boolean
         - downloadModel(url: String, onProgress: (Double) -> Void)
         - generateLessonPlan(prompt: String): String
         - cancelGeneration()
         
     event_channel: "com.sahayakai/llm_stream"
       events:
         - tokenGenerated(token: String)
         - generationComplete(fullText: String)
         - error(message: String)
   ```

2. **Create Flutter Service Interface**
   ```dart
   // lib/src/core/services/on_device_llm_service.dart
   abstract class LLMService {
     Future<void> initialize();
     Future<bool> isModelAvailable();
     Stream<String> generateLessonPlan(LessonPlanInput input);
     Future<void> downloadModel({Function(double)? onProgress});
   }
   ```

3. **Document Architecture**
   - Create sequence diagrams
   - Define error handling strategy
   - Plan state management approach

**Deliverables:**
- [ ] Platform channel specification
- [ ] Architecture diagram
- [ ] Error handling strategy document

---

## Phase 2: Core Implementation (Week 3-6)

**Goal**: Build production-ready offline capability

### Week 3: Android Native Implementation

**Files to Create:**

1. **`android/app/src/main/kotlin/com/sahayakai/llm/OnDeviceLLMService.kt`**
   ```kotlin
   package com.sahayakai.llm
   
   import android.content.Context
   import com.google.mediapipe.tasks.genai.llminference.LlmInference
   import com.google.mediapipe.tasks.genai.llminference.LlmInferenceOptions
   import kotlinx.coroutines.flow.Flow
   import kotlinx.coroutines.flow.flow
   
   class OnDeviceLLMService(private val context: Context) {
       private var llmInference: LlmInference? = null
       private var isInitialized = false
       
       fun initialize(modelPath: String) {
           val options = LlmInferenceOptions.builder()
               .setModelPath(modelPath)
               .setMaxTokens(512)
               .setTopK(40)
               .setTemperature(0.8f)
               .build()
           
           llmInference = LlmInference.createFromOptions(context, options)
           isInitialized = true
       }
       
       fun generateLessonPlanStream(prompt: String): Flow<String> = flow {
           if (!isInitialized) throw IllegalStateException("Model not initialized")
           
           llmInference?.generateResponseAsync(prompt)?.let { response ->
               emit(response)
           }
       }
       
       fun isModelDownloaded(): Boolean {
           val modelPath = getModelPath()
           return File(modelPath).exists()
       }
       
       private fun getModelPath(): String {
           return "${context.getExternalFilesDir(null)}/models/gemma3n_e2b.task"
       }
   }
   ```

2. **`android/app/src/main/kotlin/com/sahayakai/llm/LLMMethodChannel.kt`**
   ```kotlin
   package com.sahayakai.llm
   
   import io.flutter.plugin.common.MethodChannel
   import io.flutter.plugin.common.EventChannel
   
   class LLMMethodChannel(
       private val methodChannel: MethodChannel,
       private val eventChannel: EventChannel,
       private val llmService: OnDeviceLLMService
   ) {
       
       fun setup() {
           methodChannel.setMethodCallHandler { call, result ->
               when (call.method) {
                   "initializeModel" -> {
                       val modelPath = call.argument<String>("modelPath")!!
                       llmService.initialize(modelPath)
                       result.success(null)
                   }
                   "isModelDownloaded" -> {
                       result.success(llmService.isModelDownloaded())
                   }
                   else -> result.notImplemented()
               }
           }
           
           eventChannel.setStreamHandler(object : EventChannel.StreamHandler {
               override fun onListen(arguments: Any?, events: EventSink?) {
                   val prompt = (arguments as Map<*, *>)["prompt"] as String
                   
                   lifecycleScope.launch {
                       llmService.generateLessonPlanStream(prompt)
                           .collect { token ->
                               events?.success(token)
                           }
                       events?.endOfStream()
                   }
               }
               
               override fun onCancel(arguments: Any?) {
                   // Handle cancellation
               }
           })
       }
   }
   ```

**Tasks:**
- [ ] Implement all native services
- [ ] Add comprehensive error handling
- [ ] Write unit tests (Kotlin)
- [ ] Handle edge cases (low memory, crashes)

---

### Week 4: Flutter Service Layer

**Files to Create:**

1. **`lib/src/core/services/on_device_llm_service.dart`**
   ```dart
   import 'package:flutter/services.dart';
   
   class OnDeviceLLMService implements LLMService {
     static const _methodChannel = MethodChannel('com.sahayakai/llm');
     static const _eventChannel = EventChannel('com.sahayakai/llm_stream');
     
     @override
     Future<void> initialize() async {
       if (!Platform.isAndroid) {
         throw UnsupportedError('Only Android is supported');
       }
       
       final modelPath = await _getModelPath();
       await _methodChannel.invokeMethod('initializeModel', {
         'modelPath': modelPath,
       });
     }
     
     @override
     Future<bool> isModelAvailable() async {
       return await _methodChannel.invokeMethod('isModelDownloaded') ?? false;
     }
     
     @override
     Stream<String> generateLessonPlan(LessonPlanInput input) {
       final prompt = _buildPrompt(input);
       return _eventChannel
           .receiveBroadcastStream({'prompt': prompt})
           .map((event) => event as String);
     }
     
     String _buildPrompt(LessonPlanInput input) {
       return '''
   You are creating a lesson plan for an Indian school teacher.
   
   Topic: ${input.topic}
   Grade: ${input.gradeLevels.join(', ')}
   Language: ${input.language}
   Context: Rural classroom with limited resources
   
   Generate a structured lesson plan with:
   1. Title
   2. Learning Objectives (2-3)
   3. Materials (low-cost, locally available)
   4. Activities (step-by-step)
   5. Assessment
   
   Format as JSON.
   ''';
     }
     
     Future<String> _getModelPath() async {
       final directory = await getApplicationDocumentsDirectory();
       return '${directory.path}/models/gemma3n_e2b.task';
     }
   }
   ```

2. **`lib/src/core/services/cloud_llm_service.dart`**
   ```dart
   class CloudLLMService implements LLMService {
     final ApiClient _apiClient;
     
     @override
     Stream<String> generateLessonPlan(LessonPlanInput input) async* {
       final response = await _apiClient.post(
         '/api/v1/generate-lesson-plan',
         data: input.toJson(),
       );
       
       yield LessonPlanOutput.fromJson(response.data).toString();
     }
   }
   ```

3. **`lib/src/core/services/hybrid_llm_service.dart`**
   ```dart
   import 'package:connectivity_plus/connectivity_plus.dart';
   
   class HybridLLMService implements LLMService {
     final OnDeviceLLMService _onDevice;
     final CloudLLMService _cloud;
     final SharedPreferences _prefs;
     
     @override
     Stream<String> generateLessonPlan(LessonPlanInput input) async* {
       final connectivity = await Connectivity().checkConnectivity();
       final hasInternet = connectivity != ConnectivityResult.none;
       
       // User preference: force offline mode
       final forceOffline = _prefs.getBool('force_offline_mode') ?? false;
       
       if (forceOffline || !hasInternet) {
         // Use on-device
         final modelAvailable = await _onDevice.isModelAvailable();
         
         if (modelAvailable) {
           yield* _onDevice.generateLessonPlan(input);
         } else {
           throw Exception('Model not downloaded. Please download in Settings.');
         }
       } else {
         // Use cloud (better quality)
         try {
           yield* _cloud.generateLessonPlan(input);
         } catch (e) {
           // Fallback to on-device
           if (await _onDevice.isModelAvailable()) {
             yield* _onDevice.generateLessonPlan(input);
           } else {
             rethrow;
           }
         }
       }
     }
   }
   ```

**Tasks:**
- [ ] Implement all Flutter services
- [ ] Add connectivity detection
- [ ] Implement fallback logic
- [ ] Write unit tests (Dart)

---

### Week 5: Repository & Provider Updates

**Files to Modify:**

1. **`lib/src/features/lesson_plan/data/lesson_plan_repository.dart`**
   ```dart
   class LessonPlanRepository {
     final HybridLLMService _llmService;
     final DatabaseService _db;
     
     Future<LessonPlanOutput> generateLessonPlan(LessonPlanInput input) async {
       String fullResponse = '';
       
       // Stream tokens and build response
       await for (final token in _llmService.generateLessonPlan(input)) {
         fullResponse += token;
       }
       
       // Parse response
       final output = _parseResponse(fullResponse, input);
       
       // Save to local DB
       await _db.saveLessonPlan(output);
       
       return output;
     }
     
     LessonPlanOutput _parseResponse(String response, LessonPlanInput input) {
       // Try to parse as JSON first
       try {
         final json = jsonDecode(response);
         return LessonPlanOutput.fromJson(json);
       } catch (e) {
         // Fallback: parse markdown format
         return _parseMarkdown(response, input);
       }
     }
   }
   ```

2. **`lib/src/features/lesson_plan/presentation/providers/lesson_plan_provider.dart`**
   ```dart
   final lessonPlanStreamProvider = StreamProvider.family<String, LessonPlanInput>(
     (ref, input) async* {
       final repo = ref.read(lessonPlanRepositoryProvider);
       
       await for (final token in repo.streamLessonPlan(input)) {
         yield token;
       }
     },
   );
   ```

**Tasks:**
- [ ] Update repository to use hybrid service
- [ ] Add streaming support to providers
- [ ] Update error handling
- [ ] Maintain backward compatibility

---

### Week 6: UI Integration

**Files to Create/Modify:**

1. **`lib/src/features/settings/presentation/screens/offline_mode_screen.dart`**
   ```dart
   class OfflineModeScreen extends ConsumerStatefulWidget {
     @override
     ConsumerState<OfflineModeScreen> createState() => _OfflineModeScreenState();
   }
   
   class _OfflineModeScreenState extends ConsumerState<OfflineModeScreen> {
     double _downloadProgress = 0.0;
     bool _isDownloading = false;
     
     @override
     Widget build(BuildContext context) {
       return Scaffold(
         body: MeshBackground(
           child: SafeArea(
             child: Padding(
               padding: EdgeInsets.all(20),
               child: Column(
                 crossAxisAlignment: CrossAxisAlignment.start,
                 children: [
                   Text(
                     'Offline AI Mode',
                     style: GoogleFonts.outfit(
                       fontSize: 28,
                       fontWeight: FontWeight.bold,
                     ),
                   ),
                   SizedBox(height: 24),
                   
                   _buildModelCard(),
                   SizedBox(height: 24),
                   
                   _buildBenefitsSection(),
                   SizedBox(height: 24),
                   
                   _buildRequirementsSection(),
                   
                   Spacer(),
                   
                   if (_isDownloading)
                     _buildDownloadProgress()
                   else
                     _buildDownloadButton(),
                 ],
               ),
             ),
           ),
         ),
       );
     }
     
     Widget _buildModelCard() {
       return GlassCard(
         padding: EdgeInsets.all(24),
         child: Column(
           crossAxisAlignment: CrossAxisAlignment.start,
           children: [
             Row(
               children: [
                 Container(
                   padding: EdgeInsets.all(12),
                   decoration: BoxDecoration(
                     gradient: LinearGradient(
                       colors: [Color(0xFF14B8A6), Color(0xFF0D9488)],
                     ),
                     borderRadius: BorderRadius.circular(12),
                   ),
                   child: Icon(Icons.memory, color: Colors.white),
                 ),
                 SizedBox(width: 16),
                 Expanded(
                   child: Column(
                     crossAxisAlignment: CrossAxisAlignment.start,
                     children: [
                       Text(
                         'Gemma 3N-E2B',
                         style: TextStyle(
                           fontSize: 20,
                           fontWeight: FontWeight.bold,
                         ),
                       ),
                       Text(
                         'On-Device AI Model',
                         style: TextStyle(color: Colors.grey),
                       ),
                     ],
                   ),
                 ),
               ],
             ),
             SizedBox(height: 20),
             
             _buildInfoRow(Icons.storage, 'Size', '1.2 GB'),
             _buildInfoRow(Icons.speed, 'Speed', '~8 tokens/sec'),
             _buildInfoRow(Icons.memory, 'RAM', '4 GB minimum'),
           ],
         ),
       );
     }
     
     Future<void> _startDownload() async {
       setState(() => _isDownloading = true);
       
       try {
         final llmService = ref.read(onDeviceLLMServiceProvider);
         
         await llmService.downloadModel(
           onProgress: (progress) {
             setState(() => _downloadProgress = progress);
           },
         );
         
         ScaffoldMessenger.of(context).showSnackBar(
           SnackBar(content: Text('✅ Model downloaded successfully!')),
         );
       } catch (e) {
         ScaffoldMessenger.of(context).showSnackBar(
           SnackBar(content: Text('❌ Download failed: $e')),
         );
       } finally {
         setState(() => _isDownloading = false);
       }
     }
   }
   ```

2. **Update `CreateLessonScreen` to show offline indicator**
   ```dart
   // In app bar
   StreamBuilder(
     stream: Connectivity().onConnectivityChanged,
     builder: (context, snapshot) {
       final isOffline = snapshot.data == ConnectivityResult.none;
       if (isOffline) {
         return Container(
           padding: EdgeInsets.symmetric(horizontal: 8, vertical: 4),
           decoration: BoxDecoration(
             color: Colors.amber.withOpacity(0.2),
             borderRadius: BorderRadius.circular(12),
           ),
           child: Row(
             children: [
               Icon(Icons.cloud_off, size: 16, color: Colors.amber),
               SizedBox(width: 4),
               Text('Offline Mode', style: TextStyle(fontSize: 12)),
             ],
           ),
         );
       }
       return SizedBox.shrink();
     },
   )
   ```

**Tasks:**
- [ ] Create offline mode settings screen
- [ ] Add model download functionality
- [ ] Show offline indicators in UI
- [ ] Update loading states for streaming
- [ ] Handle errors gracefully

---

## Phase 3: Testing & Rollout (Week 7-10)

### Week 7-8: Testing

**Test Plan:**

1. **Unit Tests**
   ```dart
   // test/core/services/hybrid_llm_service_test.dart
   void main() {
     group('HybridLLMService', () {
       test('uses on-device when offline', () async {
         // Mock offline state
         // Verify on-device service is called
       });
       
       test('uses cloud when online', () async {
         // Mock online state
         // Verify cloud service is called
       });
       
       test('falls back to on-device on cloud error', () async {
         // Mock cloud failure
         // Verify fallback to on-device
       });
     });
   }
   ```

2. **Integration Tests**
   ```dart
   // integration_test/offline_mode_test.dart
   void main() {
     testWidgets('Complete offline lesson plan generation', (tester) async {
       // Navigate to lesson planner
       // Enter topic
       // Verify offline mode indicator
       // Generate lesson plan
       // Verify output quality
     });
   }
   ```

3. **Device Testing Matrix**
   
   | Device Category | RAM | Test Device | Status |
   |----------------|-----|-------------|--------|
   | Low-end | 3-4GB | Redmi 9A | [ ] |
   | Mid-range | 4-6GB | Realme 8 | [ ] |
   | High-end | 6GB+ | OnePlus Nord | [ ] |

4. **Performance Testing**
   - [ ] Memory profiling (Android Profiler)
   - [ ] Battery drain analysis (Battery Historian)
   - [ ] Network efficiency (no unnecessary calls)
   - [ ] App size impact (+1.2GB with model)

**Tasks:**
- [ ] Write comprehensive test suite
- [ ] Test on physical devices
- [ ] Load testing (100+ consecutive requests)
- [ ] Measure quality vs cloud Gemini
- [ ] Document all test results

---

### Week 9: Beta Rollout

**Rollout Strategy:**

1. **Phase 1: Internal Testing (100 users)**
   ```yaml
   # Firebase Remote Config
   features:
     offline_mode:
       enabled_percentage: 0
       beta_users: ["user1@example.com", "user2@example.com"]
   ```

2. **Phase 2: Limited Beta (10% of users)**
   ```yaml
   features:
     offline_mode:
       enabled_percentage: 10
       min_app_version: "2.5.0"
       exclude_devices: ["low_memory_devices"]
   ```

3. **Phase 3: Full Rollout (100%)**
   ```yaml
   features:
     offline_mode:
       enabled_percentage: 100
   ```

**Monitoring:**
- Set up Firebase Analytics events
- Track download rates
- Monitor crash reports
- Collect user feedback
- Measure API cost savings

**Tasks:**
- [ ] Configure Firebase Remote Config
- [ ] Create beta user list
- [ ] Set up monitoring dashboards
- [ ] Prepare rollback plan
- [ ] Create user documentation

---

### Week 10: Polish & Documentation

**Final Tasks:**

1. **User Documentation**
   - [ ] "How to Download AI Model" guide
   - [ ] "Offline Mode" FAQ
   - [ ] Troubleshooting guide
   - [ ] Video tutorial

2. **Developer Documentation**
   - [ ] API documentation
   - [ ] Architecture diagrams
   - [ ] Deployment guide
   - [ ] Maintenance procedures

3. **Performance Optimization**
   - [ ] Model preloading on app start
   - [ ] Caching strategies
   - [ ] Memory optimization
   - [ ] Battery optimization

4. **Accessibility**
   - [ ] Screen reader support
   - [ ] High contrast mode
   - [ ] Voice guidance

**Deliverables:**
- [ ] Complete user documentation
- [ ] Technical documentation
- [ ] Performance report
- [ ] Post-launch roadmap

---

## Risk Mitigation

### High-Risk Items

| Risk | Impact | Mitigation |
|------|--------|------------|
| Poor model quality | High | A/B test, provide cloud fallback |
| Device compatibility | High | Detect device capability, show warnings |
| Download failures | Medium | Resume download, WiFi-only option |
| Memory crashes | High | Aggressive memory management, kill switches |
| Battery drain | Medium | Background restrictions, user controls |

### Rollback Plan

If critical issues arise:

1. **Immediate**: Disable via Remote Config
   ```yaml
   features:
     offline_mode:
       enabled_percentage: 0
       kill_switch: true
   ```

2. **Short-term**: Fix bugs, release patch
3. **Long-term**: Re-enable gradually

---

## Success Metrics

### Week 2 (PoC)
- [ ] Model loads in <5 seconds
- [ ] Generates coherent lesson plans
- [ ] Memory usage <3GB
- [ ] No crashes on target devices

### Week 6 (Implementation Complete)
- [ ] All tests passing (>90% coverage)
- [ ] Build succeeds on CI/CD
- [ ] No critical bugs
- [ ] Documentation complete

### Week 10 (Production)
- [ ] >60% of eligible users downloaded model
- [ ] >40% of lesson plans generated offline
- [ ] <1% crash rate
- [ ] 70% reduction in API costs
- [ ] 4.5+ star rating maintained

---

## Resource Requirements

### Team

- **1 Android Developer** (Native implementation)
- **1 Flutter Developer** (Platform channels, UI)
- **1 QA Engineer** (Testing, device matrix)
- **0.5 DevOps** (Build, deployment)
- **0.5 PM** (Coordination, stakeholder management)

### Infrastructure

- **Android Emulator**: 8GB RAM minimum
- **Physical Test Devices**: 3-5 devices (low/mid/high-end)
- **Cloud Storage**: For model hosting (~5GB)
- **CI/CD**: GitHub Actions or Firebase App Distribution

### Budget

- Model hosting: $10/month (Cloud Storage)
- Test devices: $300-500 (one-time)
- Cloud testing: $50/month (Firebase Test Lab)
- **Total**: ~$600 one-time + $60/month

---

## Next Steps (This Week)

### Immediate Actions

1. **Review & Approval**
   - [ ] Present plan to stakeholders
   - [ ] Get budget approval
   - [ ] Assign team members

2. **Environment Setup**
   - [ ] Set up Android emulator (8GB RAM)
   - [ ] Download Gemma 3N-E2B model
   - [ ] Create test Android project

3. **PoC Start**
   - [ ] Begin Week 1 tasks
   - [ ] Document initial findings
   - [ ] Schedule check-in meetings

---

## Conclusion

This plan **enables offline AI for rural India** in 10 weeks through:

✅ **Pragmatic approach** - Start small (PoC), build incrementally  
✅ **Risk management** - Multiple fallbacks, gradual rollout  
✅ **Quality focus** - Comprehensive testing, user feedback  
✅ **Cost consciousness** - 70% API cost reduction  
✅ **Mission alignment** - True offline capability for teachers  

**Let's democratize AI education in Bharat!** 🇮🇳

---

**Plan Version**: 1.0  
**Created**: 2026-01-16  
**Next Review**: Week 2 (after PoC)  
**Owner**: SahayakAI Engineering Team
