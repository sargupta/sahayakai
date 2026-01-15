import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

// Provider for the API Client
final apiClientProvider = Provider((ref) => ApiClient());

class ApiClient {
  late final Dio _dio;

  ApiClient() {
    _dio = Dio(
      BaseOptions(
        // For Android Emulator, localhost is 10.0.2.2.
        // For iOS Simulator, it is 127.0.0.1.
        // We use a helper to detect platform or defaulting to Android for now.
        baseUrl: 'http://10.0.2.2:3000/api/v1', 
        connectTimeout: const Duration(seconds: 10),
        receiveTimeout: const Duration(seconds: 10),
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
      ),
    );

    _dio.interceptors.add(
      InterceptorsWrapper(
        onRequest: (options, handler) async {
          // TODO: Get token from FirebaseAuth
          // final user = FirebaseAuth.instance.currentUser;
          // if (user != null) {
          //   final token = await user.getIdToken();
          //   options.headers['Authorization'] = 'Bearer $token';
          // }
          return handler.next(options);
        },
        onError: (DioException e, handler) {
          // Simplify error messages
          String errorMsg = "Something went wrong";
          if (e.response != null) {
             errorMsg = e.response?.data['error'] ?? e.message;
          } else if (e.type == DioExceptionType.connectionError) {
             errorMsg = "No internet connection. Switching to Offline Mode.";
          }
          return handler.next(DioException(
            requestOptions: e.requestOptions, 
            error: errorMsg,
            type: e.type,
            response: e.response
          ));
        },
      ),
    );
  }

  Dio get client => _dio;
}
