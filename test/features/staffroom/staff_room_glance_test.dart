import 'package:flutter_test/flutter_test.dart';
import 'package:sahayakai/features/staffroom/domain/chat_message.dart';
import 'package:sahayakai/features/staffroom/domain/staff_room_glance.dart';

ChatMessage _m(String id, String author, DateTime at, {String text = 'hi'}) =>
    ChatMessage(
      id: id,
      text: text,
      authorId: author,
      authorName: author,
      createdAt: at.toUtc().toIso8601String(),
    );

void main() {
  final now = DateTime(2026, 11, 19, 12);

  test('counts each author once, today only, newest first', () {
    final glance = glanceAtStaffRoom([
      _m('1', 'asha', DateTime(2026, 11, 19, 9)),
      _m('2', 'ravi', DateTime(2026, 11, 19, 11)),
      _m('3', 'asha', DateTime(2026, 11, 19, 10)),
      _m('4', 'old', DateTime(2026, 11, 18, 20)),
    ], now);
    expect(glance.talkersToday.map((m) => m.authorId), ['ravi', 'asha']);
    expect(glance.latest?.id, '2');
  });

  test('an AI teacher can be the latest message but is never counted', () {
    final glance = glanceAtStaffRoom([
      const ChatMessage(
        id: 'ai',
        text: 'Namaste',
        authorId: 'persona',
        authorName: 'Gurpreet Singh',
        isDemoPersona: true,
      ),
      _m('1', 'asha', DateTime(2026, 11, 19, 9)),
    ], now);
    expect(glance.latest?.id, 'ai');
    expect(glance.talkersToday.map((m) => m.authorId), ['asha']);
  });

  test('yesterday only: nobody talking today, the latest still shows', () {
    final glance = glanceAtStaffRoom([
      _m('1', 'old', DateTime(2026, 11, 18, 20)),
    ], now);
    expect(glance.talkersToday, isEmpty);
    expect(glance.latest?.id, '1');
  });

  test('empty messages are skipped; an empty room has no latest', () {
    expect(glanceAtStaffRoom(const [], now).latest, isNull);
    final glance = glanceAtStaffRoom([
      _m('1', 'asha', DateTime(2026, 11, 19, 9), text: '  '),
    ], now);
    expect(glance.latest, isNull);
    expect(glance.talkersToday, isEmpty);
  });
}
