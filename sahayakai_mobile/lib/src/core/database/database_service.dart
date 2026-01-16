import 'package:flutter_riverpod/flutter_riverpod.dart';

// Platform-specific database service implementations
// On web: stub that throws, on mobile: full Isar implementation
import 'database_service_io.dart'
    if (dart.library.js) 'database_service_stub.dart';

export 'database_service_io.dart'
    if (dart.library.js) 'database_service_stub.dart';

final databaseServiceProvider = Provider((ref) => DatabaseService());
