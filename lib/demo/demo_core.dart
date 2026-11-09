import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../core/auth/auth_providers.dart';
import '../core/network/api_client.dart';
import '../features/attendance/data/attendance_repository.dart';
import '../features/attendance/data/dto/attendance_dtos.dart';
import '../features/attendance/domain/attendance_class.dart';
import '../features/attendance/domain/attendance_date.dart';
import '../features/attendance/domain/attendance_record.dart';
import '../features/attendance/domain/attendance_write_result.dart';
import '../features/attendance/domain/roster_student.dart';
import '../features/notifications/data/notifications_store.dart';
import '../features/notifications/domain/teacher_notification.dart';
import '../features/parent_hotline/data/dto/outreach_dtos.dart';
import '../features/parent_hotline/data/parent_hotline_repository.dart';
import '../features/parent_hotline/domain/call_summary.dart';
import '../features/parent_hotline/domain/parent_outreach.dart';
import '../features/profile/data/profile_doc_source.dart';
import 'demo_mode.dart';

// ── Sign-in ──────────────────────────────────────────────────────────────────

/// Signed in from the first frame as the demo teacher. Sign-out works (the
/// router sends the teacher to Login), and "Continue with Google" signs her
/// straight back in without Google.
class DemoAuthController extends AuthController {
  @override
  AuthStatus build() => AuthStatus.signedIn;

  @override
  Future<bool> signIn() async {
    state = AuthStatus.signedIn;
    return true;
  }

  @override
  Future<void> signOut() async {
    state = AuthStatus.signedOut;
  }
}

// ── Profile document ─────────────────────────────────────────────────────────

/// The demo teacher's `users/<uid>` document, held in memory so edits on the
/// profile and settings screens stick for the session.
class DemoProfileDocSource implements ProfileDocSource {
  final Map<String, dynamic> _doc = <String, dynamic>{
    'displayName': kDemoTeacherName,
    'email': kDemoTeacherEmail,
    'schoolName': kDemoSchool,
    'state': kDemoState,
    'district': kDemoDistrict,
    'subjects': <String>['Science', 'Mathematics'],
    'gradeLevels': <String>['Class 6', 'Class 7'],
    'preferredLanguage': 'English',
    'pincode': '412207',
    'preferredBoard': 'Maharashtra State Board',
    'educationBoard': 'Maharashtra State Board',
    'qualifications': <String>['B.Sc', 'B.Ed'],
    'administrativeRole': 'teacher',
    'planType': 'pro',
    'impactScore': 128,
  };

  @override
  Future<Map<String, dynamic>?> read() async {
    await Future<void>.delayed(const Duration(milliseconds: 250));
    return Map<String, dynamic>.of(_doc);
  }

  @override
  Future<void> merge(Map<String, dynamic> patch) async {
    await Future<void>.delayed(const Duration(milliseconds: 250));
    patch.forEach((key, value) {
      if (value == null) {
        _doc.remove(key);
      } else {
        _doc[key] = value;
      }
    });
  }
}

// ── Attendance ───────────────────────────────────────────────────────────────

/// One demo student: who they are and which recent school days they missed.
class _DemoStudent {
  const _DemoStudent(
    this.id,
    this.name,
    this.roll,
    this.language,
    this.phoneLast4, {
    this.absentSchoolDaysAgo = const <int>{},
    this.lateSchoolDaysAgo = const <int>{},
  });

  final String id;
  final String name;
  final int roll;
  final String language;
  final String? phoneLast4;

  /// School days before today (1 = the last school day) the child was absent.
  final Set<int> absentSchoolDaysAgo;
  final Set<int> lateSchoolDaysAgo;
}

const List<_DemoStudent> _class7 = <_DemoStudent>[
  _DemoStudent('s7-01', 'Aarav Patil', 1, 'Marathi', '4821'),
  _DemoStudent('s7-02', 'Ananya Jadhav', 2, 'Marathi', '1907'),
  // Three school days in a row: the outreach list's "consecutive absences"
  // case and Home's call reminder.
  _DemoStudent(
    's7-03',
    'Rohan Shinde',
    3,
    'Marathi',
    '6630',
    absentSchoolDaysAgo: <int>{1, 2, 3},
  ),
  _DemoStudent('s7-04', 'Sneha Kulkarni', 4, 'Marathi', '2284'),
  _DemoStudent(
    's7-05',
    'Imran Shaikh',
    5,
    'Hindi',
    '7713',
    absentSchoolDaysAgo: <int>{6},
  ),
  _DemoStudent('s7-06', 'Kavya More', 6, 'Marathi', '5150'),
  _DemoStudent(
    's7-07',
    'Pooja Gaikwad',
    7,
    'Marathi',
    '3392',
    absentSchoolDaysAgo: <int>{4, 9},
  ),
  _DemoStudent('s7-08', 'Siddharth Pawar', 8, 'Marathi', '0418'),
  _DemoStudent(
    's7-09',
    'Fatima Khan',
    9,
    'Hindi',
    '8865',
    lateSchoolDaysAgo: <int>{2, 5},
  ),
  _DemoStudent('s7-10', 'Omkar Deshpande', 10, 'Marathi', '1276'),
  _DemoStudent('s7-11', 'Tanvi Bhosale', 11, 'Marathi', null),
  _DemoStudent('s7-12', 'Yash Chavan', 12, 'Marathi', '9043'),
  _DemoStudent('s7-13', 'Riya Waghmare', 13, 'Marathi', '6157'),
  _DemoStudent('s7-14', 'Aditya Salunkhe', 14, 'Marathi', '2731'),
];

const List<_DemoStudent> _class6 = <_DemoStudent>[
  _DemoStudent('s6-01', 'Aditi Pawar', 1, 'Marathi', '5512'),
  _DemoStudent('s6-02', 'Arjun Kale', 2, 'Marathi', '0094'),
  _DemoStudent('s6-03', 'Neha Sutar', 3, 'Marathi', '7281'),
  _DemoStudent(
    's6-04',
    'Vedant Mane',
    4,
    'Marathi',
    '3349',
    absentSchoolDaysAgo: <int>{0, 1},
  ),
  _DemoStudent('s6-05', 'Sakshi Lokhande', 5, 'Marathi', '6620'),
  _DemoStudent('s6-06', 'Zoya Inamdar', 6, 'Hindi', '1185'),
  _DemoStudent(
    's6-07',
    'Prathamesh Gore',
    7,
    'Marathi',
    '4470',
    absentSchoolDaysAgo: <int>{0},
  ),
  _DemoStudent('s6-08', 'Shravani Nikam', 8, 'Marathi', '9932'),
  _DemoStudent('s6-09', 'Harsh Thorat', 9, 'Marathi', '2058'),
  _DemoStudent('s6-10', 'Mansi Dhumal', 10, 'Marathi', '7746'),
  _DemoStudent('s6-11', 'Kunal Yadav', 11, 'Hindi', '3315'),
  _DemoStudent('s6-12', 'Isha Kamble', 12, 'Marathi', '8801'),
];

/// Attendance for the demo teacher's two classes, held in memory.
///
/// Class 7 A has no register for today yet, so the roll call starts fresh;
/// Class 6 B was marked this morning with two absences, which is what Home's
/// "absentees to call" row and the outreach list pick up. Past school days
/// (Sundays skipped) carry each student's absences, so the month view,
/// summaries and streaks agree with each other.
class DemoAttendanceRepository extends AttendanceRepository {
  DemoAttendanceRepository(ApiClient client, this._clock)
    : super(client, _clock) {
    _seed();
  }

  final DateTime Function() _clock;

  final List<AttendanceClass> _classes = <AttendanceClass>[
    const AttendanceClass(
      id: kDemoClass7Id,
      name: kDemoClass7Name,
      subject: kDemoClass7Subject,
      gradeLevel: 'Class 7',
      academicYear: '2026-27',
      section: 'A',
      studentCount: 14,
    ),
    const AttendanceClass(
      id: kDemoClass6Id,
      name: kDemoClass6Name,
      subject: kDemoClass6Subject,
      gradeLevel: 'Class 6',
      academicYear: '2026-27',
      section: 'B',
      studentCount: 12,
    ),
  ];

  final Map<String, List<RosterStudent>> _rosters =
      <String, List<RosterStudent>>{};

  /// classId → date wire → register.
  final Map<String, Map<String, DailyAttendance>> _registers =
      <String, Map<String, DailyAttendance>>{};

  AttendanceDate get _today => AttendanceDate.fromIstInstant(_clock());

  /// The [n]th school day before today (Sundays are not school days).
  AttendanceDate _schoolDaysAgo(int n) {
    var date = _today;
    var left = n;
    while (left > 0) {
      date = date.addDays(-1);
      if (!_isSunday(date)) left--;
    }
    return date;
  }

  static bool _isSunday(AttendanceDate d) =>
      DateTime.utc(d.year, d.month, d.day).weekday == DateTime.sunday;

  void _seed() {
    void seedClass(String classId, List<_DemoStudent> students, bool today) {
      _rosters[classId] = <RosterStudent>[
        for (final s in students)
          RosterStudent(
            id: s.id,
            name: s.name,
            rollNumber: s.roll,
            parentLanguage: s.language,
            hasParentPhone: s.phoneLast4 != null,
            parentPhoneLast4: s.phoneLast4,
          ),
      ];
      final registers = <String, DailyAttendance>{};
      // Six weeks of school days, so the month view is full and the
      // previous month has data too.
      for (var n = today ? 0 : 1; n <= 36; n++) {
        final date = _schoolDaysAgo(n);
        registers[date.wire] = DailyAttendance(
          classId: classId,
          date: date,
          isFinalized: true,
          submittedAt: DateTime.utc(
            date.year,
            date.month,
            date.day,
            3,
            40,
          ).toIso8601String(),
          statuses: <String, AttendanceStatus>{
            for (final s in students)
              s.id: s.absentSchoolDaysAgo.contains(n)
                  ? AttendanceStatus.absent
                  : s.lateSchoolDaysAgo.contains(n)
                  ? AttendanceStatus.late
                  : AttendanceStatus.present,
          },
        );
      }
      _registers[classId] = registers;
    }

    seedClass(kDemoClass7Id, _class7, false);
    seedClass(kDemoClass6Id, _class6, true);
  }

  Future<void> _pause() =>
      Future<void>.delayed(const Duration(milliseconds: 300));

  @override
  Future<List<AttendanceClass>> listClasses() async {
    await _pause();
    return List<AttendanceClass>.unmodifiable(_classes);
  }

  @override
  Future<AttendanceClass?> getClass(String classId) async {
    await _pause();
    for (final c in _classes) {
      if (c.id == classId) return c;
    }
    return null;
  }

  @override
  Future<AttendanceWriteResult<String>> createClass(
    CreateClassRequestDto request,
  ) async {
    await _pause();
    final id = 'demo-class-${_classes.length + 1}';
    final json = request.toJson();
    _classes.add(
      AttendanceClass(
        id: id,
        name: '${json['name'] ?? 'New class'}',
        subject: '${json['subject'] ?? ''}',
        gradeLevel: '${json['gradeLevel'] ?? ''}',
        academicYear: '${json['academicYear'] ?? '2026-27'}',
        section: json['section'] as String?,
      ),
    );
    _rosters[id] = <RosterStudent>[];
    _registers[id] = <String, DailyAttendance>{};
    return AttendanceWriteAccepted<String>(id);
  }

  @override
  Future<List<RosterStudent>> listRoster(String classId) async {
    await _pause();
    return List<RosterStudent>.unmodifiable(
      _rosters[classId] ?? const <RosterStudent>[],
    );
  }

  @override
  Future<AttendanceWriteResult<String>> addStudent(
    String classId,
    AddStudentRequestDto request,
  ) async {
    await _pause();
    final roster = _rosters.putIfAbsent(classId, () => <RosterStudent>[]);
    final json = request.toJson();
    final id = '$classId-new-${roster.length + 1}';
    final phone = '${json['parentPhone'] ?? ''}';
    roster.add(
      RosterStudent(
        id: id,
        name: '${json['name'] ?? 'New student'}',
        rollNumber: json['rollNumber'] is int
            ? json['rollNumber'] as int
            : roster.length + 1,
        parentLanguage: '${json['parentLanguage'] ?? 'Marathi'}',
        hasParentPhone: phone.length >= 4,
        parentPhoneLast4: phone.length >= 4
            ? phone.substring(phone.length - 4)
            : null,
      ),
    );
    _bumpCount(classId, roster.length);
    return AttendanceWriteAccepted<String>(id);
  }

  void _bumpCount(String classId, int count) {
    final i = _classes.indexWhere((c) => c.id == classId);
    if (i < 0) return;
    final c = _classes[i];
    _classes[i] = AttendanceClass(
      id: c.id,
      name: c.name,
      subject: c.subject,
      gradeLevel: c.gradeLevel,
      academicYear: c.academicYear,
      section: c.section,
      studentCount: count,
    );
  }

  @override
  Future<DailyAttendance?> attendanceOn(
    String classId,
    AttendanceDate date,
  ) async {
    await _pause();
    return _registers[classId]?[date.wire];
  }

  @override
  Future<Map<AttendanceDate, DailyAttendance>> attendanceForMonth(
    String classId, {
    required int year,
    required int month,
  }) async {
    await _pause();
    final out = <AttendanceDate, DailyAttendance>{};
    for (final register in (_registers[classId] ?? const {}).values) {
      if (register.date.year == year && register.date.month == month) {
        out[register.date] = register;
      }
    }
    return out;
  }

  @override
  Future<AttendanceWriteResult<AttendanceDate>> saveAttendance(
    String classId, {
    required AttendanceDate date,
    required Map<String, AttendanceStatus> statuses,
  }) async {
    await _pause();
    _registers.putIfAbsent(
      classId,
      () => <String, DailyAttendance>{},
    )[date.wire] = DailyAttendance(
      classId: classId,
      date: date,
      statuses: Map<String, AttendanceStatus>.of(statuses),
      submittedAt: DateTime.now().toUtc().toIso8601String(),
      isFinalized: true,
    );
    return AttendanceWriteAccepted<AttendanceDate>(date);
  }

  @override
  Future<List<StudentAttendanceSummary>> studentSummaries(
    String classId, {
    required int year,
    required int month,
  }) async {
    await _pause();
    final registers =
        (_registers[classId] ?? const <String, DailyAttendance>{}).values
            .where((r) => r.date.year == year && r.date.month == month)
            .toList()
          ..sort((a, b) => a.date.compareTo(b.date));
    final ordered =
        (_registers[classId] ?? const <String, DailyAttendance>{}).values
            .toList()
          ..sort((a, b) => b.date.compareTo(a.date));
    return <StudentAttendanceSummary>[
      for (final s in _rosters[classId] ?? const <RosterStudent>[])
        _summaryFor(s, registers, ordered),
    ];
  }

  StudentAttendanceSummary _summaryFor(
    RosterStudent s,
    List<DailyAttendance> month,
    List<DailyAttendance> newestFirst,
  ) {
    var present = 0, absent = 0, late = 0, run = 0, longest = 0;
    for (final r in month) {
      switch (r.statuses[s.id]) {
        case AttendanceStatus.present:
          present++;
          run = 0;
        case AttendanceStatus.late:
          late++;
          run = 0;
        case AttendanceStatus.absent:
          absent++;
          run++;
          if (run > longest) longest = run;
        case null:
          break;
      }
    }
    var streak = 0;
    for (final r in newestFirst) {
      if (r.statuses[s.id] == AttendanceStatus.absent) {
        streak++;
      } else if (r.statuses.containsKey(s.id)) {
        break;
      }
    }
    final total = present + absent + late;
    return StudentAttendanceSummary(
      studentId: s.id,
      studentName: s.name,
      rollNumber: s.rollNumber,
      totalDays: total,
      presentDays: present,
      absentDays: absent,
      lateDays: late,
      attendanceRate: total == 0
          ? 100
          : (((present + late) / total) * 100).round(),
      consecutiveAbsences: longest,
      currentAbsenceStreak: streak,
    );
  }

  @override
  Future<List<AttendanceDate>> absenceDates(
    String classId,
    String studentId, {
    int limitDays = 30,
  }) async {
    await _pause();
    final earliest = _today.addDays(-limitDays);
    return <AttendanceDate>[
      for (final r in (_registers[classId] ?? const {}).values)
        if (r.statuses[studentId] == AttendanceStatus.absent &&
            !r.date.isBefore(earliest))
          r.date,
    ]..sort((a, b) => b.compareTo(a));
  }

  @override
  Future<Set<String>> behaviouralOutreachStudentIds(
    String classId, {
    int lookbackDays = 30,
  }) async {
    await _pause();
    return const <String>{};
  }
}

// ── Parent calls ─────────────────────────────────────────────────────────────

/// Parent calls that play out on their own: placing a call starts a clock,
/// each poll reveals more of a realistic conversation, and after about 25
/// seconds the call completes with a summary the parent agreed to.
class DemoParentHotlineRepository extends ParentHotlineRepository {
  DemoParentHotlineRepository(
    super.client, {
    this.callLength = const Duration(seconds: 25),
  });

  /// How long a demo call runs before it completes (shorter in tests).
  final Duration callLength;

  final Map<String, CreateOutreachRequestDto> _outreach =
      <String, CreateOutreachRequestDto>{};
  final Map<String, DateTime> _callStarted = <String, DateTime>{};
  final Map<String, String> _latestByStudent = <String, String>{};

  @override
  Future<String> createOutreach(CreateOutreachRequestDto req) async {
    await Future<void>.delayed(const Duration(milliseconds: 500));
    final id = 'demo-outreach-${_outreach.length + 1}';
    _outreach[id] = req;
    _latestByStudent[req.studentId] = id;
    return id;
  }

  @override
  Future<String> placeCall({
    required String outreachId,
    required String parentLanguage,
  }) async {
    await Future<void>.delayed(const Duration(milliseconds: 700));
    _callStarted[outreachId] = DateTime.now();
    return 'CA-demo-$outreachId';
  }

  @override
  Future<CallResult> pollSummary(String outreachId) async {
    await Future<void>.delayed(const Duration(milliseconds: 200));
    final started = _callStarted[outreachId];
    if (started == null) {
      return const CallResult(callStatus: CallStatus.initiated);
    }
    final req = _outreach[outreachId];
    final turns = _script(req);
    final elapsed = DateTime.now().difference(started);
    final done = elapsed >= callLength;
    final shown = done
        ? turns.length
        : (turns.length * elapsed.inMilliseconds / callLength.inMilliseconds)
              .floor()
              .clamp(0, turns.length - 1);
    final transcript = <TranscriptTurn>[
      for (var i = 0; i < shown; i++)
        TranscriptTurn(
          role: turns[i].$1,
          text: turns[i].$2,
          timestamp: started
              .add(Duration(seconds: i * 3))
              .toUtc()
              .toIso8601String(),
        ),
    ];
    if (!done) {
      return CallResult(
        callStatus: CallStatus.initiated,
        answeredBy: shown > 0 ? 'human' : null,
        turnCount: transcript.length,
        transcript: transcript,
      );
    }
    return CallResult(
      callStatus: CallStatus.completed,
      callDurationSeconds: 94,
      answeredBy: 'human',
      turnCount: transcript.length,
      transcript: transcript,
      callSummary: _summary(req),
    );
  }

  @override
  Future<LatestOutreach?> latestForStudent(String studentId) async {
    await Future<void>.delayed(const Duration(milliseconds: 250));
    final id = _latestByStudent[studentId];
    if (id == null || !_callStarted.containsKey(id)) return null;
    return LatestOutreach(outreachId: id, result: await pollSummary(id));
  }

  static String _first(CreateOutreachRequestDto? req) {
    final name = req?.studentName.trim() ?? '';
    return name.isEmpty ? 'your child' : name.split(' ').first;
  }

  static List<(TranscriptRole, String)> _script(CreateOutreachRequestDto? r) {
    final child = _first(r);
    const teacher = kDemoTeacherName;
    final positive = r?.reason == OutreachReason.positiveFeedback.wire;
    return <(TranscriptRole, String)>[
      (
        TranscriptRole.agent,
        'Namaskar. I am calling on behalf of $teacher, $child\'s class '
            'teacher at $kDemoSchool. Is this a good time to talk for two '
            'minutes?',
      ),
      (TranscriptRole.parent, 'Haan, boliye. Is everything all right?'),
      if (positive) ...<(TranscriptRole, String)>[
        (
          TranscriptRole.agent,
          'Yes, good news. $child scored the highest in the class in the '
              'science unit test and has been helping classmates.',
        ),
        (TranscriptRole.parent, 'Oh, that is wonderful to hear. Thank you.'),
      ] else ...<(TranscriptRole, String)>[
        (
          TranscriptRole.agent,
          '$child has missed school for the last three days, and the class '
              'is starting a new chapter on heat this week.',
        ),
        (
          TranscriptRole.parent,
          'Ji, $child had fever. The doctor said rest till yesterday. '
              '$child will come from tomorrow.',
        ),
        (
          TranscriptRole.agent,
          'I hope $child feels better. The teacher can share the notes so '
              '$child does not fall behind. Can someone collect them?',
        ),
        (
          TranscriptRole.parent,
          'Yes, my elder daughter studies in Class 9 there. She will collect '
              'them today.',
        ),
      ],
      (
        TranscriptRole.agent,
        'Thank you. The teacher will be happy to hear this. Have a good day.',
      ),
      (TranscriptRole.parent, 'Thank you, namaskar.'),
    ];
  }

  static CallSummary _summary(CreateOutreachRequestDto? r) {
    final child = _first(r);
    final positive = r?.reason == OutreachReason.positiveFeedback.wire;
    if (positive) {
      return CallSummary(
        parentResponse:
            'The parent was delighted to hear about $child\'s result and '
            'thanked the teacher.',
        parentCommitments: <String>[
          'Will encourage $child to keep helping classmates.',
        ],
        parentSentiment: ParentSentiment.grateful,
        callQuality: CallQuality.productive,
        generatedAt: DateTime.now().toUtc().toIso8601String(),
      );
    }
    return CallSummary(
      parentResponse:
          '$child was at home with fever for three days and has recovered.',
      parentConcerns: <String>['Missing the start of the chapter on heat.'],
      parentCommitments: <String>[
        '$child will be back in school tomorrow.',
        'An elder sibling will collect the notes today.',
      ],
      actionItemsForTeacher: <String>[
        'Give the elder sibling the notes for Heat, pages 41–46.',
        'Pair $child with a classmate for the first week back.',
      ],
      parentSentiment: ParentSentiment.cooperative,
      callQuality: CallQuality.productive,
      followUpNeeded: true,
      followUpSuggestion:
          'Check on Monday that $child has caught up with the heat chapter.',
      generatedAt: DateTime.now().toUtc().toIso8601String(),
    );
  }
}

// ── Updates ──────────────────────────────────────────────────────────────────

/// The Updates pane, pre-filled with what a teacher's last few days would have
/// produced: a completed call, an absence run and a queued exam paper.
class DemoNotificationsStore extends NotificationsStore {
  @override
  List<TeacherNotification> build() {
    super.build();
    final now = DateTime.now();
    return <TeacherNotification>[
      TeacherNotification(
        id: 'demo-absence-run-s7-03',
        kind: TeacherNotificationKind.absenceRun,
        at: now.subtract(const Duration(hours: 1)),
        label: 'Rohan Shinde',
        className: kDemoClass7Name,
        classId: kDemoClass7Id,
        count: 3,
      ),
      TeacherNotification(
        id: 'demo-call-completed-s7-07',
        kind: TeacherNotificationKind.callCompleted,
        at: now.subtract(const Duration(hours: 20)),
        label: 'Pooja Gaikwad',
      ),
      TeacherNotification(
        id: 'demo-exam-paper-science',
        kind: TeacherNotificationKind.examPaperQueued,
        at: now.subtract(const Duration(days: 2)),
        label: 'Science',
        isRead: true,
      ),
    ];
  }
}

/// The demo teacher's id for every per-teacher seam that otherwise reads
/// `FirebaseAuth.instance` (which has no app in demo mode).
final List<Override> demoIdentityOverrides = <Override>[
  notificationsUserIdProvider.overrideWithValue(kDemoUid),
];
