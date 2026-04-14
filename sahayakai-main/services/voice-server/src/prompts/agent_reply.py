"""
Parent Call Agent system prompt.

Ported from src/ai/flows/parent-call-agent.ts (agentReplyPrompt).
Used by the Gemini LLM provider in the Pipecat pipeline.
"""

AGENT_REPLY_SYSTEM_PROMPT = """You are a warm, caring school representative making a phone call to a parent about their child. You are NOT a robot — you are having a real conversation.

**Your role — CRITICAL INSTRUCTIONS:**
1. Write your ENTIRE reply in the parent's language. Not mixed. If Hindi, write in Devanagari. If Kannada, write in Kannada script. Etc.
2. Keep reply to 3-4 SHORT sentences MAX — this is spoken on a phone call, not written text.
3. Be genuinely conversational — respond to what the parent ACTUALLY said. Acknowledge their emotions.
4. If parent shares a concern: validate it, then offer ONE practical suggestion (home learning tip, school-parent collaboration idea).
5. If parent asks a question: answer it simply and warmly.
6. If parent seems satisfied or has no more to say: gently wrap up.
7. DO NOT lecture. DO NOT give long lists. ONE idea at a time.
8. Pedagogical guidance should be practical and simple — things a parent can do at HOME (read together 10 min, check homework daily, ask "what did you learn today?", create a quiet study corner, praise effort not marks).
9. If turn number >= 5, start wrapping up naturally unless parent has an urgent concern.
10. Set should_end_call=true when: parent says goodbye, parent seems done, or turn >= 6.
11. Use warm closings like "We are partners in your child's success" / "The school is always here for you".
12. NEVER introduce yourself as "Sahayak", "SahayakAI", or any AI/bot name. You are the school or the teacher — never reveal you are an AI system.

**Tone:** Like a kind teacher speaking to a parent at a chai meeting — respectful, warm, unhurried. Village parents deserve the same dignity as city parents. Never condescend. Never use jargon.

Respond in JSON format:
{
  "reply": "Your response in parent's language. Max 3-4 sentences.",
  "should_end_call": false,
  "follow_up_question": "Optional gentle follow-up question"
}"""


def build_agent_context(
    student_name: str,
    class_name: str,
    subject: str,
    reason: str,
    teacher_message: str,
    parent_language: str,
    transcript: list[dict],
    parent_speech: str,
    turn_number: int,
    teacher_name: str = "",
    school_name: str = "",
) -> str:
    """Build the user message with full call context."""
    lines = [
        f"Student: {student_name}, Class: {class_name}, Subject: {subject}",
        f"Reason for call: {reason}",
        f"Teacher's original message: {teacher_message}",
    ]
    if teacher_name:
        lines.append(f"Teacher: {teacher_name}")
    if school_name:
        lines.append(f"School: {school_name}")
    lines.append(f"Parent's language: {parent_language}")
    lines.append("")
    lines.append("Conversation so far:")
    for turn in transcript:
        lines.append(f"  {turn['role']}: {turn['text']}")
    lines.append("")
    lines.append(f'Parent just said: "{parent_speech}"')
    lines.append(f"Turn number: {turn_number} of maximum 6")
    return "\n".join(lines)


# Language-specific greeting prompts — ported from src/types/attendance.ts CALL_MENU_PROMPTS
# All 11 supported languages (10 Indic + English)
CALL_GREETINGS: dict[str, dict[str, str]] = {
    "en-IN": {
        "greeting": "Namaste. This is an important message from your child's school.",
        "invite": "If you have any questions, concerns, or anything you would like to share, please go ahead and speak. You can also press 2 to end the call anytime.",
        "waiting": "Please go ahead, I'm listening.",
        "didnt_hear": "I'm sorry, I could not hear you clearly. Could you please speak again?",
        "goodbye": "It seems we could not connect. The teacher's message has been delivered. The school will try again if needed. Thank you. Goodbye.",
        "thanks": "Thank you for your time. We are partners in your child's success. Goodbye.",
    },
    "hi-IN": {
        "greeting": "नमस्ते। यह आपके बच्चे के स्कूल से एक ज़रूरी संदेश है।",
        "invite": "अगर आपके कोई सवाल हैं, कोई चिंता है, या कुछ बताना चाहते हैं, तो कृपया बोलिए। कॉल खत्म करने के लिए 2 दबाएँ।",
        "waiting": "कृपया बोलिए, मैं सुन रहा हूँ।",
        "didnt_hear": "माफ़ कीजिए, मैं सुन नहीं पाया। कृपया दोबारा बोलिए।",
        "goodbye": "लगता है हम जुड़ नहीं पाए। शिक्षक का संदेश पहुँच गया है। ज़रूरत होने पर स्कूल फिर से कॉल करेगा। धन्यवाद। नमस्कार।",
        "thanks": "आपके समय के लिए धन्यवाद। हम आपके बच्चे की प्रगति में आपके साथी हैं। नमस्कार।",
    },
    "kn-IN": {
        "greeting": "ನಮಸ್ಕಾರ. ಇದು ನಿಮ್ಮ ಮಗುವಿನ ಶಾಲೆಯಿಂದ ಒಂದು ಮುಖ್ಯ ಸಂದೇಶ.",
        "invite": "ನಿಮಗೆ ಏನಾದರೂ ಪ್ರಶ್ನೆಗಳಿದ್ದರೆ ಅಥವಾ ಹಂಚಿಕೊಳ್ಳಬೇಕಾದರೆ ದಯವಿಟ್ಟು ಮಾತನಾಡಿ. ಕರೆ ಮುಗಿಸಲು 2 ಒತ್ತಿ.",
        "waiting": "ದಯವಿಟ್ಟು ಮಾತನಾಡಿ, ನಾನು ಕೇಳುತ್ತಿದ್ದೇನೆ.",
        "didnt_hear": "ಕ್ಷಮಿಸಿ, ನನಗೆ ಸ್ಪಷ್ಟವಾಗಿ ಕೇಳಲಿಲ್ಲ. ದಯವಿಟ್ಟು ಮತ್ತೊಮ್ಮೆ ಹೇಳಿ.",
        "goodbye": "ನಾವು ಸಂಪರ್ಕ ಸಾಧಿಸಲು ಆಗಲಿಲ್ಲ. ಶಿಕ್ಷಕರ ಸಂದೇಶ ತಲುಪಿದೆ. ಅಗತ್ಯವಿದ್ದರೆ ಶಾಲೆ ಮತ್ತೆ ಕರೆ ಮಾಡುತ್ತದೆ. ಧನ್ಯವಾದಗಳು. ನಮಸ್ಕಾರ.",
        "thanks": "ನಿಮ್ಮ ಸಮಯಕ್ಕೆ ಧನ್ಯವಾದಗಳು. ನಿಮ್ಮ ಮಗುವಿನ ಯಶಸ್ಸಿನಲ್ಲಿ ನಾವು ನಿಮ್ಮ ಪಾಲುದಾರರು. ನಮಸ್ಕಾರ.",
    },
    "ta-IN": {
        "greeting": "வணக்கம். இது உங்கள் குழந்தையின் பள்ளியிலிருந்து ஒரு முக்கிய செய்தி.",
        "invite": "உங்களுக்கு ஏதாவது கேள்விகள் அல்லது கவலைகள் இருந்தால், தயவுசெய்து பேசுங்கள். அழைப்பை முடிக்க 2 அழுத்தவும்.",
        "waiting": "தயவுசெய்து பேசுங்கள், நான் கேட்டுக்கொண்டிருக்கிறேன்.",
        "didnt_hear": "மன்னிக்கவும், தெளிவாக கேட்கவில்லை. மீண்டும் பேசுங்கள்.",
        "goodbye": "தொடர்பு ஏற்படவில்லை. ஆசிரியரின் செய்தி அனுப்பப்பட்டுள்ளது. தேவைப்பட்டால் பள்ளி மீண்டும் அழைக்கும். நன்றி. வணக்கம்.",
        "thanks": "உங்கள் நேரத்திற்கு நன்றி. உங்கள் குழந்தையின் வெற்றியில் நாங்கள் உங்கள் பங்குதாரர்கள். வணக்கம்.",
    },
    "te-IN": {
        "greeting": "నమస్కారం. ఇది మీ బిడ్డ పాఠశాల నుండి ఒక ముఖ్యమైన సందేశం.",
        "invite": "మీకు ఏమైనా ప్రశ్నలు ఉంటే లేదా చెప్పాలనుకుంటే దయచేసి మాట్లాడండి. కాల్ ముగించడానికి 2 నొక్కండి.",
        "waiting": "దయచేసి మాట్లాడండి, నేను వింటున్నాను.",
        "didnt_hear": "క్షమించండి, స్పష్టంగా వినలేదు. దయచేసి మళ్ళీ చెప్పండి.",
        "goodbye": "సంప్రదింపు జరగలేదు. టీచర్ సందేశం అందింది. అవసరమైతే పాఠశాల మళ్ళీ కాల్ చేస్తుంది. ధన్యవాదాలు. నమస్కారం.",
        "thanks": "మీ సమయానికి ధన్యవాదాలు. మీ బిడ్డ విజయంలో మేము మీ భాగస్వాములం. నమస్కారం.",
    },
    "ml-IN": {
        "greeting": "നമസ്കാരം. ഇത് നിങ്ങളുടെ കുട്ടിയുടെ സ്കൂളിൽ നിന്നുള്ള ഒരു പ്രധാന സന്ദേശമാണ്.",
        "invite": "നിങ്ങൾക്ക് എന്തെങ്കിലും ചോദ്യങ്ങളോ ആശങ്കകളോ ഉണ്ടെങ്കിൽ ദയവായി സംസാരിക്കുക. കോൾ അവസാനിപ്പിക്കാൻ 2 അമർത്തുക.",
        "waiting": "ദയവായി സംസാരിക്കുക, ഞാൻ കേൾക്കുന്നുണ്ട്.",
        "didnt_hear": "ക്ഷമിക്കണം, വ്യക്തമായി കേൾക്കാൻ കഴിഞ്ഞില്ല. ദയവായി വീണ്ടും പറയുക.",
        "goodbye": "ബന്ധപ്പെടാൻ കഴിഞ്ഞില്ല. ടീച്ചറിന്റെ സന്ദേശം എത്തിയിട്ടുണ്ട്. ആവശ്യമെങ്കിൽ സ്കൂൾ വീണ്ടും വിളിക്കും. നന്ദി. നമസ്കാരം.",
        "thanks": "നിങ്ങളുടെ സമയത്തിന് നന്ദി. നിങ്ങളുടെ കുട്ടിയുടെ വിജയത്തിൽ ഞങ്ങൾ നിങ്ങളുടെ പങ്കാളികളാണ്. നമസ്കാരം.",
    },
    "bn-IN": {
        "greeting": "নমস্কার। এটি আপনার সন্তানের স্কুল থেকে একটি গুরুত্বপূর্ণ বার্তা।",
        "invite": "আপনার কোনো প্রশ্ন বা উদ্বেগ থাকলে দয়া করে বলুন। কল শেষ করতে 2 চাপুন।",
        "waiting": "দয়া করে বলুন, আমি শুনছি।",
        "didnt_hear": "দুঃখিত, স্পষ্টভাবে শুনতে পাইনি। দয়া করে আবার বলুন।",
        "goodbye": "যোগাযোগ হলো না। শিক্ষকের বার্তা পৌঁছে গেছে। প্রয়োজনে স্কুল আবার কল করবে। ধন্যবাদ। নমস্কার।",
        "thanks": "আপনার সময়ের জন্য ধন্যবাদ। আপনার সন্তানের সাফল্যে আমরা আপনার সঙ্গী। নমস্কার।",
    },
    "mr-IN": {
        "greeting": "नमस्कार. हा तुमच्या मुलाच्या शाळेकडून एक महत्त्वाचा संदेश आहे.",
        "invite": "तुम्हाला काही प्रश्न असतील किंवा काही सांगायचे असेल तर कृपया बोला. कॉल संपवण्यासाठी 2 दाबा.",
        "waiting": "कृपया बोला, मी ऐकतो आहे.",
        "didnt_hear": "माफ करा, नीट ऐकू आले नाही. कृपया पुन्हा बोला.",
        "goodbye": "संपर्क होऊ शकला नाही. शिक्षकांचा संदेश पोहोचला आहे. गरज असल्यास शाळा पुन्हा कॉल करेल. धन्यवाद. नमस्कार.",
        "thanks": "तुमच्या वेळेबद्दल धन्यवाद. तुमच्या मुलाच्या यशात आम्ही तुमचे भागीदार आहोत. नमस्कार.",
    },
    "gu-IN": {
        "greeting": "નમસ્તે. આ તમારા બાળકની શાળામાંથી એક મહત્વપૂર્ણ સંદેશ છે.",
        "invite": "તમને કોઈ પ્રશ્ન હોય કે કંઈ કહેવું હોય તો કૃપા કરીને બોલો. કૉલ સમાપ્ત કરવા 2 દબાવો.",
        "waiting": "કૃપા કરીને બોલો, હું સાંભળું છું.",
        "didnt_hear": "માફ કરશો, સ્પષ્ટ સંભળાયું નહીં. કૃપા કરીને ફરી બોલો.",
        "goodbye": "સંપર્ક થઈ શક્યો નહીં. શિક્ષકનો સંદેશ પહોંચ્યો છે. જરૂર હશે તો શાળા ફરી કૉલ કરશે. આભાર. નમસ્તે.",
        "thanks": "તમારા સમય બદલ આભાર. તમારા બાળકની સફળતામાં અમે તમારા ભાગીદાર છીએ. નમસ્તે.",
    },
    "pa-IN": {
        "greeting": "ਸਤ ਸ੍ਰੀ ਅਕਾਲ। ਇਹ ਤੁਹਾਡੇ ਬੱਚੇ ਦੇ ਸਕੂਲ ਤੋਂ ਇੱਕ ਜ਼ਰੂਰੀ ਸੁਨੇਹਾ ਹੈ।",
        "invite": "ਜੇ ਤੁਹਾਡੇ ਕੋਈ ਸਵਾਲ ਜਾਂ ਚਿੰਤਾ ਹੈ ਤਾਂ ਕਿਰਪਾ ਕਰਕੇ ਬੋਲੋ। ਕਾਲ ਖ਼ਤਮ ਕਰਨ ਲਈ 2 ਦਬਾਓ।",
        "waiting": "ਕਿਰਪਾ ਕਰਕੇ ਬੋਲੋ, ਮੈਂ ਸੁਣ ਰਿਹਾ ਹਾਂ।",
        "didnt_hear": "ਮਾਫ਼ ਕਰਨਾ, ਸਾਫ਼ ਨਹੀਂ ਸੁਣਿਆ। ਕਿਰਪਾ ਕਰਕੇ ਦੁਬਾਰਾ ਬੋਲੋ।",
        "goodbye": "ਸੰਪਰਕ ਨਹੀਂ ਹੋ ਸਕਿਆ। ਅਧਿਆਪਕ ਦਾ ਸੁਨੇਹਾ ਪਹੁੰਚ ਗਿਆ ਹੈ। ਲੋੜ ਪੈਣ ਤੇ ਸਕੂਲ ਫ਼ਿਰ ਕਾਲ ਕਰੇਗਾ। ਧੰਨਵਾਦ। ਸਤ ਸ੍ਰੀ ਅਕਾਲ।",
        "thanks": "ਤੁਹਾਡੇ ਸਮੇਂ ਲਈ ਧੰਨਵਾਦ। ਤੁਹਾਡੇ ਬੱਚੇ ਦੀ ਸਫ਼ਲਤਾ ਵਿੱਚ ਅਸੀਂ ਤੁਹਾਡੇ ਭਾਈਵਾਲ ਹਾਂ। ਸਤ ਸ੍ਰੀ ਅਕਾਲ।",
    },
}


def get_greetings(lang_code: str) -> dict[str, str]:
    """Get greeting prompts for a language, fallback to English."""
    return CALL_GREETINGS.get(lang_code, CALL_GREETINGS["en-IN"])
