import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/api_client.dart';
import '../../../core/network/api_exception.dart';
import '../../../core/network/api_providers.dart';
import '../../../core/platform/clock.dart';
import '../domain/attendance_class.dart';
import '../domain/attendance_date.dart';
import '../domain/attendance_record.dart';
import '../domain/attendance_write_result.dart';
import '../domain/roster_student.dart';
import 'attendance_errors.dart';
import 'dto/attendance_dtos.dart';

/// Data-layer gateway for Attendance. Presentation talks to a controller, the
/// controller to this repository, and only this repository touches [ApiClient].
///
/// THE ROUTES ARE ALREADY SHIPPED
///
/// `docs/flutter/forensic/GEMINI_LIVE_AND_PARITY_PROGRAM.md` recorded (2026-07-29)
/// that the mobile attendance build was "BACKEND-BLOCKED … no REST route
/// returns the roster". That was true when it was written and is not true now:
/// the API-boundary migration moved every server action behind
/// `/api/attendance/*`, and all of the routes bound below are on `origin/main`
/// today. That note has been corrected in the same change that added this file.
///
/// The bound routes:
///   • `listClasses`        → GET   `classes`
///   • `createClass`        → POST  `classes`                       (premium)
///   • `getClass`           → GET   `classes/{id}`
///   • `listRoster`         → GET   `classes/{id}/students?projection=roster`
///   • `addStudent`         → POST  `classes/{id}/students`         (premium)
///   • `attendanceOn`       → GET   `classes/{id}/records?date=`
///   • `attendanceForMonth` → GET   `classes/{id}/records?year=&month=`
///   • `saveAttendance`     → POST  `classes/{id}/records`          (premium)
///   • `studentSummaries`   → GET   `classes/{id}/summaries?year=&month=`
///   • `absenceDates`       → GET   `classes/{id}/students/{sid}/absences`
///   • `behaviouralOutreach`→ GET   `classes/{id}/behavioral-outreach`
///
/// THREE SERVER BEHAVIOURS THIS LAYER ENCODES RATHER THAN DISCOVERS
///
/// 1. **Every write is premium-gated.** `requireProPlan` fronts `createClass`,
///    `addStudent` and `saveAttendance`. The three write methods therefore
///    return [AttendanceWriteResult] — a free-plan teacher gets
///    `AttendanceWriteBlockedByPlan` as a value, not an exception, because it is
///    an expected outcome and the register stays readable. Everything else that
///    goes wrong still throws.
///
/// 2. **The markable window is IST.** [saveAttendance] refuses a date outside
///    `[today - 7d, today]` computed in Asia/Kolkata *before* sending, using the
///    same [AttendanceWindow] the UI renders its date strip from. A client that
///    computed "today" from the device clock would offer the wrong day — and
///    would 400 the server for every teacher marking between 00:00 and 05:30
///    IST, which is exactly when the day's register gets caught up on.
///
/// 3. **Forty students, roll numbers 1–40.** `AddStudentRequestDto.build`
///    rejects an out-of-range roll number before a request exists, and
///    `AttendanceClass.isFull` lets a screen disable "add student" instead of
///    apologising after a round trip. The server's transaction (F9-006) remains
///    the authority — it is the only thing that can settle a race.
///
/// Errors are translated by `attendance_errors.dart`; 401 auth and an ownership
/// 403 stay [ApiException], exactly as in `parent_hotline`.
class AttendanceRepository {
  const AttendanceRepository(this._client, this._now);

  final ApiClient _client;

  /// The wall clock, injected through the `nowProvider` seam so the IST window
  /// is testable with a fixed instant. The repository never calls
  /// `DateTime.now()` directly.
  final DateTime Function() _now;

  static const String _classesPath = '/api/attendance/classes';

  /// The masked projection this app is allowed to read (draft PR #124). Sent on
  /// every roster read; the decoder fails closed if the reply is not masked.
  static const String _rosterProjection = 'roster';

  String _classPath(String classId) =>
      '$_classesPath/${Uri.encodeComponent(classId)}';

  String _studentsPath(String classId) => '${_classPath(classId)}/students';

  String _recordsPath(String classId) => '${_classPath(classId)}/records';

  /// The teacher's markable window, in IST, at this instant. The register UI
  /// and [saveAttendance] read the same value, so a date the strip offers is a
  /// date the guard accepts.
  AttendanceWindow get markableWindow => AttendanceWindow.forInstant(_now());

  // ── Classes ────────────────────────────────────────────────────────────────

  /// The caller's own classes, newest first (the server sorts). Read-only, so
  /// no plan gate.
  Future<List<AttendanceClass>> listClasses() {
    return _read(
      () => _client.get<List<AttendanceClass>>(
        _classesPath,
        decode: AttendanceClassDto.decodeList,
      ),
    );
  }

  /// One class. Returns null when the route reports it does not exist (the
  /// service returns `null` rather than 404 for a plain read).
  Future<AttendanceClass?> getClass(String classId) {
    return _read(
      () => _client.get<AttendanceClass?>(
        _classPath(classId),
        decode: (json) => json is Map
            ? AttendanceClassDto.fromJson(
                json.cast<String, dynamic>(),
              ).toDomain()
            : null,
      ),
    );
  }

  /// Creates a class. Premium-gated: a free-plan teacher gets
  /// [AttendanceWriteBlockedByPlan] rather than an exception.
  Future<AttendanceWriteResult<String>> createClass(
    CreateClassRequestDto request,
  ) {
    return _write<String>(() async {
      final id = await _client.post<String>(
        _classesPath,
        data: request.toJson(),
        decode: (json) => CreateClassResponseDto.fromJson(json).id,
      );
      if (id.isEmpty) {
        // A 200 with no id is a malformed success — surface it, don't return "".
        throw const ApiException(
          ApiErrorKind.badResponse,
          'The class could not be created.',
        );
      }
      return id;
    });
  }

  // ── Roster ─────────────────────────────────────────────────────────────────

  /// The class roster in the **masked** projection.
  ///
  /// Always sends `?projection=roster` and always validates that what came back
  /// is masked. If the projection is not available at runtime — the parameter
  /// ignored by an older deployment, or rejected by a newer one — this throws
  /// [RosterProjectionUnavailableException] rather than decoding the unmasked
  /// student documents. Failing closed here is the whole point: the fallback
  /// would be every parent's phone number on the handset, and it would happen
  /// silently.
  Future<List<RosterStudent>> listRoster(String classId) async {
    try {
      return await _client.get<List<RosterStudent>>(
        _studentsPath(classId),
        query: <String, dynamic>{'projection': _rosterProjection},
        decode: RosterStudentDto.decodeList,
      );
    } on ApiException catch (e) {
      // A merged projection route answers an unrecognised `projection` with
      // `400 Invalid query parameters`. On this path that means the deployment
      // does not know `roster` — which is the same fail-closed case as an
      // unmasked body, not a teacher-visible validation problem.
      if (e.statusCode == 400) {
        throw RosterProjectionUnavailableException(
          reason: 'rejected',
          cause: e,
        );
      }
      throw AttendanceException.fromRoute(e) ?? e;
    }
  }

  /// Adds a student. Premium-gated, and capped at 40 per class
  /// transactionally server-side — a `ClassFullException` here means the count
  /// moved under the UI, since `AttendanceClass.isFull` should have disabled
  /// the action first.
  ///
  /// [request] must be built with `AddStudentRequestDto.build`, which enforces
  /// the 1–40 roll-number rule client-side.
  Future<AttendanceWriteResult<String>> addStudent(
    String classId,
    AddStudentRequestDto request,
  ) {
    return _write<String>(() async {
      final id = await _client.post<String>(
        _studentsPath(classId),
        data: request.toJson(),
        decode: (json) => AddStudentResponseDto.fromJson(json).id,
      );
      if (id.isEmpty) {
        throw const ApiException(
          ApiErrorKind.badResponse,
          'The student could not be added.',
        );
      }
      return id;
    });
  }

  // ── Register ───────────────────────────────────────────────────────────────

  /// One day's register, or null when that day has not been marked.
  Future<DailyAttendance?> attendanceOn(String classId, AttendanceDate date) {
    return _read(
      () => _client.get<DailyAttendance?>(
        _recordsPath(classId),
        query: <String, dynamic>{'date': date.wire},
        decode: (json) => DailyAttendanceDto.decodeOne(json, forDate: date),
      ),
    );
  }

  /// A whole month's registers, keyed by date. [month] is 1–12.
  Future<Map<AttendanceDate, DailyAttendance>> attendanceForMonth(
    String classId, {
    required int year,
    required int month,
  }) {
    return _read(
      () => _client.get<Map<AttendanceDate, DailyAttendance>>(
        _recordsPath(classId),
        query: <String, dynamic>{'year': year, 'month': month},
        decode: DailyAttendanceDto.decodeMonth,
      ),
    );
  }

  /// Saves one day's register. Premium-gated.
  ///
  /// Refuses locally, without sending, when [date] is outside the IST window —
  /// see [markableWindow]. The returned value on success is the date that was
  /// saved.
  ///
  /// `async` so that the pre-flight refusal surfaces through the returned
  /// future like every other failure. A `Future`-returning method that throws
  /// *synchronously* would slip past a caller's `.catchError`, and past any
  /// test that awaits it — the error would escape while the arguments were
  /// still being evaluated.
  Future<AttendanceWriteResult<AttendanceDate>> saveAttendance(
    String classId, {
    required AttendanceDate date,
    required Map<String, AttendanceStatus> statuses,
  }) async {
    final window = markableWindow;
    final rejection = window.reject(date);
    if (rejection != null) {
      throw AttendanceDateOutOfWindowException.local(
        rejection: rejection,
        date: date,
        window: window,
      );
    }

    return _write<AttendanceDate>(() async {
      await _client.post<void>(
        _recordsPath(classId),
        data: SaveAttendanceRequestDto(date: date, statuses: statuses).toJson(),
        // The route replies `{ success: true }`; there is nothing to decode.
        decode: (_) {},
      );
      return date;
    });
  }

  /// Per-student monthly rollups. [month] is 1–12.
  Future<List<StudentAttendanceSummary>> studentSummaries(
    String classId, {
    required int year,
    required int month,
  }) {
    return _read(
      () => _client.get<List<StudentAttendanceSummary>>(
        '${_classPath(classId)}/summaries',
        query: <String, dynamic>{'year': year, 'month': month},
        decode: StudentAttendanceSummaryDto.decodeList,
      ),
    );
  }

  // ── Outreach triage signals ────────────────────────────────────────────────

  /// The dates this student was marked absent, newest first, within
  /// [limitDays]. Feeds the parent-hotline evidence panel for the
  /// `consecutive_absences` reason.
  Future<List<AttendanceDate>> absenceDates(
    String classId,
    String studentId, {
    int limitDays = 30,
  }) {
    return _read(
      () => _client.get<List<AttendanceDate>>(
        '${_studentsPath(classId)}/${Uri.encodeComponent(studentId)}/absences',
        query: <String, dynamic>{'limitDays': limitDays},
        decode: (json) => decodeStringList(json)
            .map(AttendanceDate.tryParse)
            .whereType<AttendanceDate>()
            .toList(growable: false),
      ),
    );
  }

  /// Student ids with a `behavioral_concern` outreach inside [lookbackDays] —
  /// the "already contacted recently" set, so the triage banner does not push
  /// the teacher to call the same parent twice.
  Future<Set<String>> behaviouralOutreachStudentIds(
    String classId, {
    int lookbackDays = 30,
  }) {
    return _read(
      () => _client.get<Set<String>>(
        '${_classPath(classId)}/behavioral-outreach',
        query: <String, dynamic>{'lookbackDays': lookbackDays},
        decode: (json) => decodeStringList(json).toSet(),
      ),
    );
  }

  // ── Error translation ──────────────────────────────────────────────────────

  /// Runs a read and translates the transport error. 401, an ownership 403, 5xx
  /// and network failures keep their [ApiException] type.
  Future<T> _read<T>(Future<T> Function() body) async {
    try {
      return await body();
    } on ApiException catch (e) {
      throw AttendanceException.fromRoute(e) ?? e;
    }
  }

  /// Runs a premium-gated write. The plan gate becomes a VALUE
  /// ([AttendanceWriteBlockedByPlan]); every other error is translated and
  /// thrown. See `domain/attendance_write_result.dart` for why the gate is not
  /// an exception.
  Future<AttendanceWriteResult<T>> _write<T>(Future<T> Function() body) async {
    try {
      return AttendanceWriteAccepted<T>(await body());
    } on ApiException catch (e) {
      final mapped = AttendanceException.fromRoute(e);
      if (mapped is PremiumRequiredException) {
        return AttendanceWriteBlockedByPlan<T>(serverMessage: e.message);
      }
      throw mapped ?? e;
    }
  }
}

/// The single [AttendanceRepository] every attendance controller reads.
///
/// A plain [Provider] rather than `@riverpod`: this unit must not run
/// `build_runner` (the parent serialises codegen), so the wiring is written out
/// instead of generated. It composes the same two seams a generated provider
/// would — `apiClientProvider` for transport and `nowProvider` for the IST
/// window — and overriding it in a test is `overrideWithValue`, exactly as with
/// `hotlineStudentRosterProvider`.
final attendanceRepositoryProvider = Provider<AttendanceRepository>(
  (ref) => AttendanceRepository(
    ref.watch(apiClientProvider),
    ref.watch(nowProvider),
  ),
);
