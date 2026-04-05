/// Dart model matching the backend UserProfile schema.
/// Only includes fields the mobile app needs for onboarding and display.
class UserProfileModel {
  final String uid;
  final String displayName;
  final String? email;
  final String? phoneNumber;
  final String? photoURL;
  final String? schoolName;
  final List<String> gradeLevels;
  final List<String> subjects;
  final String preferredLanguage;
  final String planType;

  const UserProfileModel({
    required this.uid,
    required this.displayName,
    this.email,
    this.phoneNumber,
    this.photoURL,
    this.schoolName,
    this.gradeLevels = const [],
    this.subjects = const [],
    this.preferredLanguage = 'English',
    this.planType = 'free',
  });

  Map<String, dynamic> toJson() => {
        'uid': uid,
        'email': email ?? '',
        'phoneNumber': phoneNumber,
        'displayName': displayName,
        'photoURL': photoURL,
        'schoolName': schoolName,
        'gradeLevels': gradeLevels,
        'subjects': subjects,
        'preferredLanguage': preferredLanguage,
      };

  factory UserProfileModel.fromJson(Map<String, dynamic> json) =>
      UserProfileModel(
        uid: json['uid'] as String? ?? '',
        displayName: json['displayName'] as String? ?? '',
        email: json['email'] as String?,
        phoneNumber: json['phoneNumber'] as String?,
        photoURL: json['photoURL'] as String?,
        schoolName: json['schoolName'] as String?,
        gradeLevels: List<String>.from(json['gradeLevels'] ?? []),
        subjects: List<String>.from(json['subjects'] ?? []),
        preferredLanguage: json['preferredLanguage'] as String? ?? 'English',
        planType: json['planType'] as String? ?? 'free',
      );
}
