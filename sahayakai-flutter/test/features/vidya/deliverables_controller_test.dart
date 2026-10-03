import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sahayakai/features/vidya/domain/deliverable.dart';
import 'package:sahayakai/features/vidya/presentation/deliverables_controller.dart';

/// The single source of truth behind the orb's green "ready" count and the
/// deliver tray's payloads (v3 07 → 08).

Deliverable _d(String id) => Deliverable(id: id, title: 'T$id', text: 'body $id');

ProviderContainer _container() {
  final c = ProviderContainer();
  addTearDown(c.dispose);
  return c;
}

void main() {
  test('starts empty', () {
    final c = _container();
    expect(c.read(deliverablesControllerProvider), isEmpty);
    expect(c.read(deliverablesControllerProvider.notifier).latest, isNull);
  });

  test('add appends and latest is the most recent', () {
    final c = _container();
    final n = c.read(deliverablesControllerProvider.notifier);
    n.add(_d('1'));
    n.add(_d('2'));
    expect(c.read(deliverablesControllerProvider), hasLength(2));
    expect(n.latest?.id, '2');
  });

  test('add is idempotent on id (no double-count for the orb badge)', () {
    final c = _container();
    final n = c.read(deliverablesControllerProvider.notifier);
    n.add(_d('1'));
    n.add(_d('1'));
    expect(c.read(deliverablesControllerProvider), hasLength(1));
  });

  test('remove drops one by id', () {
    final c = _container();
    final n = c.read(deliverablesControllerProvider.notifier);
    n.add(_d('1'));
    n.add(_d('2'));
    n.remove('1');
    final list = c.read(deliverablesControllerProvider);
    expect(list, hasLength(1));
    expect(list.single.id, '2');
  });

  test('remove of an unknown id is a no-op', () {
    final c = _container();
    final n = c.read(deliverablesControllerProvider.notifier);
    n.add(_d('1'));
    n.remove('nope');
    expect(c.read(deliverablesControllerProvider), hasLength(1));
  });

  test('clear empties everything', () {
    final c = _container();
    final n = c.read(deliverablesControllerProvider.notifier);
    n.add(_d('1'));
    n.add(_d('2'));
    n.clear();
    expect(c.read(deliverablesControllerProvider), isEmpty);
  });

  test('deliverable equality is by id', () {
    expect(_d('1'), equals(_d('1')));
    expect(_d('1'), isNot(equals(_d('2'))));
  });
}
