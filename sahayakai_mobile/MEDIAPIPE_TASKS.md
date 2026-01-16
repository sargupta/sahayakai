# MediaPipe LLM Integration - Task Tracker

## Project Overview
**Feature**: On-Device AI Inference with MediaPipe  
**Branch**: `feature/mediapipe-llm-integration`  
**Timeline**: 10 weeks (3 phases)  
**Status**: 🏗️ In Progress  
**Started**: 2026-01-16  

---

## Quick Status

| Phase | Status | Progress | ETA |
|-------|--------|----------|-----|
| **Phase 1: PoC** | 🔵 In Progress | 0% | Week 2 |
| **Phase 2: Implementation** | ⚪ Not Started | 0% | Week 6 |
| **Phase 3: Testing & Rollout** | ⚪ Not Started | 0% | Week 10 |

**Overall Progress**: █░░░░░░░░░ 0% (0/100 tasks complete)

---

## Phase 1: Proof of Concept (Week 1-2)

### Week 1: Native Android Prototype ⏳ In Progress

#### Environment Setup
- [ ] Install/Update Android Studio
- [ ] Configure Android emulator (8GB RAM minimum)
- [ ] Install required SDKs (Android 7.0+, API 24+)
- [ ] Set up ADB connection

#### Model Download & Setup
- [ ] Download Gemma 3N-E2B from Hugging Face
  - URL: https://huggingface.co/google/gemma-3n-E2B-it-litert-lm
  - Size: ~1.2GB
  - Format: .task file
- [ ] Push model to emulator/device
  ```bash
  adb push model.task /data/local/tmp/llm/gemma3n_e2b.task
  ```
- [ ] Verify model integrity (checksum)

#### Create Test Android Project
- [ ] Create new Android project (Kotlin)
  ```bash
  # In ~/AndroidStudioProjects/
  # Name: MediaPipeTest
  # Language: Kotlin
  # Min SDK: 24 (Android 7.0)
  ```
- [ ] Add MediaPipe dependency
  ```gradle
  implementation 'com.google.mediapipe:tasks-genai:0.10.27'
  ```
- [ ] Add Coroutines dependency
  ```gradle
  implementation 'org.jetbrains.kotlinx:kotlinx-coroutines-android:1.7.3'
  ```
- [ ] Sync and verify build succeeds

#### Implement Test Activity
- [ ] Create `OnDeviceLLMService.kt`
  - Initialize MediaPipe LlmInference
  - Configure options (temperature, topK, etc.)
  - Implement generateResponse method
- [ ] Create `MainActivity.kt`
  - UI: Simple EditText + Button + TextView
  - Call LLM service on button click
  - Display response
- [ ] Add error handling
- [ ] Add logging (time measurement)

#### Performance Benchmarking
- [ ] **Test 1: Initialization Time**
  - Measure model load time
  - Target: <5 seconds
  - Record: ___ seconds
- [ ] **Test 2: Time to First Token (TTFT)**
  - Measure latency to first response token
  - Target: <1 second
  - Record: ___ ms
- [ ] **Test 3: Tokens Per Second**
  - Measure generation speed
  - Target: >8 tokens/sec
  - Record: ___ tokens/sec
- [ ] **Test 4: Memory Usage**
  - Use Android Profiler
  - Monitor heap allocation
  - Target: <3GB
  - Record: ___ GB
- [ ] **Test 5: Battery Drain**
  - Use Battery Historian
  - 30 minute test session
  - Target: <5% per hour
  - Record: ___% per hour

#### Quality Assessment
- [ ] Generate 5 sample lesson plans
  - Topic 1: Photosynthesis (Grade 6 Science)
  - Topic 2: Mughal Empire (Grade 7 History)
  - Topic 3: Fractions (Grade 5 Math)
  - Topic 4: Water Cycle (Grade 4 Science)
  - Topic 5: Indian Freedom Movement (Grade 8 History
)
- [ ] Rate quality (1-5 scale)
- [ ] Compare to Cloud Gemini outputs
- [ ] Document strengths/weaknesses

#### Device Compatibility Testing
- [ ] **Low-end Device** (4GB RAM)
  - Device: _____________
  - Result: ✅ Pass / ❌ Fail
  - Notes: _____________
- [ ] **Mid-range Device** (6GB RAM)
  - Device: _____________
  - Result: ✅ Pass / ❌ Fail
  - Notes: _____________
- [ ] **High-end Device** (8GB+ RAM)
  - Device: _____________
  - Result: ✅ Pass / ❌ Fail
  - Notes: _____________

#### Documentation
- [ ] Create performance benchmark report
  - Template: `docs/mediapipe_poc_results.md`
  - Include all metrics
  - Screenshots of profiler data
- [ ] Create quality assessment report
  - Sample outputs
  - Comparison matrix (Cloud vs On-Device)
  - Recommendations
- [ ] Update device compatibility matrix

#### Deliverables
- [ ] Working Android test app
- [ ] Performance benchmark report
- [ ] Quality assessment document
- [ ] Device compatibility matrix
- [ ] **Go/No-Go Decision Document**

---

### Week 2: Flutter Platform Channel Design ⚪ Not Started

#### Platform Channel Specification
- [ ] Create `docs/platform_channel_spec.md`
- [ ] Define MethodChannel interface
  - `initializeModel(modelPath: String)`
  - `isModelDownloaded(): Boolean`
  - `downloadModel(url: String, onProgress)`
  - `generateLessonPlan(prompt: String): String`
  - `cancelGeneration()`
  - `getModelInfo(): Map`
- [ ] Define EventChannel interface
  - `tokenGenerated(token: String)`
  - `generationComplete(fullText: String)`
  - `generationProgress(percentage: Double)`
  - `error(message: String, code: int)`
- [ ] Define error codes
  - `ERROR_MODEL_NOT_FOUND = 1001`
  - `ERROR_INITIALIZATION_FAILED = 1002`
  - `ERROR_GENERATION_FAILED = 1003`
  - `ERROR_OUT_OF_MEMORY = 1004`
  - `ERROR_DEVICE_INCOMPATIBLE = 1005`

#### Architecture Documentation
- [ ] Create architecture diagram
  - Flutter layer
  - Platform channel layer
  - Native Android layer
  - MediaPipe SDK layer
- [ ] Create sequence diagrams
  - Model initialization flow
  - Lesson plan generation flow
  - Error handling flow
  - Download flow
- [ ] Create state diagrams
  - Model states (Not Downloaded → Downloading → Downloaded → Initialized)
  - Generation states (Idle → Generating → Streaming → Complete/Error)

#### Error Handling Strategy
- [ ] Document retry logic
- [ ] Define fallback strategies
  - On-device fails → cloud API
  - Model not downloaded → prompt user
  - Device incompatible → disable feature
- [ ] Create error message mapping (user-friendly)
- [ ] Define logging strategy

#### State Management Plan
- [ ] Choose state management approach
  - Option 1: Riverpod (current)
  - Option 2: Bloc
  - Option 3: Provider
  - **Decision**: ____________
- [ ] Design provider structure
  - `onDeviceLLMProvider`
  - `cloudLLMProvider`
  - `hybridLLMProvider`
  - `modelDownloadProvider`
  - `lessonPlanGenerationProvider`
- [ ] Define state classes
  - `ModelState`
  - `GenerationState`
  - `DownloadState`

#### Flutter Service Interface
- [ ] Create `lib/src/core/services/llm_service.dart` (abstract)
  ```dart
  abstract class LLMService {
    Future<void> initialize();
    Future<bool> isModelAvailable();
    Stream<String> generateLessonPlan(LessonPlanInput input);
    Future<ModelInfo> getModelInfo();
  }
  ```
- [ ] Design `ModelInfo` class
- [ ] Design `GenerationConfig` class
- [ ] Design error types

#### Deliverables
- [ ] Platform channel specification document
- [ ] Architecture diagrams (3+ diagrams)
- [ ] Error handling strategy document
- [ ] State management design document
- [ ] Flutter service interface definitions

---

## Phase 2: Core Implementation (Week 3-6)

### Week 3: Android Native Implementation ⚪ Not Started

#### File Structure Setup
- [ ] Create package: `com.sahayakai.llm`
- [ ] Create folder structure:
  ```
  android/app/src/main/kotlin/com/sahayakai/llm/
  ├── OnDeviceLLMService.kt
  ├── LLMMethodChannel.kt
  ├── LLMEventChannel.kt
  ├── ModelDownloadService.kt
  ├── ModelManager.kt
  └── utils/
      ├── PromptBuilder.kt
      └── ResponseParser.kt
  ```

#### Implement OnDeviceLLMService
- [ ] Create `OnDeviceLLMService.kt`
- [ ] Implement model initialization
- [ ] Implement prompt generation
- [ ] Implement streaming response
- [ ] Implement cancellation
- [ ] Add comprehensive logging
- [ ] Handle edge cases
  - Low memory warning
  - Model corruption
  - Invalid prompts

#### Implement MethodChannel
- [ ] Create `LLMMethodChannel.kt`
- [ ] Register channel with Flutter engine
- [ ] Implement all method handlers
- [ ] Add parameter validation
- [ ] Add error responses
- [ ] Write unit tests

#### Implement EventChannel
- [ ] Create `LLMEventChannel.kt`
- [ ] Implement stream handler
- [ ] Handle lifecycle (onListen, onCancel)
- [ ] Implement token emission
- [ ] Handle backpressure
- [ ] Write unit tests

#### Implement Model Download
- [ ] Create `ModelDownloadService.kt`
- [ ] Implement download with DownloadManager
- [ ] Add progress callbacks
- [ ] Implement resume capability
- [ ] Add WiFi-only option
- [ ] Verify checksum after download
- [ ] Handle download errors

#### Implement Model Manager
- [ ] Create `ModelManager.kt`
- [ ] Check if model exists
- [ ] Get model info (size, version, etc.)
- [ ] Delete model (if needed)
- [ ] Update model
- [ ] Manage storage permissions

#### Testing
- [ ] Unit tests for each service
- [ ] Integration tests
- [ ] Memory leak tests
- [ ] Edge case tests

#### Deliverables
- [ ] Complete native Android implementation
- [ ] All tests passing
- [ ] Code review completed
- [ ] Documentation updated

---

### Week 4: Flutter Service Layer ⚪ Not Started

#### Create Service Files
- [ ] `lib/src/core/services/on_device_llm_service.dart`
- [ ] `lib/src/core/services/cloud_llm_service.dart`
- [ ] `lib/src/core/services/hybrid_llm_service.dart`
- [ ] `lib/src/core/services/model_download_service.dart`

#### Implement OnDeviceLLMService
- [ ] Platform channel communication
- [ ] Error handling
- [ ] Stream transformation
- [ ] Prompt building
- [ ] Response parsing
- [ ] Unit tests

#### Implement CloudLLMService
- [ ] Maintain existing API calls
- [ ] Ensure compatibility
- [ ] Add same interface as OnDeviceLLMService
- [ ] Unit tests

#### Implement HybridLLMService
- [ ] Network detection logic
- [ ] User preference handling
- [ ] Intelligent routing (cloud vs on-device)
- [ ] Fallback implementation
- [ ] Error recovery
- [ ] Unit tests

#### Implement ModelDownloadService
- [ ] Platform channel for download
- [ ] Progress stream
- [ ] Storage management
- [ ] Error handling
- [ ] Unit tests

#### Testing
- [ ] Unit tests for all services
- [ ] Mock platform channels
- [ ] Integration tests
- [ ] Error scenario tests

#### Deliverables
- [ ] All Flutter services implemented
- [ ] 90%+ test coverage
- [ ] Code review completed
- [ ] Documentation updated

---

### Week 5: Repository & Provider Updates ⚪ Not Started

#### Update LessonPlanRepository
- [ ] Modify `lib/src/features/lesson_plan/data/lesson_plan_repository.dart`
- [ ] Integrate HybridLLMService
- [ ] Add streaming support
- [ ] Update error handling
- [ ] Maintain backward compatibility
- [ ] Add cache layer
- [ ] Unit tests

#### Create New Providers
- [ ] `modelStatusProvider` - Track model download state
- [ ] `generationModeProvider` - Online/Offline mode
- [ ] `lessonPlanStreamProvider` - Streaming generation
- [ ] `modelDownloadProgressProvider` - Download progress

#### Update Existing Providers
- [ ] `lessonPlanControllerProvider` - Add streaming
- [ ] `lessonPlanLoadingProvider` - Handle streaming states
- [ ] `lessonPlanErrorProvider` - New error types

#### Testing
- [ ] Unit tests for repository
- [ ] Unit tests for providers
- [ ] Integration tests
- [ ] State transition tests

#### Deliverables
- [ ] Updated repository
- [ ] All providers implemented
- [ ] Tests passing
- [ ] Documentation updated

---

### Week 6: UI Integration ⚪ Not Started

#### Create Settings Screen
- [ ] Create `lib/src/features/settings/presentation/screens/offline_mode_screen.dart`
- [ ] Model download UI
- [ ] Download progress indicator
- [ ] Model info display
- [ ] Delete model option
- [ ] Force offline mode toggle
- [ ] Device compatibility check UI

#### Update CreateLessonScreen
- [ ] Add offline mode indicator
- [ ] Show streaming progress
- [ ] Update loading states
- [ ] Handle errors gracefully
- [ ] Add "Download Model" prompt (if not downloaded)

#### Update HomeScreen
- [ ] Add "Offline Mode" settings card
- [ ] Show model status
- [ ] Quick toggle for offline mode

#### Create Components
- [ ] `StreamingText` widget (show tokens as they arrive)
- [ ] `DownloadProgress` widget
- [ ] `OfflineModeIndicator` widget
- [ ] `ModelStatusCard` widget

#### Testing
- [ ] Widget tests
- [ ] Integration tests
- [ ] Screenshot tests
- [ ] Accessibility tests

#### Deliverables
- [ ] All UI screens completed
- [ ] Tests passing
- [ ] Screenshots for documentation
- [ ] User flow documented

---

## Phase 3: Testing & Rollout (Week 7-10)

### Week 7-8: Comprehensive Testing ⚪ Not Started

#### Unit Testing
- [ ] Achieve 90%+ coverage
- [ ] All edge cases covered
- [ ] Mock all external dependencies
- [ ] CI/CD integration

#### Integration Testing
- [ ] End-to-end flows
- [ ] Platform channel communication
- [ ] Network scenarios
- [ ] Error scenarios

#### Device Testing
- [ ] **Low-end** (Redmi 9A, 3-4GB RAM)
  - [ ] Install and initialize
  - [ ] Generate 10 lesson plans
  - [ ] Monitor performance
  - [ ] Battery drain test
- [ ] **Mid-range** (Realme 8, 4-6GB RAM)
  - [ ] Install and initialize
  - [ ] Generate 10 lesson plans
  - [ ] Monitor performance
  - [ ] Battery drain test
- [ ] **High-end** (OnePlus Nord, 6GB+ RAM)
  - [ ] Install and initialize
  - [ ] Generate 10 lesson plans
  - [ ] Monitor performance
  - [ ] Battery drain test

#### Load Testing
- [ ] 100 consecutive generations
- [ ] Memory stability test
- [ ] Battery drain (extended use)
- [ ] Concurrent requests handling

#### Quality Comparison
- [ ] Generate 50 lesson plans (25 cloud, 25 on-device)
- [ ] Blind quality assessment
- [ ] Statistical analysis
- [ ] User feedback

#### Performance Testing
- [ ] Measure TTFT on different devices
- [ ] Measure tokens/sec
- [ ] Memory usage profiling
- [ ] Battery consumption analysis
- [ ] Network efficiency

#### Deliverables
- [ ] Complete test report
- [ ] Device compatibility matrix
- [ ] Performance benchmark report
- [ ] Quality assessment report
- [ ] Bug tracker with fixes

---

### Week 9: Beta Rollout ⚪ Not Started

#### Beta Preparation
- [ ] Create beta release build
- [ ] Set up Firebase App Distribution
- [ ] Configure Remote Config
  - `offline_mode_enabled`: 0% → 10% → 100%
  - `min_app_version`: "2.5.0"
  - `beta_users`: [email list]
- [ ] Create feedback form
- [ ] Set up analytics events
  - `model_downloaded`
  - `offline_generation_started`
  - `offline_generation_completed`
  - `offline_generation_failed`

#### Phase 1: Internal Beta (100 users)
- [ ] Deploy to internal testers
- [ ] Monitor for 3 days
- [ ] Collect feedback
- [ ] Fix critical bugs
- [ ] **Go/No-Go for Phase 2**

#### Phase 2: Limited Beta (10% of users)
- [ ] Enable for 10% via Remote Config
- [ ] Monitor metrics:
  - Download rate
  - Usage rate
  - Error rate
  - Crash rate
  - User satisfaction
- [ ] Run for 1 week
- [ ] Analyze data
- [ ] Fix bugs
- [ ] **Go/No-Go for Phase 3**

#### Phase 3: Full Rollout (100%)
- [ ] Enable for 100% via Remote Config
- [ ] Monitor closely for 3 days
- [ ] Respond to issues quickly
- [ ] Collect user feedback

#### Monitoring & Analytics
- [ ] Set up Crashlytics monitoring
- [ ] Create dashboard for key metrics
- [ ] Set up alerts for critical errors
- [ ] Daily check-ins during rollout

#### Deliverables
- [ ] Beta release deployed
- [ ] Feedback collected and analyzed
- [ ] Bug fixes deployed
- [ ] Full rollout completed
- [ ] Rollout report

---

### Week 10: Polish & Documentation ⚪ Not Started

#### User Documentation
- [ ] Create "Download AI Model" guide (with screenshots)
- [ ] Create "Using Offline Mode" tutorial
- [ ] Create FAQ document
- [ ] Create video tutorial
- [ ] Translate to Hindi

#### Developer Documentation
- [ ] API documentation (Dartdoc)
- [ ] Architecture documentation
- [ ] Deployment guide
- [ ] Troubleshooting guide
- [ ] Contribution guidelines

#### Code Quality
- [ ] Final code review
- [ ] Refactoring cleanup
- [ ] Remove debug code
- [ ] Optimize imports
- [ ] Update comments

#### Performance Optimization
- [ ] Model preloading on app start
- [ ] Memory optimization
- [ ] Battery optimization
- [ ] Cache optimization

#### Accessibility
- [ ] Screen reader support
- [ ] High contrast mode
- [ ] Keyboard navigation
- [ ] Voice guidance

#### Final Testing
- [ ] Regression testing
- [ ] Accessibility testing
- [ ] Performance testing
- [ ] Security audit

#### Deliveries
- [ ] Complete documentation set
- [ ] All code optimized
- [ ] All tests passing
- [ ] Production ready
- [ ] Post-launch roadmap

---

## Success Metrics Tracking

### Technical Metrics

| Metric | Target | Current | Status |
|--------|--------|---------|--------|
| Model Download Rate | >60% | 0% | ⚪ |
| Offline Usage Rate | >40% | 0% | ⚪ |
| TTFT (Time to First Token) | <1s | - | ⚪ |
| Tokens/Second | >8 | - | ⚪ |
| Crash Rate | <1% | - | ⚪ |
| Battery Drain | <5%/hour | - | ⚪ |
| Memory Usage | <3GB | - | ⚪ |

### User Impact Metrics

| Metric | Target | Current | Status |
|--------|--------|---------|--------|
| Offline Retention | +25% | - | ⚪ |
| Rural User Growth | +40% | - | ⚪ |
| Session Duration | +30% | - | ⚪ |
| User Satisfaction | 4.5+ stars | - | ⚪ |
| Cost Savings | 70% | - | ⚪ |

### Educational Impact

| Metric | Target | Current | Status |
|--------|--------|---------|--------|
| Lesson Plans Generated | 2x | - | ⚪ |
| Daily Active Teachers | +50% | - | ⚪ |
| Student Reach | Measured via surveys | - | ⚪ |

---

## Risk Register

### Active Risks

| Risk | Probability | Impact | Mitigation | Owner | Status |
|------|------------|---------|-----------|-------|--------|
| Poor model quality | Medium | High | A/B test, cloud fallback | Dev Team | Open |
| Device incompatibility | Medium | High | Capability detection, warnings | Dev Team | Open |
| Download failures | Low | Medium | Resume support, WiFi-only | Dev Team | Open |
| Memory crashes | Low | High | Aggressive memory mgmt | Dev Team | Open |
| Battery drain | Medium | Medium | Background restrictions | Dev Team | Open |
| iOS not supported | High | Medium | Keep cloud API, wait for MediaPipe iOS | PM | Accepted |

---

## Notes & Decisions

### Decision Log

| Date | Decision | Rationale | Impact |
|------|----------|-----------|--------|
| 2026-01-16 | Use Gemma 3N-E2B (2B model) for PoC | Smaller size, easier testing | Low risk |
| 2026-01-16 | Hybrid approach (cloud + on-device) | Best of both worlds | High value |
| - | - | - | - |

### Open Questions

- [ ] Should we support model updates over-the-air?
- [ ] Should we allow switching models (E2B vs E4B)?
- [ ] Should we implement LoRA customization in Phase 1?
- [ ] What's the minimum Android version we support?
- [ ] Should we compress the model during download?

---

## Team & Communication

### Team Members
- **Android Developer**: _____________
- **Flutter Developer**: _____________
- **QA Engineer**: _____________
- **DevOps**: _____________
- **PM**: _____________

### Meeting Schedule
- **Daily Standup**: 10:00 AM (15 min)
- **Sprint Planning**: Every 2 weeks (Monday)
- **Sprint Review**: Every 2 weeks (Friday)
- **Retrospective**: Every 2 weeks (Friday)

### Communication Channels
- **Slack**: #mediapipe-llm-integration
- **Jira**: SAHAYAK-XXX
- **GitHub**: feature/mediapipe-llm-integration

---

## Progress Log

### 2026-01-16
- ✅ Created feature branch `feature/mediapipe-llm-integration`
- ✅ Set up task tracking document
- ✅ Saved reference documentation to project
- 🔜 Next: Begin Week 1 PoC tasks

---

**Last Updated**: 2026-01-16  
**Total Tasks**: 100+  
**Completed**: 0  
**In Progress**: 0  
**Blocked**: 0  

---

## Quick Commands

```bash
# Check current status
git status

# View commit history
git log --oneline feature/mediapipe-llm-integration

# Run tests
flutter test

# Check coverage
flutter test --coverage

# Build Android
flutter build apk

# Check for updates
git fetch origin

# Merge from main
git merge main
```
