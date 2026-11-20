/**
 * Fixed lines for demo calls: the four reasons, the teacher's default note,
 * the AI's opening line, quick parent replies for the presenter, and the
 * scripted fallback the server uses if the AI is unreachable.
 */

import type { OutreachReason } from '@/types/attendance';
import type { DemoCallContext, DemoLanguage, DemoStudent, DemoTeacher } from './types';

export const DEMO_REASONS: OutreachReason[] = ['consecutive_absences', 'poor_performance', 'behavioral_concern', 'positive_feedback'];

/** English labels; pages pass them through t(). Matches Sahayak's Contact parent dialog. */
export const REASON_LABEL: Record<OutreachReason, string> = {
    consecutive_absences: 'Consecutive absences',
    poor_performance: 'Academic concern',
    behavioral_concern: 'Behavioural concern',
    positive_feedback: 'Positive feedback',
};

export const REASON_HINT: Record<OutreachReason, string> = {
    consecutive_absences: 'Student has been absent for multiple days',
    poor_performance: 'Grades or performance have declined',
    behavioral_concern: 'Classroom behaviour needs attention',
    positive_feedback: 'Share an achievement or good news',
};

/** The note the teacher starts from; they can edit it before the call. */
export function defaultNote(reason: OutreachReason, s: DemoStudent): string {
    const first = s.name.split(' ')[0];
    switch (reason) {
        case 'consecutive_absences':
            return `${first} has been absent for ${Math.max(s.consecutiveAbsences, 2)} days in a row without a leave note. I want to know if everything is all right at home and help ${first} catch up.`;
        case 'poor_performance':
            return `${first}'s test scores have dropped to ${s.recentScore} out of 100. I would like to work with the family on a plan to help ${first} catch up.`;
        case 'behavioral_concern':
            return s.behaviourNote
                ? `${s.behaviourNote} I want to work together with the family so ${first} can settle down in class.`
                : `${first} has been disturbing the class this week. I want to work together with the family so ${first} can settle down.`;
        case 'positive_feedback':
            return s.achievement
                ? `${s.achievement} I wanted the family to hear this good news from the school.`
                : `${first} has been doing really well this month and I wanted to share the good news.`;
    }
}

export function openingLine(ctx: DemoCallContext, teacher: DemoTeacher): string {
    const first = ctx.studentName.split(' ')[0];
    if (ctx.parentLanguage === 'hi') {
        return `नमस्ते, मैं ${ctx.schoolName} की AI सहायक बोल रही हूँ, ${teacher.spokenName} की ओर से। क्या आप ${first} के घर से बोल रहे हैं? क्या दो मिनट बात हो सकती है?`;
    }
    return `Namaste, this is the AI assistant of ${ctx.schoolName}, calling on behalf of ${teacher.spokenName}. Am I speaking with ${first}'s family? Do you have two minutes to talk?`;
}

export type ParentPersona = 'cooperative' | 'defensive' | 'angry' | 'complaint' | 'meet' | 'bye';

export const PERSONA_LABEL: Record<ParentPersona, string> = {
    cooperative: 'Cooperative',
    defensive: 'Defensive',
    angry: 'Angry',
    complaint: 'Complains about teacher',
    meet: 'Wants to meet',
    bye: 'Says goodbye',
};

const QUICK: Record<DemoLanguage, Record<ParentPersona, string[]>> = {
    en: {
        cooperative: ['Yes, I am the parent. Please tell me, is everything okay?', 'Okay, I understand. What can we do at home to help?'],
        defensive: ['My child is not like that. He says the other children started it.', 'At home he is perfectly fine. I think the school is exaggerating.'],
        angry: [
            'Every time you people call, it is only to complain! Why are you always blaming my child?',
            'I am busy at work, I cannot keep taking these calls. Handle it in school, that is your job!',
        ],
        complaint: [
            'Honestly, the teacher shouts at him in front of the whole class. That is why he behaves like this.',
            'The teacher never listens to my child, she has picked him as the troublemaker from day one.',
        ],
        meet: ['I want to meet the teacher in person. When can I come to school?'],
        bye: ['Okay, thank you for calling. I have to go now.'],
    },
    hi: {
        cooperative: ['हाँ जी, मैं पिता बोल रहा हूँ। बताइए, सब ठीक तो है?', 'ठीक है, समझ गया। घर पर हम क्या कर सकते हैं?'],
        defensive: ['मेरा बच्चा ऐसा नहीं है। वो कह रहा था कि दूसरे बच्चों ने शुरू किया।', 'घर पर तो वो बिल्कुल ठीक रहता है, आप लोग बात बढ़ा रहे हैं।'],
        angry: ['जब भी आप लोग फ़ोन करते हो, बस शिकायत ही करते हो! हर बार मेरे बच्चे को ही क्यों दोष देते हो?', 'मैं काम पर हूँ, बार-बार फ़ोन मत कीजिए। स्कूल में संभालना आपका काम है!'],
        complaint: ['सच कहूँ तो टीचर पूरी क्लास के सामने उस पर चिल्लाती हैं। इसीलिए वो ऐसा करता है।', 'टीचर मेरे बच्चे की कभी नहीं सुनतीं, पहले दिन से उसे शरारती मान लिया है।'],
        meet: ['मुझे टीचर से खुद मिलना है। मैं स्कूल कब आ सकता हूँ?'],
        bye: ['ठीक है, धन्यवाद। अब मुझे जाना है।'],
    },
};

export function quickReplies(language: DemoLanguage): Record<ParentPersona, string[]> {
    return QUICK[language];
}

// ── Scripted fallback ────────────────────────────────────────────────────────

const COMPLAINT_WORDS = /\b(shout|shouts|shouted|scold|unfair|picked|never listens|teacher (is|was|does|did)|ma'?am|sir)\b|टीचर|चिल्ला|डांट|नहीं सुन/i;
const ANGRY_WORDS = /!|\b(always|every time|blame|blaming|your job|stop calling)\b|हमेशा|हर बार|दोष|आपका काम/i;
const DENY_WORDS = /\b(not like that|started it|exaggerat|perfectly fine|lying)\b|ऐसा नहीं|शुरू किया|बढ़ा रहे/i;
const MEET_WORDS = /\b(meet|come to school|visit)\b|मिलना|स्कूल कब/i;
const BYE_WORDS = /\b(bye|goodbye|have to go|thank you)\b|धन्यवाद|जाना है|नमस्ते/i;

const FALLBACK: Record<DemoLanguage, Record<'complaint' | 'angry' | 'deny' | 'meet' | 'bye' | 'open' | 'next', (c: DemoCallContext) => string>> = {
    en: {
        complaint: (c) =>
            `Thank you for telling me this, I understand it matters to you. I have noted your concern about the teacher exactly as you said it, and it will reach ${c.teacherName} and the principal. Would you like a meeting with the school to talk about it?`,
        angry: (c) =>
            `I hear you, and I am sorry these calls have felt like only complaints. We are not blaming ${c.studentName.split(' ')[0]}; we want to work with you. Could we find one small step together?`,
        deny: (c) =>
            `That is fair, and thank you for sharing his side. We only want ${c.studentName.split(' ')[0]} to be comfortable and do well in class. Would a short meeting with the teacher help clear this up?`,
        meet: (c) => `Of course. I will ask ${c.teacherName} to call you back to fix a time this week. Is the evening better for you?`,
        bye: () => 'Thank you so much for your time. The school is always here for you. Have a good day.',
        open: (c) => `Thank you. ${c.teacherMessage} How do you feel about this?`,
        next: () => 'Thank you for listening. We are partners in this. Is there anything you would like the teacher to know?',
    },
    hi: {
        complaint: (c) =>
            `यह बताने के लिए धन्यवाद, मैं समझती हूँ यह आपके लिए ज़रूरी है। टीचर के बारे में आपकी बात मैंने वैसे ही नोट कर ली है, यह ${c.teacherName} और प्रिंसिपल तक पहुँचेगी। क्या आप स्कूल से मिलकर इस पर बात करना चाहेंगे?`,
        angry: (c) =>
            `मैं आपकी बात समझ रही हूँ, और माफ़ी चाहती हूँ कि ये फ़ोन सिर्फ़ शिकायत जैसे लगे। हम ${c.studentName.split(' ')[0]} को दोष नहीं दे रहे, हम आपके साथ मिलकर काम करना चाहते हैं। क्या हम एक छोटा कदम साथ तय कर सकते हैं?`,
        deny: (c) => `आपकी बात ठीक है, उसका पक्ष बताने के लिए धन्यवाद। हम बस चाहते हैं कि ${c.studentName.split(' ')[0]} क्लास में अच्छा करे। क्या टीचर से एक छोटी मुलाक़ात मदद करेगी?`,
        meet: (c) => `ज़रूर। मैं ${c.teacherName} से कहूँगी कि वो आपको वापस फ़ोन करके इस हफ़्ते का समय तय करें। क्या शाम का समय ठीक रहेगा?`,
        bye: () => 'आपके समय के लिए बहुत धन्यवाद। स्कूल हमेशा आपके साथ है। नमस्ते।',
        open: (c) => `धन्यवाद। ${c.teacherMessage} आप इस बारे में क्या सोचते हैं?`,
        next: () => 'सुनने के लिए धन्यवाद। हम इसमें साथ हैं। क्या आप टीचर तक कोई बात पहुँचाना चाहेंगे?',
    },
};

/** A calm, rule-based reply used only when the AI cannot answer. */
export function fallbackReply(ctx: DemoCallContext, parentSpeech: string, turnNumber: number): { reply: string; shouldEndCall: boolean } {
    const lines = FALLBACK[ctx.parentLanguage];
    if (BYE_WORDS.test(parentSpeech)) return { reply: lines.bye(ctx), shouldEndCall: true };
    if (COMPLAINT_WORDS.test(parentSpeech)) return { reply: lines.complaint(ctx), shouldEndCall: false };
    if (ANGRY_WORDS.test(parentSpeech)) return { reply: lines.angry(ctx), shouldEndCall: false };
    if (DENY_WORDS.test(parentSpeech)) return { reply: lines.deny(ctx), shouldEndCall: false };
    if (MEET_WORDS.test(parentSpeech)) return { reply: lines.meet(ctx), shouldEndCall: false };
    if (turnNumber <= 1) return { reply: lines.open(ctx), shouldEndCall: false };
    if (turnNumber >= 6) return { reply: lines.bye(ctx), shouldEndCall: true };
    return { reply: lines.next(ctx), shouldEndCall: false };
}
