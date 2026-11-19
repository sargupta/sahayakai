import 'package:flutter_test/flutter_test.dart';
import 'package:sahayakai/features/staffroom/domain/chat_quote.dart';

void main() {
  test('a short post is quoted whole, with the author', () {
    const quote = ChatQuote(author: 'Lata Joshi', text: 'Any game for ½ and ¼?');
    expect(quote.asDraft(), '↩ Lata Joshi: “Any game for ½ and ¼?”\n');
  });

  test('a long post is cut at a word, with an ellipsis', () {
    final long = List.filled(40, 'fraction').join(' ');
    final draft = const ChatQuote(author: 'A', text: '').asDraft();
    expect(draft, '↩ “”\n'.replaceFirst('↩ “”', '↩ A: “”'));
    final cut = ChatQuote(author: 'A', text: long).asDraft();
    expect(cut.endsWith('…”\n'), isTrue);
    expect(cut.length, lessThan(ChatQuote.maxExcerpt + 12));
    expect(cut.contains('fractio…'), isFalse);
  });

  test('line breaks in the post become spaces', () {
    const quote = ChatQuote(author: '', text: 'one\n\ntwo');
    expect(quote.asDraft(), '↩ “one two”\n');
  });
}
