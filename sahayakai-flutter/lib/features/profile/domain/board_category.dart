import '../../../shared/domain/picker_options.dart';

/// The coarse board family a teacher picks BEFORE the exact board, so the
/// 29-entry [kEducationBoards] list becomes a 2-or-27 item choice instead of a
/// wall of names.
///
/// NOT A PERSISTED FIELD — verified against the backend, deliberately.
/// `SCREEN_INVENTORY.md` P0.2 lists `boardCategory` as a profile field, but it
/// is written by nothing and stored by nothing:
///   - it is absent from `UserProfileSchema` (so `POST /api/user/profile`
///     zod-strips it),
///   - it is absent from the `PATCH /api/user/profile` allowlist,
///   - it is absent from `PROFILE_WRITABLE_FIELDS` (the server action) AND from
///     the adapter's `CLIENT_EDITABLE_USER_FIELDS`,
///   - the web's own `onboarding/page.tsx` keeps it in local React state and
///     never puts it in the save payload.
/// It is a cascading-picker helper, not data. Modelling it as a saved field
/// would invent a value the server would silently drop — the same class of bug
/// as sending `educationBoard` instead of `preferredBoard`. So it lives here as
/// pure UI state, derived from the board on read via [ofBoard].
enum BoardCategory {
  cbse,
  icse,
  stateBoard;

  /// The boards offered once this category is chosen. CBSE and ICSE are single
  /// national boards; everything else is the state list.
  List<String> get boards {
    return switch (this) {
      BoardCategory.cbse => const ['CBSE'],
      BoardCategory.icse => const ['ICSE / ISC'],
      // Everything that is not one of the two national boards.
      BoardCategory.stateBoard =>
        kEducationBoards.where((b) => b != 'CBSE' && b != 'ICSE / ISC').toList(),
    };
  }

  /// Recovers the category from a stored board, so a returning teacher lands on
  /// the right tab without us persisting the category.
  ///
  /// An unknown or absent board yields null ("not chosen yet") rather than
  /// guessing a category: the doc is server-authored and may carry a board this
  /// build has never heard of.
  static BoardCategory? ofBoard(String? board) {
    return switch (board) {
      null => null,
      'CBSE' => BoardCategory.cbse,
      'ICSE / ISC' => BoardCategory.icse,
      _ => kEducationBoards.contains(board) ? BoardCategory.stateBoard : null,
    };
  }
}
