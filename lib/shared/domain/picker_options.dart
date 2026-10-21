// Canonical picker lists, copied verbatim from the web app's
// `src/types/index.ts` (see docs/flutter/SCREEN_INVENTORY.md §0). These are
// API enum values the backend expects, so they stay in English and are NOT
// localized; only the surrounding UI copy is.
//
// They live in `shared/` rather than inside a single feature because every AI
// tool form (lesson plan, quiz, worksheet, ...) offers the same grade/subject
// pickers, and the lists must not drift between them.

/// GRADE_LEVELS (15).
const List<String> kGradeLevels = <String>[
  'Nursery',
  'LKG',
  'UKG',
  'Class 1',
  'Class 2',
  'Class 3',
  'Class 4',
  'Class 5',
  'Class 6',
  'Class 7',
  'Class 8',
  'Class 9',
  'Class 10',
  'Class 11',
  'Class 12',
];

/// SUBJECTS (13).
const List<String> kSubjects = <String>[
  'Mathematics',
  'Science',
  'Social Science',
  'History',
  'Geography',
  'Civics',
  'English',
  'Hindi',
  'Sanskrit',
  'Kannada',
  'Computer Science',
  'Environmental Studies (EVS)',
  'General',
];

/// INDIAN_STATES (36) — 28 states + 8 union territories, in the web app's
/// declaration order. Used by the Profile (P0.8) location picker.
///
/// COUNT DEVIATION FROM THE DOCS (deliberate, verified): SCREEN_INVENTORY §0
/// heads this list "35 — 28 states + 7 UTs", but the list it then prints has
/// 36 entries, and so does the backend's own `INDIAN_STATES` in
/// `src/types/index.ts` (8 UTs, not 7). The backend array is the truth here,
/// and this is a verbatim copy of it.
///
/// Persisted verbatim to `users/<uid>.state`: the AI flows read it server-side
/// to localize examples, and the school-directory lookup groups on it, so the
/// strings must match the web's list exactly rather than being translated.
const List<String> kIndianStates = <String>[
  'Andhra Pradesh',
  'Arunachal Pradesh',
  'Assam',
  'Bihar',
  'Chhattisgarh',
  'Goa',
  'Gujarat',
  'Haryana',
  'Himachal Pradesh',
  'Jharkhand',
  'Karnataka',
  'Kerala',
  'Madhya Pradesh',
  'Maharashtra',
  'Manipur',
  'Meghalaya',
  'Mizoram',
  'Nagaland',
  'Odisha',
  'Punjab',
  'Rajasthan',
  'Sikkim',
  'Tamil Nadu',
  'Telangana',
  'Tripura',
  'Uttar Pradesh',
  'Uttarakhand',
  'West Bengal',
  // Union territories.
  'Delhi',
  'Chandigarh',
  'Jammu and Kashmir',
  'Ladakh',
  'Puducherry',
  'Andaman and Nicobar Islands',
  'Lakshadweep',
  'Dadra and Nagar Haveli and Daman and Diu',
];

/// EDUCATION_BOARDS (29) — the teacher's board, used by Settings (P0.7) and
/// the profile. `PATCH /api/user/profile` validates the value against this
/// exact list, so these stay verbatim and un-localized: they are proper nouns
/// AND API enum values.
const List<String> kEducationBoards = <String>[
  'CBSE',
  'ICSE / ISC',
  // State boards.
  'Andhra Pradesh State Board',
  'Assam State Board (SEBA)',
  'Bihar State Board (BSEB)',
  'Chhattisgarh State Board (CGBSE)',
  'Goa Board of Secondary Education',
  'Gujarat State Board (GSEB)',
  'Haryana State Board (HBSE)',
  'Himachal Pradesh State Board (HPBOSE)',
  'Jharkhand Academic Council (JAC)',
  'Karnataka State Board (KSEEB)',
  'Kerala State Board (SCERT)',
  'Madhya Pradesh State Board (MPBSE)',
  'Maharashtra State Board (MSBSHSE)',
  'Manipur State Board (COHSEM)',
  'Meghalaya State Board (MBOSE)',
  'Nagaland State Board (NBSE)',
  'Odisha State Board (BSE Odisha)',
  'Punjab State Board (PSEB)',
  'Rajasthan State Board (RBSE)',
  'Tamil Nadu State Board (SSLC)',
  'Telangana State Board (TSBIE)',
  'Tripura State Board (TBSE)',
  'UP Board (UPMSP)',
  'Uttarakhand State Board (UBSE)',
  'West Bengal State Board (WBBSE)',
  'Delhi Board (DBSE)',
  'Puducherry Board',
];

/// QUALIFICATIONS (10) — a teacher may hold several, so this is a multi-select.
/// Credential names, not prose: they stay verbatim (the API validates every
/// element against this list).
///
/// NOTE: the web's edit-profile dialog hides `'Other'`, but the API accepts it.
/// It is offered here rather than stranding a teacher whose credential is not
/// on the list.
const List<String> kQualifications = <String>[
  'D.El.Ed',
  'B.Ed',
  'M.Ed',
  'B.A',
  'M.A',
  'B.Sc',
  'M.Sc',
  'NET',
  'Ph.D',
  'Other',
];

/// ADMINISTRATIVE_ROLES — the extra hat a teacher wears in the school.
///
/// An enum rather than a bare list because the wire values are snake_case API
/// tokens while the labels are teacher-facing prose that must be localized
/// (see `AppLocalizations.settingsRole*`). Declaration order mirrors the web's
/// `ADMINISTRATIVE_ROLES` array so the two pickers read identically.
enum AdministrativeRole {
  hod('hod'),
  coordinator('coordinator'),
  examController('exam_controller'),
  vicePrincipal('vice_principal'),
  principal('principal'),
  none('none');

  const AdministrativeRole(this.wire);

  /// The exact token `PATCH /api/user/profile` validates against.
  final String wire;

  /// Tolerant parse: an unknown or absent value reads as "not set" (null)
  /// rather than throwing. The profile doc is server-authored and may carry a
  /// role this build does not know about yet.
  static AdministrativeRole? fromWire(String? wire) {
    for (final role in AdministrativeRole.values) {
      if (role.wire == wire) return role;
    }
    return null;
  }
}
