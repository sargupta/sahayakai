/// Typed exception hierarchy for better error handling across the app.
///
/// Screens can pattern-match on these to show contextual error messages.
sealed class AppException implements Exception {
  const AppException(this.userMessage);
  final String userMessage;

  @override
  String toString() => userMessage;
}

/// Network is unreachable (no internet, DNS failure, etc.)
class NetworkException extends AppException {
  const NetworkException([
    super.userMessage = 'No internet connection. Please check your network.',
  ]);
}

/// Backend returned a 5xx error.
class ServerException extends AppException {
  final int statusCode;
  const ServerException(
    this.statusCode, [
    super.userMessage = 'Something went wrong on our end. Please try again.',
  ]);
}

/// Backend returned 401 (token expired or invalid).
class AuthException extends AppException {
  const AuthException([
    super.userMessage = 'Your session has expired. Please sign in again.',
  ]);
}

/// Backend returned 403 or 429 — plan limit exceeded.
class PlanLimitException extends AppException {
  final String? requiredPlan;
  const PlanLimitException({
    this.requiredPlan,
    String message = 'You have reached your plan limit. Upgrade to continue.',
  }) : super(message);
}

/// Backend returned 400/422 — invalid input.
class ValidationException extends AppException {
  final Map<String, dynamic>? fieldErrors;
  const ValidationException({
    this.fieldErrors,
    String message = 'Please check your input and try again.',
  }) : super(message);
}

/// Device is offline and no cached data is available.
class OfflineException extends AppException {
  const OfflineException([
    super.userMessage = 'You are offline. This feature requires an internet connection.',
  ]);
}

/// Request timed out.
class TimeoutException extends AppException {
  const TimeoutException([
    super.userMessage = 'Request timed out. Please try again.',
  ]);
}

/// Content was not found (404).
class NotFoundException extends AppException {
  const NotFoundException([
    super.userMessage = 'The requested content was not found.',
  ]);
}
