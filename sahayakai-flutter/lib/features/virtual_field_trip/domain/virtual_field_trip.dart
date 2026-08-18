import 'package:flutter/foundation.dart';

/// Immutable input the teacher assembles on the Virtual Field Trip form.
///
/// Only [topic] is required (the backend's `VirtualFieldTripInputSchema` marks
/// `topic` required, `language`/`gradeLevel` optional and back-filled from the
/// teacher's profile). `userId` is injected server-side from the verified token
/// (the flow parses `{...json, userId}`) and is deliberately NOT modelled here.
@immutable
class VirtualFieldTripRequest {
  const VirtualFieldTripRequest({
    required this.topic,
    this.gradeLevel,
    this.language,
  });

  /// The topic or theme to plan the trip around (e.g. `The Great Barrier Reef`).
  /// Required; the backend caps it at 1000 characters.
  final String topic;

  /// The target class/grade (e.g. `Class 7`). Optional — the flow extracts a
  /// grade from the topic or reads the profile when this is absent.
  final String? gradeLevel;

  /// Full English language name the endpoint expects (e.g. `Kannada`), sourced
  /// from [AppLocale.aiName]. Optional.
  final String? language;
}

/// One curated stop on the itinerary, decoded from a `stops[]` object
/// (`src/ai/flows/virtual-field-trip.ts`). Carries the seven content fields the
/// flow authors; every prose field renders through `AiText` so Indic matras are
/// never clipped.
@immutable
class FieldTripStop {
  const FieldTripStop({
    required this.name,
    required this.description,
    required this.educationalFact,
    required this.reflectionPrompt,
    required this.culturalAnalogy,
    required this.explanation,
    this.googleEarthUrl,
  });

  /// The location's name (e.g. `The Amazon River Basin`). Always non-empty — a
  /// stop that arrives without one cannot title its numbered card, so the DTO
  /// drops it.
  final String name;

  /// An age-appropriate narrative of what students are seeing.
  final String description;

  /// A "wow-factor" fact that isn't common knowledge, shown as a tinted
  /// highlight.
  final String educationalFact;

  /// A critical-thinking question students answer at this stop, shown as a
  /// distinct quiet inset.
  final String reflectionPrompt;

  /// The "Bharat-First" analogy relating this place to something students in
  /// India would know (e.g. relating the Andes to the Himalayas).
  final String culturalAnalogy;

  /// The pedagogical reasoning for including this stop in the curriculum.
  final String explanation;

  /// The external Google Earth URL for this stop, pre-validated to an absolute
  /// http(s) URI at the DTO boundary. Null when the model returned a
  /// missing/unsafe URL — the card then simply omits the "Open in Google Earth"
  /// action rather than dropping the whole (still-valuable) stop.
  final Uri? googleEarthUrl;
}

/// The fully-decoded `/api/ai/virtual-field-trip` 200 result — a generated
/// DOCUMENT (an itinerary), not a browse. [stops] holds the curated 3–5 stops in
/// visiting order; [subject] and [gradeLevel] are the model's metadata, shown as
/// masthead badges.
@immutable
class FieldTrip {
  const FieldTrip({
    required this.title,
    required this.stops,
    required this.gradeLevel,
    required this.subject,
    this.raw,
  });

  /// The verbatim `/api/ai/virtual-field-trip` response body, kept so a later
  /// "Save to Library" persists EXACTLY the object the server-side flow
  /// persists as `data` (`src/ai/flows/virtual-field-trip.ts`) rather than a
  /// re-serialized domain object that would quietly drop any field this app
  /// does not model. Null for a trip that did not come from a live plan (a test
  /// fixture) — and the Save action is withheld in exactly that case.
  final Map<String, dynamic>? raw;

  /// An engaging, adventurous title for the trip.
  final String title;

  /// The curated stops, in visiting order. Empty only for a degenerate payload
  /// (every stop dropped) — the result view then shows a no-stops empty state.
  final List<FieldTripStop> stops;

  /// The target grade (e.g. `Class 7`). May be empty if the model omitted it.
  final String gradeLevel;

  /// The academic subject (e.g. `Geography`). May be empty if the model omitted
  /// it.
  final String subject;

  /// False when every stop was dropped at decode, so the view shows the
  /// "no stops" empty state rather than a bare masthead.
  bool get hasStops => stops.isNotEmpty;
}

/// The two outcomes a plan request can settle into — a distinct type so the
/// controller can render the benign 202 "still generating" as its own calm
/// state, NOT as an error.
///
///   • [FieldTripResult]         — the 200 payload decoded into a [FieldTrip].
///   • [FieldTripStillGenerating] — the 202 the dispatcher returns when its 45s
///     budget elapses: the trip keeps generating server-side and saves to My
///     Library. A "come back later" state, never a hard failure.
sealed class FieldTripOutcome {
  const FieldTripOutcome();
}

/// The itinerary landed: a fully-decoded [FieldTrip].
@immutable
final class FieldTripResult extends FieldTripOutcome {
  const FieldTripResult(this.trip);

  final FieldTrip trip;
}

/// The dispatcher's 45s budget elapsed (HTTP 202 `still_generating`). The trip
/// is still being planned server-side and will land in My Library; [message] is
/// the server's human line, carried for parity/telemetry (the calm panel renders
/// localized chrome so a non-English teacher sees their own language).
@immutable
final class FieldTripStillGenerating extends FieldTripOutcome {
  const FieldTripStillGenerating({required this.message});

  /// The server's `message` field (English). Decoded and carried; the UI shows a
  /// localized equivalent per the 11-language rule.
  final String message;
}
