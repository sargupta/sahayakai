// Platform-specific schema exports
// On web: stub without Isar, on mobile: full Isar schema
export 'lesson_plan_schema_io.dart'
    if (dart.library.js) 'lesson_plan_schema_stub.dart';
