/**
 * Call history the demo school starts with, so the teacher log and the
 * admin monitor have something to show before anyone places a call. Covers
 * every scenario: cooperative, defensive, angry, a complaint about a
 * teacher, good news, no answer, busy, and a call the principal placed.
 */

import type { OutreachReason } from '@/types/attendance';
import { FEATURED_STUDENT_IDS, classById, getDemoSchool, studentSignals, teacherById } from './school';
import { defaultNote } from './script';
import type { DemoCall, DemoSummary, DemoTurn } from './types';

const HOUR = 3_600_000;

function at(now: number, hoursAgo: number): string {
    return new Date(now - hoursAgo * HOUR).toISOString();
}

function summary(s: Partial<DemoSummary> & Pick<DemoSummary, 'parentResponse' | 'parentSentiment' | 'callQuality'>): DemoSummary {
    return {
        parentConcerns: [],
        parentCommitments: [],
        actionItemsForTeacher: [],
        guidanceGiven: [],
        followUpNeeded: false,
        complaintAboutTeacher: null,
        ...s,
    };
}

interface Scripted {
    studentId: string;
    reason: OutreachReason;
    hoursAgo: number;
    language?: 'en' | 'hi';
    byAdmin?: boolean;
    status?: DemoCall['status'];
    durationSeconds?: number;
    transcript?: DemoTurn[];
    summary?: DemoSummary;
    complaintStatus?: DemoCall['complaintStatus'];
}

const SCRIPTED: Scripted[] = [
    {
        studentId: '8B-6',
        reason: 'behavioral_concern',
        hoursAgo: 3,
        durationSeconds: 212,
        transcript: [
            { role: 'agent', text: "Namaste, this is the AI assistant of Green Valley Public School, calling on behalf of Sharma sir. Am I speaking with the family? Do you have two minutes to talk?" },
            { role: 'parent', text: 'Yes, I am his mother. What happened now?' },
            { role: 'agent', text: 'Thank you for taking the call. Sharma sir has noticed that your son has been talking back in Maths class this week, and he would like to work with you so he can settle down. How has he been at home?' },
            { role: 'parent', text: 'He is scared of Maths class! Sharma sir bangs the duster on the desk and calls children stupid when they cannot solve a sum. Of course he talks back.' },
            { role: 'agent', text: 'Thank you for telling me this, I can hear how much it worries you. I have noted exactly what you said about the class, and it will reach Sharma sir and the principal. Would you like a meeting at school to talk about it together?' },
            { role: 'parent', text: 'Yes, I want to meet the principal, not only the teacher.' },
            { role: 'agent', text: 'That is completely fair. I will ask the principal’s office to call you to fix a time this week. Thank you for being open with us; we want your son to feel safe in class.' },
        ],
        summary: summary({
            parentResponse: 'The mother was upset and said her son is afraid of Maths class; she linked his talking back to how the class is run.',
            parentConcerns: ['Son is scared of Maths class', 'Says the teacher bangs the duster and calls children stupid'],
            parentCommitments: ['Will come to school to meet the principal'],
            actionItemsForTeacher: ['Principal to meet the mother this week', 'Review classroom conduct in 8B Maths'],
            parentSentiment: 'upset',
            callQuality: 'difficult',
            followUpNeeded: true,
            followUpSuggestion: 'Principal’s office to call the mother and fix a meeting.',
            complaintAboutTeacher: 'The mother says Sharma sir bangs the duster on the desk and calls children "stupid" when they cannot solve a sum, and that this is why her son talks back.',
        }),
        complaintStatus: 'open',
    },
    {
        studentId: '7A-2',
        reason: 'consecutive_absences',
        hoursAgo: 20,
        durationSeconds: 164,
        transcript: [
            { role: 'agent', text: "Namaste, this is the AI assistant of Green Valley Public School, calling on behalf of Rai ma'am. Am I speaking with Pema's family? Do you have two minutes to talk?" },
            { role: 'parent', text: 'Yes, this is her mother. Is she okay?' },
            { role: 'agent', text: "She is fine, thank you. Rai ma'am noticed Pema has been absent for four days without a leave note and wanted to check that everything is all right at home." },
            { role: 'parent', text: 'Her grandmother is in hospital, so she was staying home with the little one. I should have sent a note, sorry.' },
            { role: 'agent', text: "I am sorry to hear about her grandmother, I hope she feels better soon. Rai ma'am can share the notes she missed so she does not fall behind. Will Pema be able to come back this week?" },
            { role: 'parent', text: 'Yes, she will come from Monday. Please send the notes.' },
            { role: 'agent', text: "Thank you. I will let Rai ma'am know she is coming on Monday and ask her to keep the notes ready. Take care of your family." },
        ],
        summary: summary({
            parentResponse: 'The mother explained that Pema stayed home to help while her grandmother is in hospital, and apologised for not sending a note.',
            parentConcerns: ['Grandmother is in hospital'],
            parentCommitments: ['Pema will return to school on Monday'],
            actionItemsForTeacher: ['Keep the missed notes ready for Pema on Monday', 'Check in with Pema gently when she is back'],
            guidanceGiven: ['Shared that the teacher can give her the missed notes'],
            parentSentiment: 'cooperative',
            callQuality: 'productive',
            followUpNeeded: false,
        }),
    },
    {
        studentId: '7A-3',
        reason: 'positive_feedback',
        hoursAgo: 52,
        durationSeconds: 96,
        transcript: [
            { role: 'agent', text: "Namaste, this is the AI assistant of Green Valley Public School, calling on behalf of Rai ma'am. Am I speaking with Ananya's family?" },
            { role: 'parent', text: 'Yes, I am her mother.' },
            { role: 'agent', text: "I have good news! Ananya won first prize in the inter-school science quiz, and Rai ma'am wanted you to hear it from the school." },
            { role: 'parent', text: 'Oh wonderful! She did not even tell us. Thank you so much for calling.' },
            { role: 'agent', text: 'She worked very hard for it. Please do praise her effort tonight. Have a lovely evening!' },
        ],
        summary: summary({
            parentResponse: 'The mother was delighted and grateful to hear about the quiz prize.',
            actionItemsForTeacher: ['Mention the prize in the class assembly'],
            guidanceGiven: ['Praise effort, not only the result'],
            parentSentiment: 'grateful',
            callQuality: 'productive',
        }),
    },
    {
        studentId: '9A-11',
        reason: 'behavioral_concern',
        hoursAgo: 28,
        durationSeconds: 188,
        transcript: [
            { role: 'agent', text: 'Namaste, this is the AI assistant of Green Valley Public School, calling on behalf of Khan sir. Am I speaking with the family? Do you have two minutes?' },
            { role: 'parent', text: 'Yes, father speaking.' },
            { role: 'agent', text: 'Thank you. Khan sir noticed your son got into a pushing fight with a classmate at recess, and he would like to work with you on it.' },
            { role: 'parent', text: 'Every time you people call, it is only to complain! Why is it always my boy? Handle it in school, that is your job!' },
            { role: 'agent', text: 'I hear you, and I am sorry the calls have felt like only complaints. We are not blaming him; we want him to be happy at school. Could you talk to him tonight about what happened, so we hear his side too?' },
            { role: 'parent', text: 'Fine. I will talk to him. But next time call when he does something good also.' },
            { role: 'agent', text: 'That is a fair request, and I will pass it to Khan sir. Thank you for your time.' },
        ],
        summary: summary({
            parentResponse: 'The father was angry that calls only bring complaints, calmed down, and agreed to talk to his son.',
            parentConcerns: ['School only calls to complain', 'Feels his son is singled out'],
            parentCommitments: ['Will talk to his son about the fight tonight'],
            actionItemsForTeacher: ['Hear the boy’s side of the fight', 'Make a positive call when he does well'],
            parentSentiment: 'upset',
            callQuality: 'difficult',
            followUpNeeded: true,
            followUpSuggestion: 'Call back with good news within two weeks.',
        }),
    },
    {
        studentId: '8A-9',
        reason: 'poor_performance',
        hoursAgo: 46,
        language: 'hi',
        durationSeconds: 175,
        transcript: [
            { role: 'agent', text: 'नमस्ते, मैं Green Valley Public School की AI सहायक बोल रही हूँ, शर्मा सर की ओर से। क्या दो मिनट बात हो सकती है?' },
            { role: 'parent', text: 'हाँ बोलिए, मैं पिता बोल रहा हूँ।' },
            { role: 'agent', text: 'धन्यवाद। शर्मा सर ने देखा है कि गणित के पिछले टेस्ट में नंबर काफ़ी कम आए हैं, वो आपके साथ मिलकर एक योजना बनाना चाहते हैं।' },
            { role: 'parent', text: 'मेरा बेटा तो पढ़ता है, शायद पेपर ही कठिन था। आप लोग बात बढ़ा रहे हैं।' },
            { role: 'agent', text: 'आपकी बात ठीक है, हो सकता है पेपर कठिन रहा हो। क्या रोज़ बीस मिनट घर पर गणित का अभ्यास करवाना संभव होगा? शर्मा सर अभ्यास की शीट भेज देंगे।' },
            { role: 'parent', text: 'ठीक है, शीट भेज दीजिए, मैं देख लूँगा।' },
        ],
        summary: summary({
            parentResponse: 'The father first felt the school was exaggerating, then agreed to daily practice at home.',
            parentConcerns: ['Thinks the test paper was too hard'],
            parentCommitments: ['Will make sure his son practises Maths 20 minutes a day'],
            actionItemsForTeacher: ['Send practice worksheets home this week', 'Re-check scores after the next unit test'],
            guidanceGiven: ['20 minutes of Maths practice every day'],
            parentSentiment: 'concerned',
            callQuality: 'productive',
            followUpNeeded: true,
            followUpSuggestion: 'Review after the next unit test.',
        }),
    },
    {
        studentId: '6B-14',
        reason: 'poor_performance',
        hoursAgo: 70,
        durationSeconds: 140,
        transcript: [
            { role: 'agent', text: "Namaste, this is the AI assistant of Green Valley Public School, calling on behalf of Thapa ma'am. Do you have two minutes?" },
            { role: 'parent', text: 'Yes.' },
            { role: 'agent', text: "Thapa ma'am noticed your daughter's English scores have dropped, and she would like to plan together how to help." },
            { role: 'parent', text: "Thapa ma'am gives so much homework that she sits up till eleven every night. She is tired in class, that is the real problem." },
            { role: 'agent', text: "Thank you for telling me, that matters. I have noted your concern about the homework load for Thapa ma'am and the principal. Would it help if the teacher called you to talk it through?" },
            { role: 'parent', text: 'Yes, please.' },
        ],
        summary: summary({
            parentResponse: 'The parent linked the drop in scores to tiredness from heavy homework.',
            parentConcerns: ['Too much homework, child up till 11 pm'],
            actionItemsForTeacher: ['Call the parent about homework load'],
            parentSentiment: 'concerned',
            callQuality: 'productive',
            followUpNeeded: true,
            followUpSuggestion: 'Teacher to call the parent this week.',
            complaintAboutTeacher: "The parent says Thapa ma'am gives so much homework that her daughter sits up till 11 pm and is tired in class.",
        }),
        complaintStatus: 'acknowledged',
    },
    {
        studentId: '9B-5',
        reason: 'consecutive_absences',
        hoursAgo: 6,
        byAdmin: true,
        durationSeconds: 121,
        transcript: [
            { role: 'agent', text: 'Namaste, this is the AI assistant of Green Valley Public School, calling on behalf of the principal. Do you have two minutes?' },
            { role: 'parent', text: 'Yes, tell me.' },
            { role: 'agent', text: 'Your son has been absent for three days without a note, and the principal wanted to make sure everything is all right.' },
            { role: 'parent', text: 'He had fever, he is better now. He will come tomorrow.' },
            { role: 'agent', text: 'I am glad he is better. Please send a short note with him tomorrow. Thank you, take care.' },
        ],
        summary: summary({
            parentResponse: 'The parent said the boy had fever and will return tomorrow.',
            parentCommitments: ['Son returns tomorrow with a note'],
            actionItemsForTeacher: ['Mark the absence as medical once the note arrives'],
            parentSentiment: 'cooperative',
            callQuality: 'productive',
        }),
    },
    { studentId: '6A-8', reason: 'consecutive_absences', hoursAgo: 4, status: 'no_answer' },
    { studentId: '6B-3', reason: 'behavioral_concern', hoursAgo: 26, status: 'busy' },
    { studentId: '7B-12', reason: 'poor_performance', hoursAgo: 30, status: 'no_answer' },
];

const QUICK_OUTCOMES: Array<Pick<DemoSummary, 'parentResponse' | 'parentSentiment' | 'callQuality' | 'followUpNeeded'> & { commitment: string }> = [
    { parentResponse: 'The parent listened and agreed to help at home.', parentSentiment: 'cooperative', callQuality: 'productive', followUpNeeded: false, commitment: 'Will check homework every evening' },
    { parentResponse: 'The parent was worried and asked for a meeting.', parentSentiment: 'concerned', callQuality: 'productive', followUpNeeded: true, commitment: 'Will come to school on Saturday' },
    { parentResponse: 'The parent thanked the school for the good news.', parentSentiment: 'grateful', callQuality: 'productive', followUpNeeded: false, commitment: 'Will praise the child at home' },
    { parentResponse: 'The parent said little and ended the call quickly.', parentSentiment: 'indifferent', callQuality: 'brief', followUpNeeded: true, commitment: 'Said they would look into it' },
];

export function buildSeedCalls(now: number): DemoCall[] {
    const school = getDemoSchool();
    const calls: DemoCall[] = [];
    let n = 0;

    for (const s of SCRIPTED) {
        const student = school.students.find((x) => x.id === s.studentId);
        const cls = student && classById(student.classId);
        const teacher = cls && teacherById(cls.teacherId);
        if (!student || !cls || !teacher) continue;
        const status = s.status ?? 'completed';
        calls.push({
            id: `seed-${++n}`,
            createdAt: at(now, s.hoursAgo),
            studentId: student.id,
            classId: cls.id,
            teacherId: teacher.id,
            placedBy: s.byAdmin ? { role: 'admin', name: school.admin.name } : { role: 'teacher', name: teacher.name },
            reason: s.reason,
            note: defaultNote(s.reason, student),
            language: s.language ?? student.guardian.language,
            status,
            durationSeconds: status === 'completed' ? (s.durationSeconds ?? 120) : 0,
            // Call logs show the summary; a saved call keeps no transcript (the role-play script stays in the seed only).
            transcript: [],
            summary: s.summary ?? null,
            complaintStatus: s.complaintStatus ?? null,
        });
    }

    // A quieter background of calls across the school, one or two per class,
    // so per-teacher counts and the week's activity look like a real school.
    const pinned = new Set([...SCRIPTED.map((s) => s.studentId), ...FEATURED_STUDENT_IDS]);
    let k = 0;
    for (const cls of school.classes) {
        const teacher = teacherById(cls.teacherId)!;
        const candidates = school.students.filter((st) => st.classId === cls.id && !pinned.has(st.id) && studentSignals(st).length > 0).slice(0, 3);
        for (const st of candidates) {
            const reason = studentSignals(st)[0].reason;
            const outcome = reason === 'positive_feedback' ? QUICK_OUTCOMES[2] : QUICK_OUTCOMES[k % 4 === 2 ? 0 : k % 4];
            const missed = k % 5 === 4;
            k++;
            calls.push({
                id: `seed-${++n}`,
                createdAt: at(now, 8 + k * 9),
                studentId: st.id,
                classId: cls.id,
                teacherId: teacher.id,
                placedBy: { role: 'teacher', name: teacher.name },
                reason,
                note: defaultNote(reason, st),
                language: st.guardian.language,
                status: missed ? 'no_answer' : 'completed',
                durationSeconds: missed ? 0 : 70 + ((k * 37) % 120),
                transcript: [],
                summary: missed
                    ? null
                    : summary({
                          parentResponse: outcome.parentResponse,
                          parentSentiment: outcome.parentSentiment,
                          callQuality: outcome.callQuality,
                          followUpNeeded: outcome.followUpNeeded,
                          parentCommitments: [outcome.commitment],
                          actionItemsForTeacher: [outcome.followUpNeeded ? 'Follow up with the family next week' : 'No action needed'],
                      }),
                complaintStatus: null,
            });
        }
    }

    return calls.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
