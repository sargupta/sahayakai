import 'package:flutter_test/flutter_test.dart';
import 'package:sahayakai/shared/widgets/avatar_initials.dart';

/// The map's avatar: two initials on a tint that stays with the name.
void main() {
  test('two initials from the first two words', () {
    expect(avatarInitials('Suresh Reddy'), 'SR');
    expect(avatarInitials('  aisha   khan  bano '), 'AK');
    expect(avatarInitials('Deepa'), 'D');
  });

  test('Indic names keep their first letters', () {
    expect(avatarInitials('सुरेश रेड्डी'), 'सर');
  });

  test('an empty name has no initials', () {
    expect(avatarInitials('   '), isNull);
  });

  test('the tint is stable for a name', () {
    expect(avatarTint('Suresh Reddy'), avatarTint(' Suresh Reddy '));
  });
}
