# Sahayak AI Parent Calling: School Administrator Guide

> **Document status: PRE-RELEASE DRAFT, not for distribution yet**
>
> - The parent-calling feature described here has been checked with automated tests and a simulated phone call. **It has not yet been tested on a real phone call.** Some things in this guide may change after that test.
> - Several policies are **not yet decided**. They are marked **[TO BE CONFIRMED BY SCHOOL/COMPANY]**. Do not treat them as commitments.
> - Items marked *(awaiting real-phone verification)* describe how the feature is designed to behave. They have not been confirmed on a live call.
> - Version: [Version number] · Date: [Date] · Approved by: [Name, role]

---

## Contents

1. [Introduction](#1-introduction)
2. [How the system works](#2-how-the-system-works)
3. [Initial setup and readiness](#3-initial-setup-and-readiness)
4. [School responsibilities](#4-school-responsibilities)
5. [Privacy and responsible use](#5-privacy-and-responsible-use)
6. [Languages and call availability](#6-languages-and-call-availability)
7. [Monitoring and follow-up](#7-monitoring-and-follow-up)
8. [Safety and escalation](#8-safety-and-escalation)
9. [Troubleshooting](#9-troubleshooting)
10. [Frequently asked questions](#10-frequently-asked-questions)
11. [Implementation and support](#11-implementation-and-support)

---

## 1. Introduction

### What this feature does

Sahayak AI helps teachers reach parents about a specific student. A teacher picks a reason (for example, several days of absence), and Sahayak AI drafts a short, respectful message in the parent's language. The teacher then chooses one of two ways to send it:

- **Phone call.** An automated voice assistant phones the parent, introduces itself as calling from the school on the teacher's behalf, and gives the teacher's message. The parent can then talk back and ask questions. After the call, the teacher sees the call outcome, a written summary and a transcript.
- **WhatsApp copy.** The message is copied so the teacher can paste it into WhatsApp and send it personally.

### Who this guide is for

- Principals, head teachers and school administrators deciding whether and how to use the feature.
- Staff who coordinate parent communication or handle parent concerns.

Teachers have a separate guide: *Sahayak AI Teacher Guide*.

### What this feature is not

- It is **not** a bulk or broadcast calling tool. Each call is started by a teacher, for one student, after the teacher has reviewed the message.
- It is **not** an emergency or safeguarding channel. Urgent or sensitive matters need a direct conversation with a staff member (see Section 8).
- It does **not** replace the teacher. The assistant passes on the teacher's message and records what the parent says. Any follow-up is the school's responsibility.

---

## 2. How the system works

### The flow, step by step

| Step | Who | What happens |
|---|---|---|
| 1 | Teacher | Opens their class in the Attendance section and chooses **Contact** next to a student. Students who may need attention are also listed under **Needs outreach today**. |
| 2 | Teacher | Selects a reason: **Consecutive Absences**, **Academic Concern**, **Behavioral Concern** or **Positive Feedback**. |
| 3 | Teacher | Optionally adds a short note with specific details. |
| 4 | Sahayak AI | Drafts a message in the parent's language. It uses the student's recent attendance or marks where relevant. |
| 5 | Teacher | Reviews the message and either asks for a new version (**Regenerate**), copies it for WhatsApp, or chooses **Call Parent**. |
| 6 | System | Before dialling, it checks that the teacher owns the class, uses the parent's phone number stored on the student's record, checks the calling hours and the school's plan, makes sure the student was not contacted in the last few minutes, and confirms that the parent has not asked to stop receiving calls. |
| 7 | Parent's phone | Rings from the service's calling number. |
| 8 | Parent | Answers and hears a short recorded greeting in their language. The assistant then introduces the school and the teacher, checks that it is speaking to the child's parent, gives the teacher's message, and invites questions. *(awaiting real-phone verification)* |
| 9 | Assistant | Keeps the call short, says a warm goodbye and hangs up. |
| 10 | Teacher | Sees the outcome, duration, a written summary and the full conversation transcript. |

### What the parent hears

1. A short recorded greeting, roughly: *"Namaste. This is an important message from your child's school."* (in the parent's language).
2. The assistant names the school and the teacher, says it is calling on the teacher's behalf, and checks it is speaking with the child's parent.
3. The teacher's message, said essentially as written.
4. An invitation to ask questions or share concerns. The parent can interrupt at any time.
5. A short, warm goodbye, after which the assistant ends the call.

Things the assistant is instructed **never** to do:

- Ask for money, bank details, one-time passwords (OTPs) or document numbers. If a parent offers them, it tells the parent not to share them.
- Make up marks, attendance figures, dates or incidents.
- Discuss other children, fees, admissions or anything beyond this child and this message. Instead it offers to have the teacher call.
- Claim to be the teacher or give itself a personal name.

These are instructions given to the AI. They have been checked in simulation only. They are not a guarantee. See Section 8.

### Limits built into each call

| Limit | Value |
|---|---|
| Maximum call length | About 10 minutes |
| Parent turns per call | About six, after which the assistant closes the call |
| Silence | If no one speaks for about 45 seconds, the call ends |
| Calling hours | 09:00 to 21:00 India Standard Time (see Section 6) |
| Repeat contact for the same student by the same teacher | Blocked for 5 minutes after a previous attempt (unless that attempt failed to connect at all) |

---

## 3. Initial setup and readiness

### 3.1 What exists in the product today

| Capability | Available to schools? | Notes |
|---|---|---|
| Teachers create classes and add students | **Yes** | In the Attendance section. Each student has a parent phone number (10-digit Indian mobile) and a parent language. |
| Teachers edit a parent's phone number or language | **Yes** | Teachers can do this from the student list. |
| Teacher-started calls, WhatsApp copy, call summaries | **Yes** | From the class page, through the **Contact** button. |
| A school administrator console for calling settings | **No** | There is no screen where a school can switch calling on or off, set hours, choose languages, view all calls across teachers, or manage do-not-call requests. |
| A school-wide history of all parent calls | **No** | Each teacher sees only their own students' calls. In the app, the most recent call for a student is visible for about 24 hours. |
| A screen to view or remove do-not-call requests | **No** | See Section 4.5. |

### 3.2 What needs technical assistance from Sahayak AI

The following are set centrally by the Sahayak AI team, not by the school:

| Setting | Current position |
|---|---|
| Whether phone calling is switched on | Set centrally. If it is off, teachers see only **Copy for WhatsApp**, with no **Call Parent** button. |
| Calling hours (09:00 to 21:00 IST) | Fixed in the product. Changing them needs a product change. |
| Whether the assistant says it is automated at the start of every call | A setting exists. It is currently **off**: the assistant says it is an assistant only if the parent asks. **[TO BE CONFIRMED BY SCHOOL/COMPANY]** |
| Which languages get a full two-way conversation and which get message-only delivery | A setting exists. It currently allows two-way conversation in **all** supported languages. **[TO BE CONFIRMED BY SCHOOL/COMPANY]** |
| Removing a do-not-call request | Needs the Sahayak AI team. **[Process TO BE CONFIRMED BY SCHOOL/COMPANY]** |
| Plan level | Plans are checked per teacher account. Calling and the outreach log need a **School Gold** or **School Premium** plan. Message drafting is not available on the Free plan. |

### 3.3 Readiness checklist (before teachers start calling)

- [ ] Every teacher who will call is on a School Gold or School Premium plan.
- [ ] Sahayak AI has confirmed that phone calling is switched on for the school's teachers.
- [ ] The school has decided the policy items marked **[TO BE CONFIRMED BY SCHOOL/COMPANY]** in Sections 3.2 and 5.
- [ ] Parents have been told that the school may contact them by automated call, and how to ask not to be called. **[Wording TO BE CONFIRMED BY SCHOOL/COMPANY]**
- [ ] Teachers have checked every parent phone number and parent language on their class lists.
- [ ] The school has named a contact person for parent concerns about calls: [School support contact].
- [ ] Teachers have read the Teacher Guide and know when **not** to use an automated call (Section 4.4).
- [ ] The school has agreed how follow-up actions from call summaries will be tracked (Section 7).

---

## 4. School responsibilities

### 4.1 Who may start calls

- In the product, **only the teacher who owns the class** can start a call or see the results for students in that class. Other teachers, including other teachers at the same school, cannot.
- Whether other staff (for example a class coordinator or the principal) should be able to start or review calls is **[TO BE CONFIRMED BY SCHOOL/COMPANY]**. The product does not support this today.
- The school should decide which teachers may use phone calling, and which situations need approval first: **[TO BE CONFIRMED BY SCHOOL]**.

### 4.2 Verifying parent contact details

The call always goes to the phone number saved on the student's record. Nobody can type in a different number at call time. Accurate records are therefore essential.

- Check numbers at the start of term and after any change of guardian.
- Make sure the **parent language** is the language the parent is most comfortable with. The message and the call use this language.
- If a family has two guardians, agree which number is stored. Only one is supported.
- Where custody, guardianship or court orders apply, confirm who may be contacted **before** a number is entered.

### 4.3 Reviewing communications

- Teachers must read every drafted message before sending or calling. The draft is AI-generated and may contain mistakes.
- The draft is written in the parent's language. **If a teacher cannot read that language, they should ask a colleague to check it before calling.**
- On the call, the assistant speaks a shorter, phone-friendly version of the message. This spoken version is prepared automatically and is not shown to the teacher before the call. Teachers should review the transcript afterwards (Section 7).
- The school may want to spot-check transcripts and summaries from time to time: **[Review process TO BE CONFIRMED BY SCHOOL]**.

### 4.4 Sensitive cases: do not use an automated call

Use a personal call or meeting by an appropriate staff member, not the automated assistant, for:

- Safeguarding or child-protection concerns, suspected abuse or neglect.
- Health emergencies, injuries or accidents.
- Bereavement or serious family difficulty.
- Disciplinary matters that could lead to suspension or exclusion.
- Any situation where the right contact person is disputed (custody, separated parents).
- Any situation where a parent has previously complained or asked for personal contact only.

### 4.5 Do-not-call requests

- If a parent says on a call that they do not want to be called again (for example "don't call me again" or "remove my number"), the assistant acknowledges this politely, ends the call and records the request. *(Verified in simulation only. Awaiting real-phone verification.)*
- After that, **any** further automated call to that phone number is refused, for every teacher and for siblings who share the number. The teacher sees a message asking them to contact the parent another way.
- Teachers must never try to get around this, for example by changing the student's phone number to call again.
- Schools can still contact the parent in other ways (WhatsApp, a note home, a meeting), subject to the school's own policy.
- If a parent asks for calls to start again, contact Sahayak AI support. **[Process and proof of consent TO BE CONFIRMED BY SCHOOL/COMPANY]**
- A parent may also ask the school directly, not on a call, to stop automated calls. **There is currently no in-app way for the school to record this.** Until one exists, the school must keep its own list and tell teachers not to call. **[Interim process TO BE CONFIRMED BY SCHOOL/COMPANY]**

---

## 5. Privacy and responsible use

### 5.1 What information is used

| Information | Used for |
|---|---|
| Student name, class, subject | Drafting the message and personalising the call |
| Parent phone number and language | Placing the call in the right language |
| Teacher's name and school name (from the teacher's profile) | So the assistant can say who it is calling for |
| Recent attendance (absent days) | Absence messages |
| Recent marks (up to three recent assessments) | Academic-concern and positive-feedback messages. On a call, marks are mentioned only if the parent asks. |
| Teacher's optional note | Making the message specific |

### 5.2 What is stored after a call

| Stored | Details |
|---|---|
| The outreach record | Reason, teacher's note, drafted message, how it was sent (call or WhatsApp copy), time |
| Call outcome | Status (for example completed, no answer, busy, failed) and duration |
| **Written transcript** | A text record of what the assistant and the parent said |
| **AI summary** | Parent's response, concerns, commitments, suggested actions for the teacher, any follow-up recommended, and the parent's overall mood as judged by the AI |
| Do-not-call request | Stored against the phone number, so it applies to every future call |

**Audio:** the calling system does not save a recording of the call audio. Only the written transcript is stored. The telephone carrier's own call-recording practices are **[TO BE CONFIRMED BY SCHOOL/COMPANY]**.

### 5.3 Who can see it

- In the app, call results, transcripts and summaries are visible **only to the teacher who started the outreach** for their own class.
- Access by school leaders, by Sahayak AI staff for support or quality purposes, and by the service providers who carry the call and process the speech is **[TO BE CONFIRMED BY SCHOOL/COMPANY]**.
- During the call, the parent's speech is processed by a third-party AI speech service to understand and respond. Where that processing takes place, and the data-protection terms that apply, are **[TO BE CONFIRMED BY SCHOOL/COMPANY]**.

### 5.4 Policies still to be confirmed

| Policy | Status |
|---|---|
| How long transcripts and summaries are kept | **[TO BE CONFIRMED BY SCHOOL/COMPANY]** |
| How a parent can ask to see or delete their call data | **[TO BE CONFIRMED BY SCHOOL/COMPANY]** |
| Consent and notice wording for parents (including under India's Digital Personal Data Protection Act, 2023) | **[TO BE CONFIRMED BY SCHOOL/COMPANY]** |
| Whether every call states up front that it is an automated assistant | **[TO BE CONFIRMED BY SCHOOL/COMPANY]** (currently only if asked) |
| Whether the call says it is transcribed | **[TO BE CONFIRMED BY SCHOOL/COMPANY]** (currently not said) |
| Who at the school may review call records | **[TO BE CONFIRMED BY SCHOOL/COMPANY]** |

### 5.5 Responsible-use principles for the school

- Use calls to support families, not to pressure them.
- Keep messages factual, kind and short.
- Do not use the feature for fee collection, marketing or anything unrelated to the student's wellbeing and learning.
- Treat transcripts and summaries as confidential student records.
- Remember that the AI summary is an interpretation. Check it against the transcript before acting on it.

---

## 6. Languages and call availability

### 6.1 Supported languages

Messages can be drafted, and calls placed, for parents whose language is set to any of these 11:

| Language | Recorded greeting | Conversation status |
|---|---|---|
| English | English | Tested in simulation (synthetic English speech) |
| Hindi | Hindi | Not yet tested |
| Bengali | Bengali | Not yet tested |
| Gujarati | Gujarati | Not yet tested |
| Kannada | Kannada | Not yet tested |
| Malayalam | Malayalam | Not yet tested |
| Marathi | Marathi | Not yet tested |
| Odia | **Hindi** (no Odia recording yet) | Not yet tested |
| Punjabi | Punjabi | Not yet tested |
| Tamil | Tamil | Not yet tested |
| Telugu | Telugu | Not yet tested |

**Important:**

- Only English has been tested, and only in a simulation with computer-generated speech. How well the assistant understands real parents, in any language, on a real phone line, has **not yet been verified**.
- The assistant is told to keep speaking the parent's language even if the parent mixes in Hindi or English words.

### 6.2 Delivery modes

| Mode | What happens |
|---|---|
| **Two-way conversation** | The assistant gives the message, then listens and responds to the parent. |
| **Message-only delivery** | The assistant introduces itself, gives the message, says the teacher will follow up personally if the parent has questions, and ends the call. |

The current setting gives **two-way conversation in all 11 languages**. Whether some languages should use message-only delivery until they have been tested is **[TO BE CONFIRMED BY SCHOOL/COMPANY]**. Teachers cannot see or change the mode.

### 6.3 Calling hours

- Calls are only placed between **09:00 and 21:00 India Standard Time**, every day, wherever the teacher happens to be.
- Outside these hours the call is refused, not queued. The teacher sees a message that says calling reopens at 09:00 IST and must try again later.
- The window applies every day of the week. Whether the school wants further limits (for example no Sunday calls, or no calls during exam days) is **[TO BE CONFIRMED BY SCHOOL]**. Such limits would currently have to be followed by teachers, because the product does not enforce them.

---

## 7. Monitoring and follow-up

### 7.1 What teachers see

| Shown to the teacher | Meaning |
|---|---|
| **Calling...** / **Ringing...** | The call has been placed and the parent's phone is ringing. |
| **Conversation in progress** | The parent answered. The assistant is talking with them. |
| **Call completed** | The call ended normally. Duration (in whole minutes, rounded up) and number of exchanges are shown. |
| **No answer** | The parent did not pick up. |
| **Line was busy** | The parent's line was busy. |
| **Call could not connect** | The call failed, was declined, or the assistant could not start properly. |
| **Message copied!** | The teacher chose WhatsApp copy. No call was made. |

After a completed call, the teacher sees (where available):

- **Parent Response**: a short account of how the parent responded.
- **Concerns Raised**, **Parent Commitments**, **Guidance Shared with Parent**.
- **Your Action Items**: suggested next steps for the teacher.
- **Follow-up Recommended**: shown when the AI thinks follow-up is needed.
- The parent's general mood, for example cooperative, concerned, grateful, upset, indifferent or confused.
- **View conversation transcript**: the full text of the call.

A summary is only produced when there was an actual exchange. Very short or unanswered calls show **Call ended before a conversation could happen**.

### 7.2 Limits of monitoring today

- There is no school-wide dashboard of calls. Administrators cannot see calls from inside the product.
- A teacher can see the latest call for a student by reopening **Contact** for that student within about 24 hours. Older calls are stored but there is currently no screen to browse them.
- If the school needs records for oversight, it should agree a manual process (for example, teachers note significant calls in the school's existing records): **[TO BE CONFIRMED BY SCHOOL]**.

### 7.3 Suggested follow-up workflow

1. The teacher reads the summary **and** skims the transcript the same day.
2. If **Follow-up Recommended** appears, or the parent raised a concern, the teacher acts on it or passes it to the right colleague.
3. If the parent seemed **upset** or **confused**, a member of staff calls the parent personally.
4. If the summary and transcript disagree, trust the transcript and tell [School support contact].
5. Anything that suggests a safeguarding issue goes straight to the school's designated safeguarding lead (Section 8).
6. Repeated **No answer** results: try WhatsApp, a note home or a meeting instead of calling again and again.

---

## 8. Safety and escalation

### 8.1 Built-in safeguards

| Safeguard | Status |
|---|---|
| The call always goes to the number on the student's record, never a typed-in number | In the product |
| Only the class teacher can call that class's parents | In the product |
| Calls only between 09:00 and 21:00 IST | In the product |
| No second call to the same student within 5 minutes of the last attempt | In the product |
| Do-not-call requests are saved and block future calls | Verified in simulation; awaiting real-phone verification |
| The assistant never asks for money, OTPs or bank details | AI instruction; checked in simulation only |
| The assistant does not invent marks or incidents | AI instruction; not guaranteed |
| The assistant says it is an assistant if asked directly | AI instruction; up-front disclosure is currently off |
| Calls end automatically (goodbye, silence, time limit) | Verified in simulation; awaiting real-phone verification |

### 8.2 When to escalate

| Situation | Escalate to |
|---|---|
| Transcript suggests risk to a child (abuse, neglect, self-harm, danger at home) | The school's designated safeguarding lead, **immediately**, under the school's child-protection policy: [Safeguarding lead contact] |
| Parent complains about the call, its tone or its content | [School support contact]. Also report to [Sahayak support email]. |
| The assistant said something wrong, offensive or inaccurate | Report to [Sahayak support email] with the student name, date and time (do not include phone numbers in email). |
| A parent says they were called after asking not to be | Treat as urgent. Report to [Sahayak support email]. |
| A call reached the wrong person | Correct the number. Report to [Sahayak support email]. |
| Calls failing for many students | Report to [Sahayak support email]. |

### 8.3 Known behaviours observed in testing

These were seen in simulated testing and are being worked on:

- After being interrupted, the assistant sometimes introduced itself a second time.
- Drafting a message sometimes took 11 to 22 seconds, and once timed out. Teachers may need to press **Generate Message** again.

---

## 9. Troubleshooting

| Problem | Likely cause | What to do |
|---|---|---|
| **No answer** | Parent busy, phone off, or unfamiliar number ignored | Try later, after the 5-minute gap. Or use **Send on WhatsApp**. Avoid repeated calls the same day. |
| **Line was busy** | Parent on another call | Try again later. |
| **Call could not connect** | Number not reachable, call declined, or a service problem | Check the number. Try **Try again** once. If it keeps failing for several students, report it. |
| Teacher sees **"Recent outreach already exists for this student"** | A call or WhatsApp copy for this student was made in the last 5 minutes | Wait 5 minutes and try again. |
| Teacher sees a message about calling hours | It is outside 09:00 to 21:00 IST | Try again after 09:00 IST. |
| Teacher sees **"This parent asked not to be called again..."** | The parent opted out on an earlier call | Do not call. Use WhatsApp, a note home or a meeting. |
| Teacher sees **"Call failed"** with the text **PREMIUM_REQUIRED** | The teacher's plan does not include calling | Contact [Sahayak support email] about the plan. |
| Teacher sees **"Failed to generate"** every time | Message drafting is not available on the teacher's plan, or the AI service is busy | Try once more. If it keeps failing, check the plan with [Sahayak support email]. |
| **No Call Parent button**, only Copy for WhatsApp | Calling is not switched on for this account | Contact [Sahayak support email]. |
| Wrong person answered | Wrong number on the record | Fix the number in the student list. The assistant is told to end the call politely if it is speaking to the wrong person. Report it. |
| Parent says the assistant misunderstood them | Speech recognition on phone lines is imperfect, especially with noise or mixed languages | Read the transcript. Call the parent personally if it matters. Report patterns. |
| Message seemed incomplete or different from the draft | On the call, the assistant speaks a shorter phone version of the message | Check the transcript. Follow up personally if something important was missed. Report it. |
| Parent's language is not on the list | Only 11 languages are supported | Choose the closest language the parent understands, or contact them personally. |
| Parent opted out by mistake | Opt-out is recorded against the phone number | Contact [Sahayak support email]. **[Reinstatement process TO BE CONFIRMED BY SCHOOL/COMPANY]** |
| Summary missing | Call too short, or summary still being prepared | Wait a minute and reopen **Contact** for the student. If the call was long, the transcript is still available. |
| Call result missing after closing the window | Teacher closed the window mid-call | Reopen **Contact** for the same student within 24 hours. The latest call appears automatically. |
| Message drafting slow or failed | AI service delay | Wait and press **Generate Message** again. |

---

## 10. Frequently asked questions

**Does a real person call the parent?**
No. An automated voice assistant calls on the teacher's behalf. It does not claim to be the teacher.

**Does the assistant tell parents it is automated?**
Currently, only if the parent asks. Whether it should say so at the start of every call is **[TO BE CONFIRMED BY SCHOOL/COMPANY]**.

**Can teachers send calls to many parents at once?**
No. Each call is for one student, started by the teacher, after reviewing the message.

**Can a teacher call any phone number?**
No. Calls only go to the number stored on the student's record.

**Can the principal see all the calls?**
Not in the product today.

**Are calls recorded?**
The audio is not saved by the calling system. A written transcript and a summary are saved. The carrier's practices are **[TO BE CONFIRMED BY SCHOOL/COMPANY]**.

**How long is data kept?**
**[TO BE CONFIRMED BY SCHOOL/COMPANY]**

**What if a parent does not want calls?**
They can say so on any call, and future automated calls to that number are blocked. For requests made outside a call, see Section 4.5.

**What if the parent asks something the assistant cannot answer?**
The assistant is told to say that it cannot help with that and to offer a call from the teacher. The question should appear in the summary or transcript.

**Can parents call back on the number?**
**[TO BE CONFIRMED BY SCHOOL/COMPANY]**

**What does it cost?**
Calling needs a School Gold or School Premium plan. Pricing details: **[TO BE CONFIRMED BY COMPANY]**.

**Is this feature ready for everyday use?**
Not yet. It is a pre-release feature waiting for real-phone testing and policy decisions. See the status box at the top.

---

## 11. Implementation and support

### 11.1 Suggested rollout

1. **Decide policies** marked **[TO BE CONFIRMED BY SCHOOL/COMPANY]** with Sahayak AI.
2. **Inform parents** about automated calls and how to opt out (letter, meeting or WhatsApp notice).
3. **Pilot** with a small number of teachers, in English or Hindi first, for positive-feedback and absence messages.
4. **Review** pilot transcripts and summaries with the teachers involved.
5. **Expand** to more teachers and languages once the school is satisfied.

### 11.2 Contacts

| Purpose | Contact |
|---|---|
| School contact for parent concerns about calls | [School support contact] |
| School safeguarding lead | [Safeguarding lead contact] |
| Sahayak AI support | [Sahayak support email] |
| Sahayak AI support phone / hours | [Sahayak support phone] · [Support hours] |
| Account and plan questions | [Sahayak account contact] |
| Data-protection or privacy requests | [Data protection contact] |

### 11.3 Document control

| Field | Value |
|---|---|
| Document owner | [Name, role] |
| Reviewed by | [Name, role] |
| Next review date | [Date] |
| Change log | [Version: summary of changes] |
