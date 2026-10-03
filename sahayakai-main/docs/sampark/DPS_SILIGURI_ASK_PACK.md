# DPS Siliguri ask pack

Source: `SAMPARK_PLAN.md` sections 6, 10, 15 and 17 (on branch
`feature/school-parent-calling`), plus gaps found while preparing this pack.
Everything about Entab and Knowlarity comes from public sources checked on
1 Oct 2026 and is unverified until they answer. All wording below marked
**DRAFT** is for counsel and native-speaker review. It is not final copy.

Contents: 1 School questions, 2 Entab questions, 3 Knowlarity questions,
4 Consent-and-language drive kit, 5 Native-reviewer brief, 6 First Entab export.

---

## 1. Questions for the school

Who answers: principal (A), office/admin (B), accounts (C), IT/ERP admin (D).

**Records and phone line**

1. Which number is the Knowlarity SuperReceptionist number, and which number do
   parents actually recognise as "the school"? (B)
2. Which Knowlarity plan is the school on, and who holds the admin login? (B, D)
3. Who holds the Entab CampusCare 10X admin login, and can that person run and
   download reports today? (D)
4. Is DPS Fulbari in scope for this pilot? Is it on the same Entab tenant? (A)
5. Are guardian mobile numbers complete for every child? Roughly what share are
   father, mother, other? Which number does the parent use to log in to 10X? (B)
6. Do you record a preferred language per family anywhere (Entab, admission
   form, paper)? If not, who can ask? (B)

**Regulatory and contract**

7. Is the school registered on DLT as a principal entity? With which operator,
   and in whose name is the caller-ID KYC? (A, D)
8. Will the school file the robo-call declaration with its operator, and who
   signs? (A)
9. Will the school sign a data-processing agreement naming SahayakAI as
   processor and listing Google and Vobiz as sub-processors? Who signs? (A)
10. Does your Entab contract guarantee you access to your own data, including
    exports? Does Entab sell its own parent-communication module? (A, D)

**Operations and rules**

11. Calling window you will adopt (plan default 10:00-20:00 IST, no Sundays or
    holidays, no concern calls Friday/Saturday). Closure calls from 06:00 need
    the principal's approval: who may give it? (A)
12. Who approves each type: class teacher (attendance, academic), coordinator
    (conduct, campaigns), accounts (fees), transport desk, principal
    (meetings, closures)? (A)
13. Office hours for returning call-backs; who owns them; target turnaround
    (plan: one school day). (B)
14. Who are your three native reviewers (one Nepali, one Bengali, one Hindi
    speaking teacher) and when can they give about two hours each? (A)
15. Do you have boarders, a transport desk, RTE-quota or fee-waived students
    (they are excluded from fee calls)? How are they flagged in Entab? (B, C)
16. Are there children with custody restrictions or counsellor referrals, and
    how are they recorded? (A)
17. What does the school already send by WhatsApp, SMS or the Entab app, so
    Sampark calls only families not reached? (B)
18. Will you run the consent-and-language drive (section 4) and who owns it?
    Target 70% coverage before live calls. (A, B)
19. Can you give one anonymised term of data (section 6) for the rule backtest? (D)
20. Whether closure calls may reach families who have not consented is a legal
    question for counsel; does the school's own counsel have a view? (A)

## 2. Questions for Entab

1. Is a scoped, read-only partner API possible for DPS Siliguri, on what terms
   and cost? (Entab has built custom APIs for banks and gateways; none is
   documented for schools.)
2. Can report exports be scheduled, emailed or placed on SFTP? Which reports,
   what formats (Excel, CSV), and how often?
3. Which import templates (registrations, fee dues, marks, transport) can carry
   call outcomes back, and can a custom field or remark column hold one?
4. How is the holistic progress card's parent section stored, and can it be
   imported or exported?
5. Will Entab sign data-processing terms with SahayakAI as sub-processor, or
   accept the school's instruction to share exports with us?
6. Is there a preferred-language field or consent field per guardian? If not,
   can one be added?
7. How are guardians and sibling relationships represented (two children, one
   mobile; blended families with different guardians of record)?
8. Does the 10X login OTP number always equal the primary guardian mobile?
9. Are the same exports available for DPS Fulbari under one login?
10. What is the change-notification policy if export column headings change?
    (We will keep a saved column mapping.)
11. Do you plan any Entab-Knowlarity integration we should avoid duplicating?

## 3. Questions for Knowlarity

1. Can the school's number be the caller ID for automated service calls on the
   current plan? Who is the originating telecom operator?
2. Audio files need manual approval by support: typical turnaround, and can it
   be expedited for emergency closure clips? Can four-language closure clips be
   pre-approved in advance?
3. Can keypad presses arrive as a live per-call webhook? Payload fields?
4. Is the audio-streaming WebSocket generally available, and on which plan?
5. Click-to-call API: can staff return a parent's call so the parent sees the
   school number? Rate limits, recording policy, cost.
6. Can an IVR option ("press 9 to reply to today's call") forward to a Sampark
   number, and can the per-call webhook identify the caller?
7. 2026 rates: per minute, per channel, concurrency, number rental. (Public
   figures date from 2022.)
8. Is Knowlarity DLT-registered and what does it need from the school to
   carry service calls under the school's entity?
9. Does Knowlarity file the robo-call intimation to the operator, or does the
   school? How does it label automated calls?
10. Recording storage location, retention, and sub-processor list.

Also to confirm in writing with Vobiz (our dialer, not Knowlarity): per-minute
rate, billing unit, channel count, calls per second, a dedicated number
registered to the school, and whether Vobiz is a licensed operator or a
reseller.

---

## 4. Consent-and-language drive kit

### 4.1 Admission-packet consent line (DRAFT for counsel and native-speaker review)

Plain wording, four languages. Intent: one itemised notice, per purpose group,
never a condition of admission, withdrawal as easy as giving. Counsel should
settle the legal wording, the notice version number and whether this is
enough for DPDP purposes. Native reviewers should settle register and
vocabulary. Do not print any of this until both reviews are done.

**English (DRAFT)**
> Delhi Public School Siliguri may phone the mobile number(s) I give below with
> recorded or AI-voice messages about my child: school notices and meetings,
> attendance, progress and fee reminders. I choose which kinds below. Calls
> will be in the language I choose. I can stop these calls at any time by
> pressing 9 on a call or telling the school office. Saying no will not affect
> my child's admission or education. Emergency closure notices may still be
> sent.
> [ ] School notices and events  [ ] Attendance, progress, conduct
> [ ] Fee and admin reminders  [ ] Conversation with an AI voice assistant, which may be recorded
> Preferred language: [ ] English [ ] Hindi [ ] Bengali [ ] Nepali
> Name / relation / mobile / signature / date

**Hindi (DRAFT)**
> दिल्ली पब्लिक स्कूल सिलीगुड़ी मेरे नीचे दिए मोबाइल नंबर पर मेरे बच्चे के बारे में रिकॉर्ड किए हुए या एआई आवाज़ वाले संदेश के लिए फ़ोन कर सकता है: स्कूल की सूचनाएँ और बैठकें, उपस्थिति, प्रगति और फ़ीस की याद। किस तरह की कॉल चाहिए, यह मैं नीचे चुनता/चुनती हूँ। कॉल मेरी चुनी हुई भाषा में होंगी। मैं किसी भी समय कॉल पर 9 दबाकर या स्कूल कार्यालय को बताकर ये कॉल बंद करा सकता/सकती हूँ। मना करने से मेरे बच्चे के दाख़िले या पढ़ाई पर कोई असर नहीं पड़ेगा। आपातकालीन बंदी की सूचना फिर भी भेजी जा सकती है।

**Bengali (DRAFT)**
> ডেলহি পাবলিক স্কুল শিলিগুড়ি আমার নিচে দেওয়া মোবাইল নম্বরে আমার সন্তানের বিষয়ে রেকর্ড করা বা এআই কণ্ঠের বার্তা দিয়ে ফোন করতে পারে: স্কুলের বিজ্ঞপ্তি ও সভা, উপস্থিতি, অগ্রগতি এবং ফি-এর মনে করিয়ে দেওয়া। কোন ধরনের ফোন চাই, তা আমি নিচে বেছে দিচ্ছি। ফোন আমার বেছে নেওয়া ভাষায় হবে। আমি যেকোনো সময় ফোনে নয় টিপে বা স্কুল অফিসকে জানিয়ে এই ফোন বন্ধ করতে পারি। না বললে আমার সন্তানের ভর্তি বা পড়াশোনায় কোনো প্রভাব পড়বে না। জরুরি ছুটির বিজ্ঞপ্তি তবুও পাঠানো হতে পারে।

**Nepali (DRAFT)**
> डेल्ही पब्लिक स्कुल सिलिगुडीले मैले तल दिएको मोबाइल नम्बरमा मेरो बच्चाको बारेमा रेकर्ड गरिएको वा एआई आवाजको सूचना दिन फोन गर्न सक्छ: स्कुलका सूचना र बैठक, उपस्थिति, प्रगति र फी सम्झना। कस्ता फोन चाहिन्छ भनेर म तल छान्छु। फोन मैले छानेको भाषामा हुनेछ। म जुनसुकै बेला फोनमा नौ थिचेर वा स्कुल कार्यालयलाई भनेर यी फोन बन्द गराउन सक्छु। नभनेकोमा मेरो बच्चाको भर्ना वा पढाइमा कुनै असर पर्दैन। आपतकालीन बन्दको सूचना भने पठाइन सक्छ।

Open points for counsel (not decided here): whether a paper tick on an
admission packet is valid consent for each purpose group; verifiable parental
consent for children's data (DPDP) and whether the school-exemption covers any
of these calls; wording on recording; wording on emergency closures to
non-consenting families; notice version and retention statement.

### 4.2 QR-form field list

Mobile web form, four-language toggle at top, under 2 minutes, no login.

| Field | Type | Notes |
|---|---|---|
| Form language | toggle EN/HI/BN/NE | defaults to the browser language, parent can change |
| Child admission number | text | validated against the Entab export; mismatch goes to a review queue |
| Child name | text | for confirmation only; never machine-transliterated |
| Class and section | dropdown | |
| Respondent name | text | |
| Relationship to child | dropdown | mother, father, other guardian of record, other |
| Is this person a guardian of record? | yes/no | blocks bundling for non-guardians |
| Mobile number to call | tel (+91) | validated; second box to confirm |
| Is this the number registered for the school app? | yes/no | |
| Preferred call language | radio EN/HI/BN/NE | "other" free text, goes to the office |
| Language spoken at home | radio/free text | helps Nepali vs Hindi vs Bengali decisions |
| Consent: notices and events | checkbox, unticked by default | |
| Consent: attendance, progress, conduct | checkbox, unticked | |
| Consent: fee and admin reminders | checkbox, unticked | |
| Consent: AI-voice conversation, may be recorded | checkbox, unticked | |
| Best time to call (informational) | dropdown | does not widen the allowed window |
| Request not to be called | checkbox | writes to suppression list |
| Notice version shown | hidden | stored with the answer |
| Timestamp, form language, source (QR/WhatsApp/paper) | hidden | audit |
| Office-use: data-entry initials, paper form scan id | text | paper packet entries |

### 4.3 70% coverage tracking sheet (columns)

One row per child. Coverage = children with at least one guardian who has a
recorded answer on language AND a consent decision (yes or explicit no), out
of all children in scope. Report it overall, per class-section and per
language.

| Column | Meaning |
|---|---|
| admission_no | key |
| child_name, class_section | |
| guardian_1_name, relation, mobile_last4 | full numbers stay in the encrypted store |
| guardian_2_name, relation, mobile_last4 | |
| is_guardian_of_record | yes/no per guardian |
| language_preferred | EN/HI/BN/NE/other/unknown |
| language_source | form, paper, phone, school record |
| consent_notices | yes/no/blank |
| consent_progress | yes/no/blank |
| consent_fee_admin | yes/no/blank |
| consent_conversation | yes/no/blank |
| notice_version | |
| answered_on, channel | QR, packet, WhatsApp group, PTM desk, phone |
| opt_out | yes/no, date |
| status | not contacted / reminded 1 / reminded 2 / answered / refused / unreachable |
| last_reminder_on, owner | |
| covered | formula: language known AND consent decision present |
| flags | RTE/fee-waived, sensitive flag, no mobile, number invalid |

Weekly roll-up: covered children, total children, % (target 70%), split by
language, list of classes below 50%.

---

## 5. Native-reviewer brief

Audience: one Nepali-, one Bengali-, one Hindi-speaking teacher of the school.
About two hours each. They sign off the school's own voice.

**What you will receive:** the written scripts per language (PTM, event,
emergency closure, fee reminder, request to talk, opt-out confirmation, and the
consent line) and the audio of each, rendered by the text-to-speech engine.

**Listen to the audio, not just the text.** Written text can look right and
sound wrong. For each clip, answer yes/no and write the exact second where it
fails.

1. **Right language and register.** Does it sound like a local parent's own
   language, in the everyday register? Nepali: Darjeeling/Siliguri spoken
   Nepali, not formal Kathmandu office language. Bengali: West Bengal
   (not Bangladesh) vocabulary and accent. Hindi: plain, not Sanskritised, and
   gender-neutral toward the listener (mothers answer too).
2. **Nepali versus Hindi.** Devanagari hides the difference. Does any Nepali
   clip contain Hindi words or Hindi grammar (है, हैं, नहीं, आपका, में, लिए,
   करें)? Report each one.
3. **Numbers, dates, amounts, times.** Are they read as the right words in the
   right language (for example "twelve thousand five hundred rupees")? Are
   dates and weekdays right? Any digit read one at a time?
4. **Letters and abbreviations.** "Class 7B", "OTP", "SMS", "PTM": spoken as
   words a parent would say? Report any read as odd sounds (for example a
   class letter heard as a unit or word).
5. **Names.** School name, child name, teacher name: pronounced as the family
   says them? Names must never be a different-looking script transliteration.
6. **Pronunciation and stress.** Any word mispronounced, wrong stress, wrong
   vowel length, run together, or a pause in the wrong place?
7. **Speed and clarity on a phone.** Would it be clear on a poor mobile line?
   Too fast, too slow, too long a sentence before its verb?
8. **Tone.** Warm and respectful, not threatening, not a summons. Fee clip: no
   pressure or consequence. Request-to-talk clip: does it make a parent fear a
   problem?
9. **Keys.** Is "press 1 / 2 / 9" clear and does each key's meaning match the
   words? Is the opt-out instruction understandable?
10. **Disclosure.** Does the parent clearly hear that it is a recorded message
    or an AI voice? Is the wording natural and not alarming?
11. **Cultural and safety.** Anything offensive, wrong for the community, or
    mentioning a festival or holiday wrongly? Anything that could embarrass a
    family if overheard (the clip must name no child's problem before the
    listener check)?
12. **Meaning.** Does the audio say exactly what the English says, no more? Any
    invented word or date, any sentence that changed meaning?

**Output per reviewer:** a sheet with columns: clip id, language, pass/fail,
second of problem, what was heard, suggested fix (in script). Plus an overall
sign-off line: "I reviewed these clips on [date] and they are acceptable for
parents of DPS Siliguri / need changes as listed." Nothing goes live in a
language without that sign-off.

Also ask the Bengali reviewer, a West Bengal listener, to choose between the
two candidate Bengali voices (the Gemini one is Bangladesh-locale; the other
is India-locale).

---

## 6. Data needed in the first Entab export

Ask for one full term, anonymised for the backtest if the school prefers
(replace names and numbers consistently, keep one stable key). If names stay,
the school's data-processing agreement must be signed first. Excel or CSV,
one file per report, UTF-8 (names in Nepali, Bengali and Devanagari must
survive).

**Student master**

| Column | Why |
|---|---|
| admission_no | stable key |
| student name (and local-script name if held) | greeting, never machine-transliterated |
| class, section, roll no | targeting |
| date of birth or age band | child under 18 flag |
| gender | disparity report only |
| academic session, status (active/left/TC) | exclude left students |
| fee category (general, RTE, staff ward, waived) | fee-call exclusion |
| transport: route, stop, bus no | closure and bus notices |
| boarder flag, house | boarders only |
| sibling group id or sibling admission nos | one call per guardian |
| any flags that mean "do not auto-call" (custody, counsellor, medical) | sensitive suppression, reason codes only |

**Guardians**

| Column | Why |
|---|---|
| admission_no | join |
| father name, father mobile; mother name, mother mobile; other guardian name, relation, mobile | who to call |
| guardian of record (which one) | bundling and consent |
| mobile registered for the 10X app login | best-verified number |
| alternate and landline numbers | fallback, never first choice |
| preferred language / mother tongue / home language, if any | language |
| email, address | not needed; do not send |

**Attendance:** admission_no, date, status (present/absent/late/leave),
leave-note flag, marked-by, marked-at. One term, daily.

**Assessments (marks):** admission_no, exam name, date, subject, marks
obtained, max marks, absent flag (so a missed test is never scored as zero).

**Fees:** admission_no, fee head, instalment no, due date, amount due,
amount paid, paid date, status, concession type.

**Holistic progress card (if it exists in Entab):** admission_no, term,
respondent (teacher, self, peer, parent, other), domain or subject, ability
(Awareness, Sensitivity, Creativity), rubric level and scale id, comment text
flagged as confidential or not. Reason codes only for confidential notes.

**Behaviour / incident notes (if kept):** admission_no, date, author role,
category, positive or concern. Exclude nurse and counsellor notes entirely.

**Calendar and staff:** school holidays and exam dates; class teacher per
section; coordinator names. (No staff phone numbers needed.)

**Metadata:** export date and time, Entab report name and version, row counts,
the column headings exactly as they appear (we build the saved mapping from
them), and whether any filter was applied.
