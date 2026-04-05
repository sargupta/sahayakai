import 'package:flutter_test/flutter_test.dart';

import 'package:sahayakai_mobile/src/features/auth/domain/user_profile_model.dart';

void main() {
  group('UserProfileModel', () {
    test('fromJson parses all fields', () {
      final profile = UserProfileModel.fromJson({
        'uid': 'u1',
        'displayName': 'Priya Sharma',
        'email': 'priya@school.in',
        'phoneNumber': '+919876543210',
        'photoURL': 'https://example.com/photo.jpg',
        'schoolName': 'Delhi Public School',
        'gradeLevels': ['Class 7', 'Class 8'],
        'subjects': ['Science', 'Mathematics'],
        'preferredLanguage': 'Hindi',
        'planType': 'pro',
      });

      expect(profile.uid, 'u1');
      expect(profile.displayName, 'Priya Sharma');
      expect(profile.email, 'priya@school.in');
      expect(profile.phoneNumber, '+919876543210');
      expect(profile.gradeLevels, ['Class 7', 'Class 8']);
      expect(profile.planType, 'pro');
    });

    test('fromJson handles phone-only user (no email)', () {
      final profile = UserProfileModel.fromJson({
        'uid': 'u2',
        'displayName': 'Teacher',
        'phoneNumber': '+919999999999',
      });

      expect(profile.email, isNull);
      expect(profile.phoneNumber, '+919999999999');
      expect(profile.planType, 'free'); // default
    });

    test('toJson includes empty email for phone users', () {
      const profile = UserProfileModel(
        uid: 'u3',
        displayName: 'Test',
        phoneNumber: '+91123',
      );

      final json = profile.toJson();
      expect(json['email'], ''); // Empty string, not null
      expect(json['phoneNumber'], '+91123');
    });

    test('toJson omits null photoURL', () {
      const profile = UserProfileModel(uid: 'u4', displayName: 'X');
      final json = profile.toJson();
      expect(json['photoURL'], isNull);
    });

    test('default values are correct', () {
      const profile = UserProfileModel(uid: 'u5', displayName: 'Y');
      expect(profile.gradeLevels, isEmpty);
      expect(profile.subjects, isEmpty);
      expect(profile.preferredLanguage, 'English');
      expect(profile.planType, 'free');
    });
  });
}
