# Edge cases: parent behaviour, conversation and language (review, 7 Oct 2026)

How a real parent in Siliguri or Darjeeling behaves on a school call, in English (Indian), Bengali, Hindi or Nepali, and exactly what the call does about it. Assembled from the parent-behaviour review (its full text could not be written to file; its §3.16–§6 are reproduced here unchanged), the conversation-and-language review of plan v1 (`CONVERSATION_PLAN.md` §13) and the real test calls of 7 Oct 2026. Safeguarding situations are described only at the level of routing; the wording of those lines is written and reviewed by the school's designated safeguarding lead, not here.

## 1. Legend

**Stages:** S0 before dialling · S1 answer and opener (beat 1) · S2 "who is this / is this genuine" · S3 language · S4 listener check (beat 2) · S5 the message · S6 the parent's reply · S7 read-back · S8 questions · S9 goodbye · IN inbound · ANY any stage.

**Recorded lines** (pre-written by native writers per language, recorded once, verified):
L-GENUINE (call the school office on its known number to check; the school never asks for money or an OTP) · L-WHO (school name, why calling, AI assistant of the school if asked) · L-BUSY (I'll call another time; when suits you?) · L-DRIVE (please don't talk while driving; we'll call back) · L-CORE (the one-sentence core of a time-critical message) · L-LOUD (louder, slower replay) · L-CANTHEAR (the line is unclear; we'll call back) · L-OFFICE (I don't have that; the office will call you) · L-DATA (thank you; the office will check the school's records) · L-NOPAY (we never take payments or numbers on a call; pay at the counter or the school's app) · L-NOCONSEQ (I don't have information about that; the accounts office will help) · L-OK-A2 (the school is checking right now and will call you back from its office number within minutes) · L-CONDOLE (condolence and close) · L-EMERGENCY (if anyone is in danger right now, call 112; the school is being alerted) · L-NOCHAN (we can't send WhatsApp or SMS from this call; the office can) · L-NOMSG (please tell the class teacher directly / leave a short message, read back, held for the teacher) · L-APAAR (factual note on what APAAR is and that the office will explain).

**Retry codes:** R0 never re-called for this intent · RD answered-deferred: one re-call at the parent's time, else +2 h (+15 min if time-critical) · RN network re-call in 10 min, not counted as answered · RP one try to the next guardian of record · RX suppress the number or family (scope per row).

**Escalation:** P0 immediate page (A2/urgent) · P1 same-day staff call-back · P2 office task within 2 school days.

**Tests:** G1–G15 = plan v2 §10 gates · NG1–NG12 = new gates (§5) · DIR = director unit test · PER = persona set (native speakers, real conditions) · lint = answer-bank lint · RACE / CHAOS = concurrency / fault injection.

**Tags:** [NEW] not in plan v2 · [EXT] in plan v2 but extended here.

## 2. Universal edge cases (every purpose)

### 2.1 Who answers

| ID | Stage | Edge case (sample) | Detection | Behaviour | Outcome | Retry / escalation | Test |
|---|---|---|---|---|---|---|---|
| W01 | S4 | Mother or father: "Haan, main uski mummy" / "আমি ওর মা বলছি" / "म उसको आमा" | relation word | tier allowed per number | guardian_confirmed | — | G1 |
| W02 [EXT] | S4 | Grandparent: "Main dadi bol rahi hoon" / "আমি ঠাকুমা" / "म हजुरआमा" | relation (non-guardian) | tier 0 relayed; tier 1 as "please ask a parent to call the school"; tier 2 never | heard_by_proxy | RP | NG2 |
| W03 [EXT] | S4 | Older sibling / cousin | relation (non-guardian) | as W02 | heard_by_proxy | RP | NG2 |
| W04 | S4 | The child answers: "Mummy ghar pe nahi hai" | child voice cue + words | ask for a parent or a good time; never discuss the child; A2: page stays live | child_answered | RD | G1, NG2 |
| W05 [NEW] | S4 | Domestic help / driver: "Madam bahar gayi hain" | relation (staff) | "please tell them the school called"; no child facts | heard_by_proxy | RD | NG2 |
| W06 [NEW] | S4 | Neighbour / shopkeeper whose phone is used by several families | "yeh mera number hai, unka nahi" | tier 0 only; office record task | shared_number_reported | RX for child-specific purposes; P2 | NG9 |
| W07 | S4 | Wrong number / recycled number: "Kaun Pema?" | wrong_number | apologise; L-WHO short; end | wrong_number | RX number for this guardian; P2 office | G1 |
| W08 [NEW] | S4 | Guardian not on record says "I'm her uncle, I look after her" | relation (not of record) | courtesy; tier 0 only; "the office will update records if needed" | guardian_not_on_record | P2 | NG12 |
| W09 [NEW] | S1 | AI call-screening assistant answers ("The person you're calling is using a screening service") | screener phrase | one tier-0 sentence, no child name, end | screened | RD | DIR |
| W10 [NEW] | S1 | Business line / reception ("Good morning, XYZ Traders") | business greeting | "Sorry, wrong number" style tier-0, end | business_line | RX routine; P2 | DIR |
| W11 | S4 | Greeting only: "Haan ji, boliye" / "হ্যাঁ বলুন" / "हजुर?" | greeting, no relation | one soft follow-up: "Pema ki mummy bol rahi hain ya papa?"; then not confirmed | — | — | G1 |
| W12 [EXT] | S4 | "Ek minute, uski mummy ko deta hoon" / "দাঁড়ান, ওর মাকে দিচ্ছি" | handover | hold up to 90 s, no nudges; on a new "Hello?" replay beat 1 | handover | — | DIR |
| W13 [NEW] | S4 | Handover never completes (phone put down, 90 s pass) | silence after handover | L-BUSY; end | handover_abandoned | RD | DIR |
| W14 [NEW] | S4 | Two people on speaker, both talking | multiple speakers | address "aap"; accept the guardian's relation word | — | — | PER |
| W15 [NEW] | S4 | Parent claims to be the guardian but the voice is a child's | child voice + relation claim | treat as not confirmed (tier 1 at most) | listener_doubtful | RD | NG2 |
| W16 [NEW] | S4 | "Pema? Hamare yahan Pema nahi hai, Tshering hai" — child's name pronounced differently / nickname | name mismatch | "Tshering, class seven B?" once; else L-DATA | name_mismatch | P2 | DIR |
| W17 [NEW] | S4 | Guardian of two children in different classes: "kaun sa bachcha?" | which_child | name the child and class for child-specific; class-wide: name both classes | — | — | DIR |
| W18 [NEW] | S4 | Guardian deceased; family member says so | guardian_change | L-CONDOLE; end; no further routine calls to that guardian | guardian_deceased | RX guardian; P1 office | DIR |
| W19 [NEW] | S4 | "We're separated, call her father" | guardian_change | courtesy; never argue; office task | custody_info | P1 office (sensitive) | DIR |
| W20 [NEW] | S4 | "Child doesn't live with me" | guardian_change | no child facts; office task | not_living_with_child | P1 | DIR |

### 2.2 The parent's state

| ID | Stage | Edge case (sample) | Detection | Behaviour | Outcome | Retry | Test |
|---|---|---|---|---|---|---|---|
| PS01 | ANY | Busy: "Abhi meeting mein hoon" / "এখন ব্যস্ত" | busy_now | L-BUSY; ask a time once; time-critical: L-CORE first | answered_deferred | RD | DIR |
| PS02 | ANY | Driving: "Gaadi chala raha hoon" | busy_now (driving) | L-DRIVE immediately; no questions | answered_deferred | RD | DIR |
| PS03 | ANY | Unwell / in hospital | busy_now | L-BUSY gently | answered_deferred | RD | DIR |
| PS04 [NEW] | ANY | Grieving / bereavement mentioned | grief | L-CONDOLE; end | grief | 14-day routine pause for the family | DIR |
| PS05 | S2 | Suspicious of scams: "Fraud call hai kya?" | is_genuine | L-GENUINE; never argue; offer to end | — | — | G8 |
| PS06 [EXT] | S2 | Hostile to AI: "Robot se baat nahi karni" | wants_person / anti-AI | honest yes it is the school's assistant; offer office call-back | wants_person | P2 | DIR |
| PS07 [NEW] | ANY | Abusive language | abusive | one calm line; end | abusive | R0 for this campaign; P2 note | DIR |
| PS08 | S2 | Anxious first question: "Kya hua? Sab theek hai?" | is_my_child_ok | for non-A2: "Sab theek hai, yeh {purpose} ke baare mein hai"; A2: L-OK-A2 | — | — | DIR |
| PS09 [NEW] | ANY | Angry about something unrelated (fees, a teacher) | complaint | acknowledge in one line; call-back to the right owner; return to purpose once | complaint_logged | P2 | DIR |
| PS10 [NEW] | ANY | Elderly parent, slow speech, long pauses | long pauses | extended endpointing (open questions 1.2 s); repeat slowly on request | — | — | PER |
| PS11 [NEW] | ANY | Low literacy, unfamiliar terms (PTM, venue) | repeat / confusion | rephrase using the answer bank's plain form ("teacher se milne ki meeting") | — | — | lint |
| PS12 [NEW] | ANY | Joking / testing the bot ("tum insaan ho?") | who_is_calling / AI | honest answer, kind, continue | — | — | G8 |
| PS13 [NEW] | ANY | Intoxicated / incoherent | unrecognised ×2 | L-CANTHEAR; end | unclear | RD once | DIR |

### 2.3 Speech and audio

| ID | Stage | Edge case | Detection | Behaviour | Outcome | Retry | Test |
|---|---|---|---|---|---|---|---|
| SP01 | S5 | Backchannels during the message ("haan… achha… ji", "হুঁ", "हस्") | <700 ms or backchannel list | do not stop the message | — | — | G (barge-in) |
| SP02 [EXT] | S5 | Parent talks over the message with a real question | ≥600 ms speech + words, not backchannel | stop, answer if it's a question, resume from sentence start | — | — | DIR, PER |
| SP03 | S1 | Parent says "Hello? Hello?" before we speak | speech in the first 1.2 s | wait for it to end, then beat 1 | — | — | DIR |
| SP04 [NEW] | ANY | Long thinking pause mid-reply ("Thursday ko… woh…") | adaptive endpointer | do not cut in; 1.2 s after open questions | — | — | PER |
| SP05 [NEW] | ANY | Side talk: "ruko, school se phone hai" (to someone in the room) | side_talk | wait; re-ask once | — | — | PER |
| SP06 | ANY | Background TV / traffic / children | noise floor | raise barge-in threshold; yes/no read-backs | noisy_line | — | PER |
| SP07 [NEW] | ANY | Whispering (in class, hospital, temple) | low volume + whisper cue | L-BUSY with a time question | answered_deferred | RD | PER |
| SP08 | ANY | Speakerphone echo of our own audio | echo correlation | ignore our own echo as input | — | — | CHAOS |
| SP09 | ANY | "Awaaz nahi aa rahi" / cannot hear | cannot_hear | L-LOUD; then L-CANTHEAR | cannot_hear | RN | DIR |
| SP10 [NEW] | ANY | Very short answers ("haan", "hmm") | short tokens | read-back with explicit yes/no | — | — | NG5 |
| SP11 [NEW] | ANY | Numbers spoken in another language ("Thursday ko ten-thirty", "সাড়ে দশটা") | NLU slots | normalise; read back in the call's language | — | — | NG4 |
| SP12 [NEW] | ANY | Relative dates: "kal", "parshu", "next Thursday", "Puja ke baad" | relative-time words | never accept as a slot; ask for the day; read back absolute | — | — | NG4 |

### 2.4 Language

| ID | Stage | Edge case | Detection | Behaviour | Outcome | Retry | Test |
|---|---|---|---|---|---|---|---|
| LG01 | S3 | Family's language unknown (Entab has no field) | no confirmed language | offer once after beat 1: enabled languages only | language_suggested | — | DIR |
| LG02 | ANY | Code-mixing (Hinglish, Benglish, Nepali-Hindi) | — | normal; never a switch | — | — | rule 9 |
| LG03 | ANY | Answer formulas in English ("Yes", "OK", "Speaking") in a Bengali call | — | never a switch | — | — | rule 9 |
| LG04 | ANY | Explicit request: "Bangla te bolun" / "Nepali ma bolnus" / "Hindi mein boliye" | language_request | switch if enabled and conversation-ready; else LR rules | language_switched (suggestion) | — | DIR |
| LG05 [NEW] | ANY | Requested language enabled for notices only | language_request | play the keyed recorded notice in that language | — | — | DIR |
| LG06 [NEW] | ANY | Requested language not enabled / unsupported (e.g. Tamil) | language_request | recorded line: "the office will call you"; suggestion logged | language_unavailable | P2 | DIR |
| LG07 [NEW] | ANY | Darjeeling Nepali speaker answers in Hindi to an official voice | Hindi turns | stay in Nepali unless two long turns or a request | — | — | rule 9 |
| LG08 [NEW] | ANY | Parent switches back and forth | two switches | stop switching; ask once which language | — | — | DIR |
| LG09 [NEW] | ANY | Dialect words the recogniser misses (Rajbanshi/Sadri words in Bengali) | low confidence | yes/no read-back | — | — | PER |
| LG10 [NEW] | ANY | Nepali vs Hindi confusion by the recogniser on 2-word turns | LID ambiguity | never switch on short turns | — | — | NG5 |

### 2.5 Intent ambiguity

| ID | Stage | Edge case | Detection | Behaviour | Outcome | Retry | Test |
|---|---|---|---|---|---|---|---|
| IA01 | S6 | "Achha, theek hai" / "আচ্ছা" / "हुन्छ" (noted, not yes) | ack | read back and ask explicit yes | — | — | NG5 |
| IA02 | S6 | "Dekhte hain" / "try karenge" | not_sure | tentative, no push | rsvp_tentative | reminder may ask | DIR |
| IA03 [NEW] | S6 | Conditional: "papa agree karenge toh" | not_sure + condition | tentative with condition note | rsvp_tentative | — | DIR |
| IA04 [NEW] | S6 | Yes for one child, no for the other | per-child | read back per child | per-child | — | DIR |
| IA05 | S6 | "Already told the teacher" | already_know | thank; record acknowledged | already_informed | R0 | DIR |
| IA06 [NEW] | S6 | "I sent a note" (absence/leave) | already_explained | note for the teacher; never a leave record | note_for_teacher | P2 | DIR |
| IA07 [NEW] | S6 | "We're travelling that week" | no + reason | record no with reason category | rsvp_no | — | DIR |
| IA08 [NEW] | S6 | "We left the school / took TC" | left_school | L-DATA; end | withdrawn_reported | RX family; P2 | DIR |
| IA09 [NEW] | S6 | "Child goes by another name" | record_mismatch | L-DATA | data_dispute(name) | P2 | DIR |
| IA10 [NEW] | S6 | Wrong class/section named | record_mismatch | L-DATA; do not continue child facts | data_dispute(class) | P2 | DIR |
| IA11 [NEW] | S6 | "Yes" said while the line was unclear (low confidence) | low confidence | read back; never accept | — | — | NG5 |
| IA12 [NEW] | S6 | Sarcasm: "haan haan, zaroor aayenge" (tone) | — | read back literally; accept parent's confirm | — | — | PER |
| IA13 [NEW] | S6 | Rhetorical question: "Main kyun aaun?" | question | answer the purpose briefly from facts | — | — | DIR |
| IA14 [NEW] | S6 | "Haan" meaning "hello?" at the start of the reply | position + prosody | treat as greeting, not yes | — | — | G1 |
| IA15 [NEW] | S6 | "Call my husband on this other number" | redirect | never capture a spoken number; queue next guardian of record; office task | redirect_requested | RP; P2 | NG3 |

### 2.6 Requests the call cannot satisfy

| ID | Stage | Edge case | Detection | Behaviour | Outcome | Retry | Test |
|---|---|---|---|---|---|---|---|
| RQ01 | S6 | Wants the principal now | wants_person | call-back task (reason code + window) | callback_requested | P1/P2 | DIR |
| RQ02 | S8 | Wants marks/results | out_of_scope | L-OFFICE; results are never read out | — | P2 | lint |
| RQ03 | S6 | Complaint about a teacher | complaint | call-back to coordinator, never the named teacher | complaint_logged | P1 | DIR |
| RQ04 | S6 | Bullying report | safeguarding (routing) | per §2.7 routing | — | P1 DSL | G6 |
| RQ05 | S8 | Unrelated: admissions, bus fees, uniform, holidays | out_of_scope | L-OFFICE + office number | — | — | lint |
| RQ06 | S9 | "Call me later today" | busy_now + time | confirm the window | answered_deferred | RD at time | DIR |
| RQ07 | S6 | "Call me on another number" | redirect | as IA15 | — | — | NG3 |
| RQ08 | S6 | "Send it on WhatsApp/SMS" | channel request | L-NOCHAN | channel_requested | P2 | DIR |
| RQ09 | S6 | "Tell the teacher…" (message) | message | L-NOMSG (A5 only records, with consent and read-back) | — | P2 | DIR |
| RQ10 | S6 | Tries to pay / asks for a link or QR | payment | L-NOPAY | — | — | G9 |
| RQ11 | S6 | Asks for an OTP / reads an OTP | digit run | never repeat; L-NOPAY | — | — | NG3 |
| RQ12 [NEW] | S6 | Asks the assistant to "remember" something | memory request | "the office will note it"; office task | — | P2 | DIR |
| RQ13 [NEW] | S6 | Reads out card/Aadhaar/UPI digits | digit run (≥4 digits) | stop the parent kindly; never store; redact from transcript | digits_redacted | — | NG3 |

### 2.7 Safety-relevant moments (routing only)

| ID | Stage | Edge case | Detection | Behaviour | Outcome | Escalation | Test |
|---|---|---|---|---|---|---|---|
| SF01 | ANY | A safeguarding concern about a child is disclosed | safeguarding_disclosure (model OR word list) | fixed line written by the DSL; transcript sealed | dsl_review | P1 DSL only | G6 |
| SF02 | ANY | Bullying (either side) | safeguarding_disclosure | as SF01 | dsl_review | P1 DSL | G6 |
| SF03 [NEW] | ANY | Danger happening now (medical emergency, someone missing, violence) | urgent_danger | L-EMERGENCY; P0 page; stay on until the parent ends | urgent | P0 | NG7 |
| SF04 [NEW] | ANY | The child has not reached home / is missing | urgent_danger | as SF03; principal + transport desk | urgent | P0 | NG7 |
| SF05 [NEW] | ANY | Parent in distress about themselves | adult_distress | fixed line with helpline numbers (Tele-MANAS 14416, 112); DSL page | distress | P1 DSL; 14-day routine pause | NG7 |
| SF06 [NEW] | ANY | Threat against a teacher | threat_to_staff | calm line; end; principal only | threat | P1 principal; sealed | DIR |
| SF07 [NEW] | ANY | Custody dispute raised ("don't tell her father anything") | guardian_change (custody) | no argument; office task, sensitive | custody_info | P1 | DIR |
| SF08 [NEW] | ANY | Allegation against staff | safeguarding_disclosure | as SF01 (DSL, not the named staff) | dsl_review | P1 DSL | G6 |
| SF09 [NEW] | A7 | A parenting statement that suggests harm | safeguarding cue | left out of any draft; DSL review | dsl_review | P1 DSL | G6 |

### 2.8 Endings

| ID | Stage | Edge case | Detection | Behaviour | Outcome | Retry | Test |
|---|---|---|---|---|---|---|---|
| EN01 | S5 | Hangs up mid-message | hangup before checkpoint | — | heard_partial | RD once (time-critical: +15 min) | NG1 |
| EN02 | S7 | Hangs up during the read-back | hangup after intent, before confirm | record unconfirmed | rsvp_unconfirmed | reminder may ask | NG1 |
| EN03 | S6 | Says bye before the message | bye early | L-CORE if time-critical; else L-BUSY | answered_deferred | RD | DIR |
| EN04 | S9 | Never says bye, keeps silent | silence 2 nudges | close politely | — | — | DIR |
| EN05 | S9 | Keeps talking after our goodbye | speech after goodbye | if it is a question, answer once; else close | — | — | DIR |
| EN06 | S9 | Reciprocal goodbye ("achha ji, namaste") | — | wait ~1 s, then hang up | — | — | G (goodbye pause) |
| EN07 [NEW] | ANY | Call drops (network) mid-conversation | abnormal hangup cause | — | dropped | RN once | NG1 |
| EN08 [NEW] | S9 | Parent asks "will you call again?" | question | honest answer per purpose (reminder / none) | — | — | lint |

### 2.9 Accessibility

| ID | Stage | Edge case | Detection | Behaviour | Outcome | Retry | Test |
|---|---|---|---|---|---|---|---|
| AC01 | S0 | Family flagged hearing- or speech-impaired | flag | never dialled by voice; office/written channel | — | — | rule 10 |
| AC02 | ANY | Hard of hearing (not flagged) | cannot_hear twice | L-LOUD then L-CANTHEAR; office task | cannot_hear | P2 | DIR |
| AC03 | ANY | Three silent answered calls | silence ×3 | flag for office instead of retrying | accessibility_suspected | P2 | rule 10 |
| AC04 [NEW] | ANY | Parent prefers keypad over speaking | "press karna hai" / DTMF tones | switch to the keyed recorded notice | — | — | NG6 |

## 3. Per use case

### 3.1 Meetings and events — PTM (B1), event RSVP (D1), reminder (B4)

| ID | Use case | Stage | Edge case | Detection | Behaviour | Outcome | Retry | Test |
|---|---|---|---|---|---|---|---|---|
| MT01 | B1 D1 | S6 | Yes | yes / key 1 | read back (absolute date from the speller), explicit yes | rsvp_yes_confirmed | R0 | G4 |
| MT02 | B1 | S6 | Can't come at that time | no | offer next defined slot or call-back | rsvp_no / slot_chosen | — | DIR |
| MT03 | B1 | S6 | Picks another slot | slot | read back; confirm | slot_chosen | R0 | DIR |
| MT04 [NEW] | B1 | S6 | "Will come late" | yes_late | record yes + late note | rsvp_yes_late | R0 | DIR |
| MT05 [NEW] | D1 | S6 | Headcount: "we'll be four" | headcount | record if the event asks; read back | rsvp_yes(n) | R0 | DIR |
| MT06 | B1 D1 | S8 | "Where exactly?" | question(venue) | venue from facts | — | — | lint |
| MT07 [NEW] | B1 D1 | S6 | "That day is a holiday (Puja)!" | fact_dispute | office will confirm; dispute counter | fact_dispute | breaker pauses campaign | NG8 |
| MT08 | B1 | S8 | "Should the child come?" | question | from facts | — | — | lint |
| MT09 | B1 D1 | S8 | "Can both parents come?" | question | from facts | — | — | lint |
| MT10 [NEW] | B1 | S6 | "Already met the teacher last week" | already_know | thank; record | already_informed | R0 | DIR |
| MT11 [NEW] | B4 | S6 | Reminder: "I said yes but now can't" | cancel | record cancel; offer call-back | rsvp_cancelled | — | DIR |
| MT12 [NEW] | B1 D1 | S6 | Parent of two children in two classes, different PTM times | which_child | name each child's slot | per-child | — | DIR |
| MT13 [NEW] | D1 | S8 | "Is it free / any cost?" | question(cost) | from facts (paid flag); never sell | — | — | NG10 |
| MT14 [NEW] | B1 | S6 | "My child isn't in 7B" | record_mismatch | L-DATA | data_dispute(class) | P2 | DIR |
| MT15 [NEW] | B1 D1 | S6 | "Send me the details" | channel request | L-NOCHAN | — | P2 | DIR |
| MT16 [NEW] | B1 | ANY | Called after the PTM started | — | prevented by expiry = start − 2 h | — | — | CL11 gate |

### 3.2 Principal / disciplinary meeting slot confirmation (B2) — human-first

| ID | Stage | Edge case | Behaviour | Outcome | Test |
|---|---|---|---|---|---|
| PM01 | S6 | Confirms the agreed slot | read back; confirm | confirmed | DIR |
| PM02 | S6 | "Why is this meeting?" | never states the matter: "the principal will explain" | — | lint |
| PM03 [NEW] | S6 | Wants to bring another person | attendee noted for the principal | attendee | DIR |
| PM04 [NEW] | S6 | Disputes / angry | principal call-back (P1); no argument | complaint_logged | DIR |

### 3.3 Emergency closure (D4)

| ID | Stage | Edge case | Behaviour | Outcome | Retry | Test |
|---|---|---|---|---|---|---|
| CL01 | S5 | Heard | press/say ok → close quickly | heard | R0 | G |
| CL02 [NEW] | S6 | "My child is already on the bus / at school" | child_en_route → P0 to transport desk + principal; L-EMERGENCY not needed; reassure "the school is handling buses" | en_route_reported | P0 | NG7 |
| CL03 | S8 | "Exams?" / "When does it reopen?" | only principal's entries; else L-OFFICE | — | — | lint |
| CL04 [NEW] | S6 | "I heard it's open, is this real?" | L-GENUINE + "please check the school's official notice" | — | — | DIR |
| CL05 [NEW] | S5 | Call answered after the closure was withdrawn | withdrawn-closure clip ("school is open today") | — | — | CL13 gate |
| CL06 [NEW] | S6 | Disputes ("roads are fine") | fact_dispute; principal alerted (no auto-pause for D4) | fact_dispute | — | NG8 |
| CL07 [NEW] | ANY | Network degraded (landslide area) | keep retrying per D4 rule; unreached list | not_reached | D4 retry | SF09 ops |
| CL08 [NEW] | S6 | Parent asks to pick up a child already at school | P0 to principal; tell them the office will call | pickup_request | P0 | DIR |

### 3.4 Transport (D5), early dismissal (D6), illness notice (D7)

| ID | Use case | Edge case | Behaviour | Outcome | Escalation | Test |
|---|---|---|---|---|---|---|
| TR01 | D5 | "Which stop now?" | from facts | — | — | lint |
| TR02 [NEW] | D5 | "My stop is removed, how will my child come?" | stop_removed → transport desk call-back | callback | P1 | DIR |
| TR03 [NEW] | D5 | Reports a bus incident | transport_incident → urgent if happening now | urgent | P0 | NG7 |
| TR04 | D5 | Custody-restricted guardian | never called (time/place) | — | — | ID01 gate |
| TR05 [NEW] | D5 | Wrong route on record | L-DATA | data_dispute(transport) | P2 | DIR |
| ED01 [NEW] | D6 | "I can't come at that time" | cannot_collect → class teacher call-back; never "leave the child" advice | cannot_collect | P0 | NG11 |
| ED02 [NEW] | D6 | "My brother will pick her up" | alternate_pickup → school's pickup-authorisation rule; office confirms; never accepted by voice | alternate_pickup_requested | P0 | NG12 |
| IL01 [NEW] | D7 | "My child has symptoms" | symptom_report → class teacher / nurse call-back; no medical advice | symptom_report | P1 | DIR |
| IL02 [NEW] | D7 | "Who is sick?" | identity_probe → never names a child | — | — | G3 |

### 3.5 Request to talk — attendance (A1), academic (A3), conduct (A4), term summary (A6)

| ID | Stage | Edge case | Behaviour | Outcome | Retry | Test |
|---|---|---|---|---|---|---|
| RT01 | S6 | Agrees and picks a window | read back window | callback_window | R0 | DIR |
| RT02 | S6 | Prefers a visit | record; teacher confirms | prefers_visit | R0 | DIR |
| RT03 | S8 | "What is it about?" | "I don't have the details; Rai ma'am will speak with you herself" | — | — | lint |
| RT04 | S8 | Asks again | different line moving to a time | — | — | lint |
| RT05 [EXT] | S6 | "She was ill, I sent a note" | already_explained → note for teacher | note_for_teacher | P2 | DIR |
| RT06 [NEW] | S8 | "Is my child in trouble?" | consequence_question → "the teacher just wants to talk with you" | — | — | lint |
| RT07 [NEW] | S6 | Upset ("why are you calling me about this?") | calm; call-back offered | upset | P1 | DIR |
| RT08 [NEW] | S6 | Wants to talk to the teacher right now | callback task (no live transfer) | callback_requested | P1 | DIR |
| RT09 [NEW] | S4 | Non-guardian answers | tier-1 only: "please ask a parent to call the school" | heard_by_proxy | RP | NG2 |
| RT10 [NEW] | S6 | Parent says it's a mistake (child attends regularly) | record_mismatch → teacher | data_dispute | P2 | DIR |

### 3.6 Same-day unexplained absence (A2) — paging first

| ID | Use case | Stage | Edge case (sample) | Detection | Behaviour | Outcome | Escalation / retry | Test |
|---|---|---|---|---|---|---|---|---|
| AB01 | A2 | S0 | Page before dial | — | class teacher + principal paged when the call is placed | page_live | P0 | G5 |
| AB02 | A2 | S6 | "Yes, she's with me, she's unwell" | with_me | read back: "So Pema is with you now, right?" | — | — | G5 |
| AB03 | A2 | S7 | Explicit second yes | with_me confirmed | page → teacher note; remind the written leave note | with_me_confirmed | downgrade | G5 |
| AB04 [NEW] | A2 | S6 | "She left for school / I dropped her at the gate" | dropped_at_school | skip the timer: principal + security now; stay on | missing_on_campus | P0 | NG11 |
| AB05 [NEW] | A2 | S6 | "She's on the way, she's late" | on_the_way_late | page stays; re-page if not present by T+60 | late_expected | P0 re-arm | NG11 |
| AB06 [NEW] | A2 | S6 | "She's with her grandparents / other parent" | with_other_guardian | read back; teacher acknowledgement required | with_family | P0 until ack | NG11 |
| AB07 | A2 | S6 | "I don't know" / "I'll check" | dont_know | page stays live; L-OK-A2; stay on | page_live | P0 | G5 |
| AB08 [NEW] | A2 | S4 | Grandmother: "she went to school" | non-guardian | page stays; principal + security now | missing_on_campus | P0 | NG2, NG11 |
| AB09 [NEW] | A2 | S6 | Panic | is_my_child_ok | L-OK-A2; say who calls back from which number; stay | page_live | P0 | DIR |
| AB10 [NEW] | A2 | S6 | "With me" but low confidence / noisy | low confidence | no downgrade; page stays | page_live | P0 | G5 |
| AB11 | A2 | S7 | "haan?" at the read-back (greeting or ack) | ack | second explicit confirmation required | — | — | G1 |
| AB12 | A2 | S6 | Panic: "kya?! school nahi pahunchi?" | is my child OK | L-OK-A2; stay on until the parent ends | page_live | P0 | v2 |
| AB13 | A2 | ANY | Parent hangs up | — | — | hung_up | P0 unchanged | G5 |
| AB14 | A2 | ANY | Engine failure | — | fallback recording plays "the school will call you back" | engine_failed | P0 unchanged | G5, CHAOS |
| AB15 | A2 | S4 | Unverified or shared number | — | tier-1 form: "class teacher aapse aaj zaroori baat karna chahti hain" | — | P0 | G2 |
| AB16 [NEW] | A2 | S6 | "Woh school mein hi hai, dobara dekhiye" | attendance_dispute | page stays; teacher checks | attendance_dispute | P0 | DIR |
| AB17 [NEW] | A2 | S0 | Family has opted out of routine calls | — | no robocall; staff page only, and the teacher phones by hand | page_only | P0 | DIR |
| AB18 [NEW] | A2 | IN | Parent missed the A2 call and calls back | inbound with an open page | as IN02 | — | P0 notify | DIR |

### 3.7 Recognition (A5)

| ID | Use case | Stage | Edge case (sample) | Detection | Behaviour | Outcome | Escalation / retry | Test |
|---|---|---|---|---|---|---|---|---|
| RC01 | A5 | S2 | "Tareef ke liye call? Fraud?" | is this genuine | L-GENUINE | — | — | v2 |
| RC02 [EXT] | A5 | S8 | "Kya kiya usne?" | question | replay the teacher's note word for word; "Aur baat Rai ma'am batayengi." | — | — | DIR |
| RC03 [EXT] | A5 | S6 | Wants to leave a message | message | ask consent first; read back; hold as pending | message_pending | — | G7 |
| RC04 [NEW] | A5 | S6 | The message contains a complaint or a safeguarding concern | split | complaint → call-back; safeguarding → SF01, and that part is taken out of the pending message | — | P1 / P0 | G6 |
| RC05 [NEW] | A5 | S6 | "Pema ko phone deti hoon" | handover to child | A5 only: one praise line to the child; nothing recorded from the child | heard_by_child_also | — | DIR |
| RC06 [NEW] | A5 | S8 | "Aur mere doosre bete ka?" | which child | "Mere paas sirf Pema ke liye sandesh hai." | — | — | DIR |

### 3.8 Parent input for the holistic card (A7)

| ID | Use case | Stage | Edge case (sample) | Detection | Behaviour | Outcome | Escalation / retry | Test |
|---|---|---|---|---|---|---|---|---|
| HC01 [EXT] | A7 | S4 | Declines consent | consent no | "Koi baat nahi. Class teacher se kabhi bhi baat kar sakte hain." | consent_declined | R0 | G7 |
| HC02 [NEW] | A7 | S4 | Someone other than a guardian gives consent | non-guardian | not valid; ask for a parent, else end | consent_invalid | RP | NG2 |
| HC03 [NEW] | A7 | S6 | "Aap hi likh lo"; "kuch nahi pata" | no input | one example prompt, then skip the question; never make up an answer | input_none(q) | — | DIR |
| HC04 [NEW] | A7 | S6 | A parenting statement that suggests harm | safeguarding cue | as SF09; left out of the draft | dsl_review | P1 DSL | G6 |
| HC05 [NEW] | A7 | S6 | Mentions other children | third-party data | redacted in the teacher's draft | — | — | G3 |
| HC06 [NEW] | A7 | S6 | Health details | health_info | flagged for the teacher; never put on the card automatically | — | — | G7 |
| HC07 [NEW] | A7 | S7 | Read-back risk: a model summary can invent facts about the child | — | read back the parent's own key phrases word for word, never a summary; at most 2 corrections, then the teacher takes over | input_captured_pending | — | DIR (read-back text must be a substring of the transcript) |
| HC08 [NEW] | A7 | S6 | "Pema yahin hai, usse pooch lo" | child input | "Yeh hissa aapki baat ke liye hai." | — | — | DIR |
| HC09 [NEW] | A7 | S6 | Both parents on speaker, disagreeing | several speakers | record both as "parents said"; don't resolve it | — | — | PER |
| HC10 [NEW] | A7 | S8 | "Marks par asar padega?" | question | "Nahi, yeh aapki raay hai, iske marks nahi hote." | — | — | DIR |
| HC11 [EXT] | A7 | ANY | The 8-minute cap hits mid-answer | cap | read back what was captured; the teacher continues | partial | P2 | DIR |
| HC12 [NEW] | A7 | S8 | "Teacher ne kya likha?" | question | "Class teacher card aapke saath share karengi." | — | — | DIR |

### 3.9 Fees due or overdue (C1/C2)

| ID | Use case | Stage | Edge case (sample) | Detection | Behaviour | Outcome | Escalation / retry | Test |
|---|---|---|---|---|---|---|---|---|
| FE01 | FE | S4 | Non-guardian, or a number that isn't verified | — | tier-1 form | — | — | G2 |
| FE02 [EXT] | FE | S6/S7 | "ফি তো দিয়ে দিয়েছি"; "फी त तिरिसकें"; "fees de di" | already_paid | read back; noted | already_paid_claim | P2 accounts; second fee call held until accounts checks | G9 |
| FE03 [EXT] | FE | S6 | Paid part of it, or paid yesterday in the app | partial_paid | noted | partial_paid_claim | P2 | G9 |
| FE04 | FE | S6 | "Amount galat hai, concession hai" | amount_dispute | accounts call-back, flagged sensitive | — | P1 | v2 |
| FE05 [NEW] | FE | S6 | Hardship: "naukri chali gayi"; "এখন পারব না, হাতে টাকা নেই" | hardship | "Accounts office aapse baat karega." | hardship (sensitive) | P1 accounts (C3); all remaining automated fee calls for this due are stopped | G9 |
| FE06 | FE | S6 | "Instalment mein de sakte hain?" | payment_plan | accounts call-back; no promise | — | P1 | v2 |
| FE07 [EXT] | FE | S8 | "Exam mein nahi baithne denge?"; "late fine lagega?" | consequence | L-NOCONSEQ | — | — | G9 |
| FE08 [NEW] | FE | S6 | "Hum RTE mein hain" | rte_claim | apologise and end; never repeat the amount | rte_reported | P1 accounts; RX all fee calls | G9 |
| FE09 | FE | S6 | "UPI / QR / link do" | payment | L-NOPAY | — | — | G9 |
| FE10 [NEW] | FE | S6 | Reads out card or UPI digits | digit run | as RQ13 | — | — | NG3 |
| FE11 [NEW] | FE | S4 | Grandparent on a verified number | relation | tier-1 form (as W02) | — | — | NG2 |
| FE12 [NEW] | FE | S5 | Siblings: one has fees due, the other has paid | bundle | amounts per child only; read back per child | per-child | — | DIR |
| FE13 [EXT] | FE | S6 | "Har baar fees ke liye call!" | complaint / opt-out | offer the opt-out scope "fee calls only" | opt_out(fees) | — | DIR |

### 3.10 Documents pending (C4)

| ID | Use case | Stage | Edge case (sample) | Detection | Behaviour | Outcome | Escalation / retry | Test |
|---|---|---|---|---|---|---|---|---|
| DC01 [EXT] | C4 | S8 | "Kaunsa document?" | question | list from the facts | — | — | DIR |
| DC02 [EXT] | C4 | S6 | "Jama kar diya" | already_submitted | noted; reminder held | already_submitted_claim | P2 | DIR |
| DC03 [NEW] | C4 | S6 | "Birth certificate kho gaya" | document lost | office call-back | — | P1 | DIR |
| DC04 [NEW] | C4 | S6 | "WhatsApp pe photo bhej doon?" | channel request | only the office procedure from the facts | — | — | DIR |
| DC05 [NEW] | C4 | S8 | "APAAR zaroori hai? Data share hoga?" | question(APAAR) | L-APAAR | — | — | NG10 |
| DC06 [NEW] | C4 | S6 | "APAAR nahi dena" | refusal | "Theek hai, office ko bata deti hoon." No persuasion | apaar_declined | P2 | NG10 |
| DC07 [NEW] | C4 | S6 | Reads out an Aadhaar number | digit run | as RQ13 | — | — | NG3 |

### 3.11 Re-enrolment (C5) and deadlines (C6)

| ID | Use case | Stage | Edge case (sample) | Detection | Behaviour | Outcome | Escalation / retry | Test |
|---|---|---|---|---|---|---|---|---|
| RE01 [NEW] | C5 | S6 | Different answer per child (yes / no / undecided) | per child | read back per child | per-child | — | DIR |
| RE02 [NEW] | C5 | S6 | "School badalne ka soch rahe hain" | undecided / no | no attempt to keep them: "Theek hai, office ko bata deti hoon." | undecided | R0 | NG10 |
| RE03 [EXT] | C5 | S8 | "Fees badhegi?" | question | fact, else accounts | — | — | DIR |
| RE04 [NEW] | C5 | S6 | "TC le liya" | left_school | as IA08 | withdrawn_reported | P2 | DIR |
| DL01 [NEW] | C6 | S8 | "Mera bachcha eligible hai?" | question(eligibility) | never judges eligibility; L-OFFICE | — | — | lint |
| DL02 [NEW] | C6 | S6 | "Aap form bhar do" | request | "Yeh office mein hoga." | — | — | DIR |
| DL03 [NEW] | C6 | S6 | "Registration mein naam galat hai" | record_mismatch | L-DATA | data_dispute(name) | P1 office (deadline matters) | DIR |
| DL04 [EXT] | C6 | S8 | "Link bhejo" | question | no links; the portal name from the facts | — | — | lint |
| DL05 [EXT] | C6 | S6 | "Registration ho gaya" | already done | noted | already_done_claim | P2 | DIR |

### 3.12 Inbound call-backs (F)

| ID | Use case | Stage | Edge case (sample) | Detection | Behaviour | Outcome | Escalation / retry | Test |
|---|---|---|---|---|---|---|---|---|
| IN01 [EXT] | F | IN | Parent calls back the number that rang (before phase 5) | inbound | static message in the language on record for that number (else 4 languages, 10 s or less each), plus the office number and hours | inbound_static | — | DIR |
| IN02 [NEW] | F | IN | Missed an A2 call: "aapka call aaya tha?" | inbound with an open A2 page | tier 1: "Pema ki class teacher aapse turant baat karna chahti hain; woh [N] minute mein call karengi." | parent_called_back | P0 notify the paging chain | DIR |
| IN03 [NEW] | F | IN | Anxious call-back after a missed routine call | inbound + recent intent | name the tier-0 purpose: "School ka call PTM ke baare mein tha." | inbound_purpose_told | — | DIR |
| IN04 [NEW] | F | IN | "Call mat karo" | opt-out | honoured for this number (routine calls); office confirms | opt_out_pending_confirm | P2 | G10 |
| IN05 [EXT] | F | IN | Calls back at night | outside hours | static message + hours; nothing recorded | — | — | DIR |
| IN06 [NEW] | F | IN | 3 or more call-backs in an hour | rate | static message; office flagged | — | P2 | DIR |
| IN07 | F | IN | A stranger: "kisne call kiya?" | — | static message | — | — | v2 |
| IN08 | F | IN | Reports the child absent (phase 5) | — | note for the teacher, never an attendance record | — | — | SAMPARK §2F |
| IN09 [NEW] | F | IN | Emergency disclosed on an inbound call | urgent | SF lines | — | P0 | NG7 |
| IN10 [NEW] | F | IN | Calls in while our outbound call to that number is ringing | race | cancel the outbound call | — | — | RACE |
| IN11 [NEW] | F | IN | Wants calls turned back on | — | office confirms; never by voice alone | — | P2 | DIR |

## 4. Additions to the closed intent list

v2 already has 19 intents: yes · ack · no · not sure · question · repeat · who is calling · is this genuine · is my child OK · already know · which child · hold on / hand over · call me at a time · wants a person · upset or complaint · safeguarding disclosure · stop these calls · wrong number · bye.

**Universal additions (12):**

| Intent | Covers | Director action |
|---|---|---|
| `busy_now` (driving, at work, unwell, whispering) | PS01–03, SP07 | stop now; L-CORE if time-critical; RD |
| `cannot_hear` | SP09, AC02 | L-LOUD, then L-CANTHEAR; RN |
| `language_request(lang)` | LG04–LG06, LG08 | route per readiness (rule 9 no longer has to infer it) |
| `grief` | PS04, W18 | L-CONDOLE; 14-day routine pause |
| `urgent_danger` (medical, missing, happening now, en route, threat) | SF03–SF06, CL02, TR03, AB04 | emergency line + P0; separate from `safeguarding_disclosure`, which goes to the DSL without the urgent line |
| `record_mismatch(field)` (child, class, name, booking, transport) | IA09–IA10, MT14, TR05, DL03 | L-DATA; P2; hold the intent |
| `left_school` | IA08, RE04 | L-DATA; RX family |
| `guardian_change` (deceased, custody, not living with child, not on record) | W18–W20 | per row; sensitive P1/P2 |
| `redirect` (other guardian of record, or a new number) | IA15, RQ07 | queue a guardian of record; never capture a spoken number |
| `channel_or_message` (WhatsApp / SMS / message for the teacher) | RQ08, RQ09 | L-NOCHAN / L-NOMSG |
| `fact_dispute` | MT07, CL06 | office line; counts toward the breaker |
| `side_talk` | SP05 | wait, then re-ask |

Two more universal intents are needed to route correctly; they record no feeling or opinion: `abusive_or_inappropriate` (PS07, PS13) and `not_sure` gaining a `condition` slot (IA03).

**Signals detected in code, not by the model:** `dtmf_digit` (NG6), `digit_run` (NG3), `ai_screener`, `business_line`, `self_echo`, `hangup_cause` (normal clearing vs abnormal).

**Per-purpose additions:** B1/D1/B4 `yes_late`, per-child slots, `headcount`, `cancel` · B2 `attendee` · D4 `child_en_route` · D5 `transport_incident`, `stop_removed` · D6 `cannot_collect`, `alternate_pickup` · D7 `symptom_report`, `identity_probe` · request to talk `consequence_question` · A2 `with_family_home`, `with_other_guardian`, `on_the_way_late`, `dropped_at_school`, `dont_know`, `attendance_dispute` (`with_me` exists) · A5 `handover_to_child` · A7 `correction`, `no_input`, `child_input` · fees `partial_paid`, `amount_dispute`, `hardship`, `payment_plan`, `rte_claim`, `consequence_question` · C4 `already_submitted`, `document_lost`, `apaar_refusal` · C5 per-child yes/no/undecided · C6 `eligibility_question`, `already_done`.

## 5. New class gates (NG1–NG12)

1. **NG1 — retry semantics.** `answered_deferred`, `dropped` and `hung_up_disclosure` get exactly one re-call; heard-and-decided gets none. Includes a race test with a crash after hangup.
2. **NG2 — relation allowlist per tier.** A grandparent, sibling or self-claimed guardian never hears tier-2 content or gives valid consent.
3. **NG3 — digits from parents.** No run of 4 or more digits from a parent's speech is persisted; a spoken number never becomes a contact record.
4. **NG4 — parent dates and numbers.** A corpus of relative, festival and cross-language dates and numbers always ends in an absolute read-back; "next Thursday" always triggers a question.
5. **NG5 — word-list collisions.** A regression set (আসি, "theek hai theek hai", "pareshan mat hoiye", "Yes I can come") never ends or opts out a call unless the model agrees or the parent confirms.
6. **NG6 — keys in the audio.** 1/2/9 tones in the 8 kHz stream are detected at least 99% of the time, with zero false positives across the speech corpus.
7. **NG7 — urgent lines.** Seeded "happening now" disclosures in all four languages always play the emergency line and page P0 within 5 s, and never cause an automated call-back to that number.
8. **NG8 — fact-dispute breaker.** N disputes of the same fact pause the campaign; for D4 they alert the principal instead.
9. **NG9 — shared numbers.** A number linked to several families gets at most one routine call a day, and no child name from another family.
10. **NG10 — no coercion, no retention.** A lint on the C4, C5 and C6 answer banks blocks words like "compulsory", "otherwise", "must", "discount" and "offer".
11. **NG11 — A2 severity.** "Dropped at school / on the bus" skips the timer; "late" re-arms at T+60; "at home with family" needs a teacher acknowledgement or it re-pages.
12. **NG12 — proxy answers.** An RSVP, opt-out or consent from a self-identified non-guardian is never written as the family's decision.

## 6. Diagrams

See `docs/sampark/EDGE_CASES.md` §4 for the universal flow with every edge-case branch, the PTM and A2 sequence diagrams, the call lifecycle with failure branches, and the campaign lifecycle.
