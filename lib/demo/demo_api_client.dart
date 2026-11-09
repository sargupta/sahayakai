import 'package:dio/dio.dart';

import '../core/network/api_client.dart';
import '../core/network/api_exception.dart';

/// The demo build's [ApiClient]: answers the routes the app reads directly
/// through the client (library, plan usage, VIDYA, marks, profile save) from
/// static sample data, and never opens a socket.
///
/// The repositories with richer behaviour (attendance, parent calls, the AI
/// tools, Community) are replaced whole in their own demo files, so they never
/// reach this client. Anything that still does and has no sample here fails
/// the way an offline request would — loudly, with the route in the message —
/// instead of inventing a response.
class DemoApiClient extends ApiClient {
  DemoApiClient() : super();

  static const Duration _latency = Duration(milliseconds: 350);

  @override
  Future<T> get<T>(
    String path, {
    Map<String, dynamic>? query,
    required T Function(dynamic json) decode,
  }) async {
    await Future<void>.delayed(_latency);
    if (path == '/api/content/list') {
      final items = _libraryItems();
      final limit = query?['limit'];
      final take = limit is int && limit > 0 ? limit : items.length;
      final page = items.take(take).toList();
      return decode(<String, dynamic>{
        'items': page,
        'count': page.length,
        'nextCursor': null,
      });
    }
    if (path == '/api/content/get') {
      final id = query?['id'];
      final all = _libraryItems();
      for (final item in all) {
        if (item['id'] == id) return decode(item);
      }
      throw const ApiException(
        ApiErrorKind.notFound,
        'This item is no longer in your library.',
        statusCode: 404,
      );
    }
    if (path == '/api/usage') return decode(_usage);
    if (path == '/api/vidya/session') {
      return decode(const <String, dynamic>{
        'sessionId': null,
        'messages': <Object>[],
      });
    }
    if (path == '/api/vidya/profile') {
      return decode(const <String, dynamic>{'profile': null});
    }
    if (path.startsWith('/api/performance/student/')) {
      return decode(_marksFor(path.split('/').last));
    }
    throw _noSample('GET', path);
  }

  @override
  Future<T> post<T>(
    String path, {
    Object? data,
    required T Function(Map<String, dynamic> json) decode,
  }) async {
    await Future<void>.delayed(_latency);
    switch (path) {
      case '/api/assistant':
        await Future<void>.delayed(const Duration(milliseconds: 900));
        return decode(_assistantReply(data));
      case '/api/tts':
        // No audio in demo mode: VIDYA shows her reply as text instead.
        return decode(const <String, dynamic>{'audioContent': ''});
      case '/api/vidya/session':
      case '/api/vidya/profile':
        return decode(const <String, dynamic>{'success': true});
    }
    throw _noSample('POST', path);
  }

  @override
  Future<T> patch<T>(
    String path, {
    Object? data,
    required T Function(Map<String, dynamic> json) decode,
  }) async {
    await Future<void>.delayed(_latency);
    if (path == '/api/user/profile') {
      return decode(const <String, dynamic>{'success': true});
    }
    throw _noSample('PATCH', path);
  }

  @override
  Future<T> put<T>(
    String path, {
    Object? data,
    required T Function(Map<String, dynamic> json) decode,
  }) async {
    await Future<void>.delayed(_latency);
    throw _noSample('PUT', path);
  }

  @override
  Future<RawResponse> postRaw(String path, {Object? data}) async {
    await Future<void>.delayed(_latency);
    throw _noSample('POST', path);
  }

  @override
  Future<T> postMultipart<T>(
    String path, {
    required FormData data,
    required T Function(Map<String, dynamic> json) decode,
  }) async {
    await Future<void>.delayed(const Duration(milliseconds: 900));
    if (path.contains('voice-to-text')) {
      // What a teacher typically asks the orb, so the demo can show the whole
      // speak → plan → tool hand-off without a speech service.
      return decode(const <String, dynamic>{
        'text': 'Make a lesson plan on photosynthesis for Class 7',
        'language': 'en',
      });
    }
    throw _noSample('POST', path);
  }

  ApiException _noSample(String verb, String path) => ApiException(
    ApiErrorKind.network,
    'Demo mode has no sample data for $verb $path.',
  );
}

// ── VIDYA ────────────────────────────────────────────────────────────────────

/// A canned VIDYA turn. A request that names a tool gets the real hand-off
/// shape (`NAVIGATE_AND_FILL`), so the demo shows VIDYA opening the tool with
/// the topic filled in; anything else gets a short, honest answer.
Map<String, dynamic> _assistantReply(Object? data) {
  final message = data is Map ? '${data['message'] ?? ''}' : '';
  final lower = message.toLowerCase();
  final topic = _topicFrom(lower);

  Map<String, dynamic> navigate(String flow, String reply) => <String, dynamic>{
    'response': reply,
    'action': <String, dynamic>{
      'type': 'NAVIGATE_AND_FILL',
      'flow': flow,
      'params': <String, dynamic>{
        'topic': topic,
        'gradeLevel': 'Class 7',
        'subject': 'Science',
        'language': 'English',
      },
    },
  };

  if (lower.contains('quiz') || lower.contains('test')) {
    return navigate(
      'quiz-generator',
      'Opening the quiz maker for $topic, Class 7.',
    );
  }
  if (lower.contains('worksheet')) {
    return navigate(
      'worksheet-wizard',
      'Opening the worksheet wizard for $topic.',
    );
  }
  if (lower.contains('rubric')) {
    return navigate('rubric-generator', 'Opening the rubric maker for $topic.');
  }
  if (lower.contains('lesson') || lower.contains('plan')) {
    return navigate(
      'lesson-plan',
      'Opening the lesson planner for $topic, Class 7.',
    );
  }
  if (lower.contains('attendance') || lower.contains('roll')) {
    return const <String, dynamic>{
      'response':
          'Your Class 7 A roll call is ready on Home. Tap "Roll call" and read '
          'the names aloud, or tap each row.',
    };
  }
  return <String, dynamic>{
    'response':
        'I can plan a lesson, make a quiz or worksheet, take the roll call or '
        'call a parent. Try "Make a quiz on $topic for Class 7".',
  };
}

String _topicFrom(String lower) {
  const topics = <String, String>{
    'photosynth': 'Photosynthesis',
    'fraction': 'Fractions',
    'water cycle': 'The water cycle',
    'nutrition': 'Nutrition in plants',
    'heat': 'Heat',
    'acid': 'Acids, bases and salts',
    'motion': 'Motion and time',
  };
  for (final entry in topics.entries) {
    if (lower.contains(entry.key)) return entry.value;
  }
  return 'Photosynthesis';
}

// ── Plan and usage ───────────────────────────────────────────────────────────

const Map<String, dynamic> _usage = <String, dynamic>{
  'plan': 'pro',
  'canExport': true,
  'canViewDetailedAnalytics': true,
  'canAccessAbsenceRecords': true,
  'canUseParentMessaging': true,
  'model': 'Gemini 2.5 Flash',
  'usage': <String, dynamic>{
    'lesson-plan': <String, int>{'used': 18, 'limit': 100},
    'quiz': <String, int>{'used': 9, 'limit': 100},
    'worksheet': <String, int>{'used': 6, 'limit': 60},
    'assessment-scanner': <String, int>{'used': 34, 'limit': 200},
    'parent-message': <String, int>{'used': 5, 'limit': 50},
    'rubric': <String, int>{'used': 2, 'limit': -1},
    'instant-answer': <String, int>{'used': 23, 'limit': -1},
    'assistant': <String, int>{'used': 41, 'limit': 300},
    'voice-to-text': <String, int>{'used': 27, 'limit': 300},
  },
};

// ── Marks the parent-call evidence step cites ────────────────────────────────

Map<String, dynamic> _marksFor(String studentId) {
  // A stable, per-student spread so each child's evidence differs.
  final seed = studentId.codeUnits.fold<int>(0, (a, b) => a + b);
  String date(int daysAgo) {
    final d = DateTime.now().subtract(Duration(days: daysAgo));
    final mm = d.month.toString().padLeft(2, '0');
    final dd = d.day.toString().padLeft(2, '0');
    return '${d.year}-$mm-$dd';
  }

  Map<String, dynamic> mark(
    String id,
    String subject,
    String name,
    int got,
    int max,
    int daysAgo,
  ) => <String, dynamic>{
    'id': id,
    'subject': subject,
    'name': name,
    'marksObtained': got,
    'maxMarks': max,
    'date': date(daysAgo),
  };

  return <String, dynamic>{
    'assessments': <Map<String, dynamic>>[
      mark(
        'a1',
        'Science',
        'Unit test: Nutrition in plants',
        9 + seed % 9,
        20,
        6,
      ),
      mark('a2', 'Science', 'Class quiz: Heat', 5 + seed % 5, 10, 13),
      mark('a3', 'Mathematics', 'Unit test: Fractions', 11 + seed % 8, 25, 20),
    ],
  };
}

// ── My work ──────────────────────────────────────────────────────────────────

String _ago(Duration d) => DateTime.now().subtract(d).toUtc().toIso8601String();

List<Map<String, dynamic>> _libraryItems() {
  Map<String, dynamic> item({
    required String id,
    required String type,
    required String title,
    required String gradeLevel,
    required String subject,
    required String topic,
    required Duration age,
    Object? data,
  }) => <String, dynamic>{
    'id': id,
    'type': type,
    'title': title,
    'gradeLevel': gradeLevel,
    'subject': subject,
    'topic': topic,
    'language': 'English',
    'isPublic': false,
    'isDraft': false,
    'createdAt': _ago(age),
    'updatedAt': _ago(age),
    'data': ?data,
  };

  return <Map<String, dynamic>>[
    item(
      id: 'demo-lib-photosynthesis',
      type: 'lesson-plan',
      title: 'Photosynthesis: how leaves make food',
      gradeLevel: 'Class 7',
      subject: 'Science',
      topic: 'Photosynthesis',
      age: const Duration(hours: 3),
      data: _photosynthesisPlan,
    ),
    item(
      id: 'demo-lib-heat-quiz',
      type: 'quiz',
      title: 'Heat: conduction, convection, radiation',
      gradeLevel: 'Class 7',
      subject: 'Science',
      topic: 'Heat',
      age: const Duration(days: 1, hours: 2),
      data: _heatQuiz,
    ),
    item(
      id: 'demo-lib-fractions',
      type: 'lesson-plan',
      title: 'Fractions with roti and paper strips',
      gradeLevel: 'Class 6',
      subject: 'Mathematics',
      topic: 'Fractions',
      age: const Duration(days: 2, hours: 5),
      data: _fractionsPlan,
    ),
    item(
      id: 'demo-lib-water-cycle-answer',
      type: 'instant-answer',
      title: 'Why does a cold glass of water "sweat"?',
      gradeLevel: 'Class 7',
      subject: 'Science',
      topic: 'The water cycle',
      age: const Duration(days: 3),
    ),
    item(
      id: 'demo-lib-decimals-worksheet',
      type: 'worksheet',
      title: 'Decimals on a number line',
      gradeLevel: 'Class 6',
      subject: 'Mathematics',
      topic: 'Decimals',
      age: const Duration(days: 5),
    ),
    item(
      id: 'demo-lib-project-rubric',
      type: 'rubric',
      title: 'Science model project rubric',
      gradeLevel: 'Class 7',
      subject: 'Science',
      topic: 'Project work',
      age: const Duration(days: 8),
    ),
  ];
}

const Map<String, dynamic> _photosynthesisPlan = <String, dynamic>{
  'title': 'Photosynthesis: how leaves make food',
  'gradeLevel': 'Class 7',
  'subject': 'Science',
  'duration': '40 minutes',
  'language': 'English',
  'objectives': <String>[
    'Explain that green leaves make food using sunlight, water and air.',
    'Name chlorophyll and stomata and say what each does.',
    'Show starch in a leaf with a simple iodine test.',
  ],
  'keyVocabulary': <Map<String, String>>[
    <String, String>{
      'term': 'Chlorophyll',
      'meaning': 'The green pigment in leaves that traps sunlight.',
    },
    <String, String>{
      'term': 'Stomata',
      'meaning': 'Tiny pores on a leaf through which air goes in and out.',
    },
    <String, String>{
      'term': 'Starch',
      'meaning': 'The food the leaf stores; turns blue-black with iodine.',
    },
  ],
  'materials': <String>[
    'A potted plant kept in sunlight and one kept in a dark cupboard for 2 days',
    'Tincture iodine from the school first-aid box',
    'Two leaves, a spirit lamp, a beaker of water, a dropper',
    'Chart paper and sketch pens',
  ],
  'activities': <Map<String, String>>[
    <String, String>{
      'phase': 'Engage',
      'name': 'Where does a mango tree get its food?',
      'description':
          'Ask the class to list what they eat and where it comes from. Then '
          'ask: a mango tree never eats, so how does it grow so big?',
      'duration': '5 min',
      'teacherTips':
          'Write every guess on the board; return to them at the end.',
    },
    <String, String>{
      'phase': 'Explore',
      'name': 'Sun leaf vs dark leaf',
      'description':
          'Boil one leaf from each plant in water, then in spirit to remove the '
          'green colour, and add two drops of iodine. Groups record what they '
          'see.',
      'duration': '15 min',
      'teacherTips':
          'You do the boiling; groups of five watch and draw. Keep the spirit '
          'away from the flame.',
      'understandingCheck':
          'Which leaf turned blue-black, and what does that tell us?',
    },
    <String, String>{
      'phase': 'Explain',
      'name': 'The leaf kitchen',
      'description':
          'Draw a leaf as a kitchen: sunlight is the stove, chlorophyll the '
          'cook, water and carbon dioxide the ingredients, starch the food.',
      'duration': '10 min',
    },
    <String, String>{
      'phase': 'Evaluate',
      'name': 'Exit question',
      'description':
          'Each student writes one sentence: why did the dark leaf not turn '
          'blue-black?',
      'duration': '5 min',
    },
  ],
  'assessment':
      'Exit slips: a correct answer mentions that no sunlight means no food '
      '(starch) was made.',
  'homework':
      'Cover part of a leaf on a plant at home with black paper for two days, '
      'then compare its colour with the rest of the leaf.',
};

const Map<String, dynamic> _fractionsPlan = <String, dynamic>{
  'title': 'Fractions with roti and paper strips',
  'gradeLevel': 'Class 6',
  'subject': 'Mathematics',
  'duration': '35 minutes',
  'language': 'English',
  'objectives': <String>[
    'Read and write a fraction as part of a whole.',
    'Compare two fractions with the same denominator.',
  ],
  'materials': <String>[
    'Strips of old newspaper, all the same length',
    'A drawing of a roti on the board',
  ],
  'activities': <Map<String, String>>[
    <String, String>{
      'phase': 'Engage',
      'name': 'Sharing a roti',
      'description':
          'Four friends share one roti equally. How much does each get? Shade '
          'it on the board.',
      'duration': '5 min',
    },
    <String, String>{
      'phase': 'Explore',
      'name': 'Fold the strips',
      'description':
          'Students fold strips into halves, quarters and eighths, label each '
          'part and line them up to compare.',
      'duration': '15 min',
      'understandingCheck': 'Which is bigger, 3/8 or 5/8? Show it with strips.',
    },
    <String, String>{
      'phase': 'Practise',
      'name': 'Board race',
      'description':
          'Two teams write the fraction shaded in pictures you draw; first '
          'correct answer wins the point.',
      'duration': '10 min',
    },
  ],
  'assessment': 'Five quick questions on comparing like fractions.',
  'homework': 'Find three things at home that are cut into equal parts.',
};

const Map<String, dynamic> _heatQuiz = <String, dynamic>{
  'topic': 'Heat',
  'gradeLevel': 'Class 7',
  'subject': 'Science',
  'easy': <String, dynamic>{
    'title': 'Heat: warm-up',
    'gradeLevel': 'Class 7',
    'subject': 'Science',
    'teacherInstructions': 'Read each question aloud once.',
    'questions': <Map<String, dynamic>>[
      <String, dynamic>{
        'questionText': 'Which of these is a good conductor of heat?',
        'questionType': 'multiple_choice',
        'options': <String>['Wood', 'Plastic', 'Steel', 'Cloth'],
        'correctAnswer': 'Steel',
        'explanation': 'Metals like steel let heat pass through them easily.',
        'difficultyLevel': 'easy',
      },
      <String, dynamic>{
        'questionText':
            'Heat always flows from a hotter object to a cooler one.',
        'questionType': 'true_false',
        'options': <String>['True', 'False'],
        'correctAnswer': 'True',
        'explanation': 'Heat moves until both objects are equally warm.',
        'difficultyLevel': 'easy',
      },
    ],
  },
  'medium': <String, dynamic>{
    'title': 'Heat: in daily life',
    'gradeLevel': 'Class 7',
    'subject': 'Science',
    'questions': <Map<String, dynamic>>[
      <String, dynamic>{
        'questionText': 'Why do we wear light-coloured clothes in summer?',
        'questionType': 'short_answer',
        'correctAnswer':
            'Light colours reflect most of the heat that falls on them.',
        'explanation': 'Dark colours absorb more heat.',
        'difficultyLevel': 'medium',
      },
      <String, dynamic>{
        'questionText': 'The land breeze blows from land to sea at ________.',
        'questionType': 'fill_in_the_blanks',
        'correctAnswer': 'night',
        'explanation': 'At night the land cools faster than the sea.',
        'difficultyLevel': 'medium',
      },
    ],
  },
  'hard': <String, dynamic>{
    'title': 'Heat: think it through',
    'gradeLevel': 'Class 7',
    'subject': 'Science',
    'questions': <Map<String, dynamic>>[
      <String, dynamic>{
        'questionText':
            'A steel spoon and a wooden spoon stand in hot tea. After a minute, '
            'which handle feels hotter, and why?',
        'questionType': 'short_answer',
        'correctAnswer':
            'The steel spoon, because steel conducts heat and wood is an '
            'insulator.',
        'difficultyLevel': 'hard',
      },
    ],
  },
};
