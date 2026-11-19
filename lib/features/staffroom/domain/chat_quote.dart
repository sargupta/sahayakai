import 'package:flutter/foundation.dart';

/// A post a teacher replies to from the feed.
///
/// The server keeps no comments, so "Reply" opens the post's group chat with
/// the composer already holding a short quote of the post: the reply is an
/// ordinary chat message that names who and what it answers.
@immutable
class ChatQuote {
  const ChatQuote({required this.author, required this.text});

  /// The post's author, as the feed shows them.
  final String author;

  /// The post's text.
  final String text;

  /// The longest excerpt the draft carries before it is cut at a word.
  static const int maxExcerpt = 120;

  /// The composer's starting text: `↩ Author: “excerpt”` and a new line, so
  /// the teacher types their answer under it.
  String asDraft() {
    final flat = text.trim().replaceAll(RegExp(r'\s+'), ' ');
    var excerpt = flat;
    if (flat.length > maxExcerpt) {
      final cut = flat.substring(0, maxExcerpt);
      final space = cut.lastIndexOf(' ');
      excerpt = '${(space > 40 ? cut.substring(0, space) : cut).trimRight()}…';
    }
    final who = author.trim();
    return who.isEmpty ? '↩ “$excerpt”\n' : '↩ $who: “$excerpt”\n';
  }

  @override
  bool operator ==(Object other) =>
      other is ChatQuote && other.author == author && other.text == text;

  @override
  int get hashCode => Object.hash(author, text);
}

/// What a chat route's `extra` may carry: a title to paint at once and a
/// [ChatQuote] to start the composer from. A plain `String` extra (a group
/// name) is still accepted by the router for older callers.
@immutable
class ChatRouteArgs {
  const ChatRouteArgs({this.title, this.quote});

  final String? title;
  final ChatQuote? quote;
}
