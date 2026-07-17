import 'dart:math' as math;

import 'package:flutter/foundation.dart';

/// Immutable input the teacher assembles on the form.
///
/// Only `assignmentDescription` is required (the endpoint caps it at 2000). The
/// server injects `userId` and `teacherContext` from the verified token, so they
/// are deliberately NOT modelled here. Verified against
/// `RubricGeneratorInputSchema` in `sahayakai-main`.
@immutable
class RubricRequest {
  const RubricRequest({
    required this.assignmentDescription,
    this.gradeLevel,
    this.subject,
    this.language,
  });

  /// What the rubric grades. Required; the endpoint caps it at 2000.
  final String assignmentDescription;
  final String? gradeLevel;
  final String? subject;

  /// Full English language name the endpoint expects (e.g. `Kannada`),
  /// sourced from [AppLocale.aiName].
  final String? language;
}

/// One performance level of a criterion (a column of the rubric grid).
///
/// The backend prompt mandates four levels for every criterion — Exemplary (4),
/// Proficient (3), Developing (2), Beginning (1) — ordered highest to lowest.
/// Every field is nullable-tolerant because the grid is model-generated.
@immutable
class RubricLevel {
  const RubricLevel({
    required this.name,
    required this.description,
    this.points,
  });

  /// The level's name (e.g. `Exemplary`). May be blank if the model omitted it.
  final String name;

  /// What performance at this level looks like for the criterion.
  final String description;

  /// The points awarded for this level. `num` (not `int`) because the schema is
  /// `z.number()`, which permits a decimal. Null-tolerant.
  final num? points;

  /// The points formatted for a badge: a whole number drops its `.0`.
  String? get pointsLabel {
    final value = points;
    if (value == null) return null;
    return value == value.roundToDouble()
        ? value.toInt().toString()
        : value.toString();
  }
}

/// One criterion of the rubric (a row of the grid).
@immutable
class RubricCriterion {
  const RubricCriterion({
    required this.name,
    this.description,
    this.levels = const <RubricLevel>[],
  });

  /// The criterion name (e.g. `Research and Content`).
  final String name;

  /// A brief description of what this criterion evaluates.
  final String? description;

  /// The performance levels, highest score first.
  final List<RubricLevel> levels;
}

/// The full `/api/ai/rubric` result. Field names match the route's returned
/// shape exactly: `title`, `description`, `criteria[{ name, description,
/// levels[{ name, description, points }] }]`, `gradeLevel`, `subject`. Verified
/// against `RubricGeneratorOutputSchema` + the route handler in `sahayakai-main`
/// (the handler returns exactly these five keys). See docs/flutter/HANDOFF.md.
@immutable
class Rubric {
  const Rubric({
    required this.title,
    this.description,
    this.criteria = const <RubricCriterion>[],
    this.gradeLevel,
    this.subject,
  });

  final String title;
  final String? description;
  final List<RubricCriterion> criteria;
  final String? gradeLevel;
  final String? subject;

  /// True when the model returned nothing worth rendering — the view shows an
  /// empty result state rather than an unhelpful blank grid.
  bool get isEmpty =>
      title.isEmpty &&
      (description == null || description!.isEmpty) &&
      criteria.isEmpty;

  /// The widest criterion's level count — the number of grid columns. Criteria
  /// can (rarely) carry different level counts, so short rows are padded to this.
  int get levelCount =>
      criteria.fold(0, (m, c) => math.max(m, c.levels.length));

  /// The canonical level headers for the grid: the levels of the criterion that
  /// has the most of them (mandated to be identical across criteria, so any full
  /// row is representative). Empty when no criterion carries levels.
  List<RubricLevel> get headerLevels {
    var best = const <RubricLevel>[];
    for (final c in criteria) {
      if (c.levels.length > best.length) best = c.levels;
    }
    return best;
  }
}
