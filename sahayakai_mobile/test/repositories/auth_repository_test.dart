import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';

import 'package:sahayakai_mobile/src/features/auth/data/auth_repository.dart';
import '../helpers/mocks.dart';

// ─── Additional Mocks ───────────────────────────────────────────────────────

class MockPhoneAuthCredential extends Mock implements PhoneAuthCredential {}

class MockGoogleSignIn extends Mock {}

void main() {
  late MockFirebaseAuth mockAuth;
  late AuthRepository repo;
  late MockUser mockUser;

  setUp(() {
    mockAuth = MockFirebaseAuth();
    repo = AuthRepository(mockAuth);
    mockUser = MockUser();
    registerFallbackValue(MockPhoneAuthCredential());
    registerFallbackValue(Duration.zero);
  });

  group('AuthRepository - currentUser & authStateChanges', () {
    test('currentUser delegates to FirebaseAuth', () {
      when(() => mockAuth.currentUser).thenReturn(mockUser);
      expect(repo.currentUser, mockUser);
    });

    test('currentUser returns null when not signed in', () {
      when(() => mockAuth.currentUser).thenReturn(null);
      expect(repo.currentUser, isNull);
    });

    test('authStateChanges returns the FirebaseAuth stream', () {
      when(() => mockAuth.authStateChanges())
          .thenAnswer((_) => Stream.value(mockUser));
      expect(repo.authStateChanges(), emits(mockUser));
    });

    test('authStateChanges emits null on sign-out', () {
      when(() => mockAuth.authStateChanges())
          .thenAnswer((_) => Stream.value(null));
      expect(repo.authStateChanges(), emits(null));
    });
  });

  group('AuthRepository - getIdToken', () {
    test('returns token when user is signed in', () async {
      when(() => mockAuth.currentUser).thenReturn(mockUser);
      when(() => mockUser.getIdToken(false))
          .thenAnswer((_) async => 'test-token-123');

      final token = await repo.getIdToken();
      expect(token, 'test-token-123');
    });

    test('returns null when no current user', () async {
      when(() => mockAuth.currentUser).thenReturn(null);

      final token = await repo.getIdToken();
      expect(token, isNull);
    });

    test('passes forceRefresh parameter', () async {
      when(() => mockAuth.currentUser).thenReturn(mockUser);
      when(() => mockUser.getIdToken(true))
          .thenAnswer((_) async => 'refreshed-token');

      final token = await repo.getIdToken(forceRefresh: true);
      expect(token, 'refreshed-token');
      verify(() => mockUser.getIdToken(true)).called(1);
    });
  });

  group('AuthRepository - verifyPhoneNumber', () {
    test('delegates all callbacks to FirebaseAuth.verifyPhoneNumber', () async {
      when(() => mockAuth.verifyPhoneNumber(
            phoneNumber: any(named: 'phoneNumber'),
            verificationCompleted: any(named: 'verificationCompleted'),
            verificationFailed: any(named: 'verificationFailed'),
            codeSent: any(named: 'codeSent'),
            codeAutoRetrievalTimeout: any(named: 'codeAutoRetrievalTimeout'),
            forceResendingToken: any(named: 'forceResendingToken'),
            timeout: any(named: 'timeout'),
          )).thenAnswer((_) async {});

      void onVerificationCompleted(PhoneAuthCredential _) {}
      void onVerificationFailed(FirebaseAuthException _) {}
      void onCodeSent(String id, int? token) {}
      void onAutoRetrievalTimeout(String id) {}

      await repo.verifyPhoneNumber(
        phoneNumber: '+919999999999',
        verificationCompleted: onVerificationCompleted,
        verificationFailed: onVerificationFailed,
        codeSent: onCodeSent,
        codeAutoRetrievalTimeout: onAutoRetrievalTimeout,
        forceResendingToken: 42,
      );

      verify(() => mockAuth.verifyPhoneNumber(
            phoneNumber: '+919999999999',
            verificationCompleted: any(named: 'verificationCompleted'),
            verificationFailed: any(named: 'verificationFailed'),
            codeSent: any(named: 'codeSent'),
            codeAutoRetrievalTimeout: any(named: 'codeAutoRetrievalTimeout'),
            forceResendingToken: 42,
            timeout: const Duration(seconds: 60),
          )).called(1);
    });

    test('passes null forceResendingToken when not provided', () async {
      when(() => mockAuth.verifyPhoneNumber(
            phoneNumber: any(named: 'phoneNumber'),
            verificationCompleted: any(named: 'verificationCompleted'),
            verificationFailed: any(named: 'verificationFailed'),
            codeSent: any(named: 'codeSent'),
            codeAutoRetrievalTimeout: any(named: 'codeAutoRetrievalTimeout'),
            forceResendingToken: any(named: 'forceResendingToken'),
            timeout: any(named: 'timeout'),
          )).thenAnswer((_) async {});

      await repo.verifyPhoneNumber(
        phoneNumber: '+919999999999',
        verificationCompleted: (_) {},
        verificationFailed: (_) {},
        codeSent: (_, __) {},
        codeAutoRetrievalTimeout: (_) {},
      );

      verify(() => mockAuth.verifyPhoneNumber(
            phoneNumber: '+919999999999',
            verificationCompleted: any(named: 'verificationCompleted'),
            verificationFailed: any(named: 'verificationFailed'),
            codeSent: any(named: 'codeSent'),
            codeAutoRetrievalTimeout: any(named: 'codeAutoRetrievalTimeout'),
            forceResendingToken: null,
            timeout: const Duration(seconds: 60),
          )).called(1);
    });
  });

  group('AuthRepository - signInWithOtp', () {
    test('creates credential and signs in', () async {
      final mockCredential = MockUserCredential();
      when(() => mockAuth.signInWithCredential(any()))
          .thenAnswer((_) async => mockCredential);

      final result = await repo.signInWithOtp(
        verificationId: 'v-123',
        otp: '654321',
      );

      expect(result, mockCredential);
      verify(() => mockAuth.signInWithCredential(any())).called(1);
    });
  });

  group('AuthRepository - signInWithCredential', () {
    test('delegates to FirebaseAuth.signInWithCredential', () async {
      final mockCredential = MockUserCredential();
      final phoneCredential = MockPhoneAuthCredential();
      when(() => mockAuth.signInWithCredential(any()))
          .thenAnswer((_) async => mockCredential);

      final result = await repo.signInWithCredential(phoneCredential);
      expect(result, mockCredential);
    });
  });

  group('AuthRepository - signOut', () {
    test('calls FirebaseAuth.signOut', () async {
      when(() => mockAuth.signOut()).thenAnswer((_) async {});

      await repo.signOut();

      verify(() => mockAuth.signOut()).called(1);
    });

    // Note: signInWithGoogle and the GoogleSignIn() portion of signOut
    // cannot be unit-tested without injecting a GoogleSignIn dependency.
    // GoogleSignIn() is instantiated inline in the method.
    // These paths require either dependency injection refactoring or
    // integration tests with firebase_auth_mocks.
  });
}
