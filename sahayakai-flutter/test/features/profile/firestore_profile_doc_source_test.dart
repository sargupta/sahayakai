import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:fake_cloud_firestore/fake_cloud_firestore.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sahayakai/core/network/api_exception.dart';
import 'package:sahayakai/features/profile/data/profile_doc_source.dart';
import 'package:sahayakai/features/profile/data/profile_dtos.dart';

/// T1-U3's review found `FirestoreProfileDocSource.read()`/`merge()` had no
/// direct test — every screen/repository test bypasses it entirely via
/// `profileDocSourceProvider.overrideWithValue(...)`. These pin the two
/// behaviors the class's own doc comments promise:
///
///   1. `read()` returns `null` (not an error) when the teacher has no
///      `users/<uid>` doc yet — the real, common "onboarding gate is off"
///      case, not a failure.
///   2. `merge()` is a genuine partial merge — it must never clobber fields
///      outside the patch (the whole reason it isn't a plain `set()`).
///
/// `firestore.rules` itself is NOT exercised here (`fake_cloud_firestore`
/// does not evaluate security rules) — rules-shape matching is verified by
/// inspection against `firestore.rules`'s `users/{userId}` block in the
/// class's own doc comments (confirmed by T1-U3's adversarial review).
void main() {
  group('FirestoreProfileDocSource.read', () {
    test('returns null when the teacher has no users/<uid> doc yet',
        () async {
      final source = FirestoreProfileDocSource(FakeFirebaseFirestore(), 'u1');
      expect(await source.read(), isNull);
    });

    test('returns the real document data when it exists', () async {
      final firestore = FakeFirebaseFirestore();
      await firestore.collection('users').doc('u1').set({
        'displayName': 'Priya Sharma',
        'schoolName': 'Govt Model School',
        'impactScore': 42,
      });

      final source = FirestoreProfileDocSource(firestore, 'u1');
      final data = await source.read();

      expect(data, isNotNull);
      expect(data!['displayName'], 'Priya Sharma');
      expect(data['schoolName'], 'Govt Model School');
    });

    test('reads only my own uid\'s document, never another\'s', () async {
      final firestore = FakeFirebaseFirestore();
      await firestore
          .collection('users')
          .doc('other-uid')
          .set({'displayName': 'Not Me'});

      final source = FirestoreProfileDocSource(firestore, 'u1');
      expect(await source.read(), isNull);
    });
  });

  group('FirestoreProfileDocSource.merge', () {
    test('a merge on a brand-new doc creates it with only the patched keys',
        () async {
      final firestore = FakeFirebaseFirestore();
      final source = FirestoreProfileDocSource(firestore, 'u1');

      await source.merge({'displayName': 'Priya Sharma'});

      final doc = await firestore.collection('users').doc('u1').get();
      expect(doc.exists, isTrue);
      expect(doc.data()!['displayName'], 'Priya Sharma');
    });

    test(
        'merge never clobbers existing fields outside the patch — '
        'this is the entire reason it is not a plain set()', () async {
      final firestore = FakeFirebaseFirestore();
      await firestore.collection('users').doc('u1').set({
        'displayName': 'Priya Sharma',
        'impactScore': 42,
        'badges': ['first-lesson-plan'],
        'planType': 'pro',
      });

      final source = FirestoreProfileDocSource(firestore, 'u1');
      // A Settings-style patch touching only its own slice.
      await source.merge({'schoolName': 'New School Name'});

      final doc = await firestore.collection('users').doc('u1').get();
      final data = doc.data()!;
      expect(data['schoolName'], 'New School Name');
      // Server-owned fields this app must never touch, per the class's own
      // doc comment — still exactly as they were.
      expect(data['displayName'], 'Priya Sharma');
      expect(data['impactScore'], 42);
      expect(data['badges'], ['first-lesson-plan']);
      expect(data['planType'], 'pro');
    });

    test('two sequential merges each only touch their own keys', () async {
      final firestore = FakeFirebaseFirestore();
      final source = FirestoreProfileDocSource(firestore, 'u1');

      await source.merge({'displayName': 'Priya Sharma'});
      await source.merge({'schoolName': 'Govt Model School'});

      final doc = await firestore.collection('users').doc('u1').get();
      final data = doc.data()!;
      expect(data['displayName'], 'Priya Sharma');
      expect(data['schoolName'], 'Govt Model School');
    });

    test('U15: a clear-marker DELETES the field server-side, not just omits it',
        () async {
      final firestore = FakeFirebaseFirestore();
      await firestore.collection('users').doc('u1').set({
        'displayName': 'Priya Sharma',
        'schoolName': 'Old School',
        'impactScore': 42,
      });

      final source = FirestoreProfileDocSource(firestore, 'u1');
      // What TeacherProfileDocPatch emits for a field the teacher erased.
      await source.merge({'schoolName': kProfileFieldClear});

      final data = (await firestore.collection('users').doc('u1').get()).data()!;
      // The cleared field is GONE (so it reads back as "not set"), while every
      // untouched field — including protected ones — is left exactly as it was.
      expect(data.containsKey('schoolName'), isFalse);
      expect(data['displayName'], 'Priya Sharma');
      expect(data['impactScore'], 42);
    });
  });

  group('U15: applyProfileFieldClears', () {
    test('translates the clear sentinel into FieldValue.delete()', () {
      final out = applyProfileFieldClears({
        'schoolName': kProfileFieldClear,
        'preferredBoard': kProfileFieldClear,
      });

      expect(out['schoolName'], isA<FieldValue>());
      expect(out['preferredBoard'], isA<FieldValue>());
    });

    test('passes every non-sentinel value through untouched', () {
      final out = applyProfileFieldClears({
        'displayName': 'Priya',
        'subjects': ['Science'],
        'schoolName': kProfileFieldClear,
      });

      expect(out['displayName'], 'Priya');
      expect(out['subjects'], ['Science']);
      expect(out['schoolName'], isA<FieldValue>());
    });
  });

  group('SignedOutProfileDocSource', () {
    test('read() throws the typed 401, never an invented profile', () async {
      const source = SignedOutProfileDocSource();
      await expectLater(
        source.read,
        throwsA(isA<ApiException>()
            .having((e) => e.kind, 'kind', ApiErrorKind.unauthorized)),
      );
    });

    test('merge() throws the same typed 401', () async {
      const source = SignedOutProfileDocSource();
      await expectLater(
        () => source.merge({'displayName': 'x'}),
        throwsA(isA<ApiException>()
            .having((e) => e.kind, 'kind', ApiErrorKind.unauthorized)),
      );
    });
  });
}
