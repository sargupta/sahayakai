#!/usr/bin/env python3
"""Regenerate the 99-cell VIDYA parity fixture set.

    python tests/fixtures/build_vidya_parity_cells.py

WHY THIS FILE EXISTS
--------------------
The original parity harness that produced `vidya-final.json` (0/99, 2026-06-06)
was never committed — only its OUTPUT survived. That output records, per cell,
the language, intent, expected flow and the flow Genkit returned, but NOT the
input prompt. So the fixture set had to be reconstructed.

The 9 archetypes and their expected/Genkit flows below are taken verbatim from
`sahayakai-main/qa/results/lane-F/vidya-final.json`. The prompt TEXT is
reconstructed from the archetype ids (`ans-photosyn`, `cre-quiz`, ...), which
encode exactly what each cell asked.

WHAT THIS MEANS FOR SCORING
---------------------------
Flow-match, script-coverage and entity-hit are scored against the recorded
baseline and are trustworthy. Cosine similarity is NOT reconstructable — the
baseline stored the resulting `semantic` score but not Genkit's response text.
Until someone captures those 99 Genkit responses from a preview deploy, the
harness scores 3 of the 4 original criteria and says so in its output.

TRANSLATION PROVENANCE
----------------------
The 10 non-English prompt sets are model-authored, not native-speaker reviewed.
They are TEST INPUTS, not user-facing copy, so the bar is "a teacher could
plausibly type this", not "publishable". If a cell fails for a reason that
looks like awkward phrasing rather than a real routing bug, fix the fixture and
say so in the commit — do not bend the agent to match a bad prompt.
"""

from __future__ import annotations

import json
from pathlib import Path

# ── The 9 archetypes ──────────────────────────────────────────────────────
# expected_flow / genkit_flow come straight from the recorded baseline.
# `entities` are the key terms the entity-hit scorer looks for in a reply.
ARCHETYPES = [
    {
        "id": "ans-photosyn", "intent": "ANSWER",
        "expected_flow": None, "genkit_flow": "instant-answer",
        "entities": ["photosynthesis", "प्रकाश संश्लेषण", "সালোকসংশ্লেষ", "ஒளிச்சேர்க்கை"],
    },
    {
        "id": "ans-fractions", "intent": "ANSWER",
        "expected_flow": None, "genkit_flow": "instant-answer",
        "entities": ["fraction", "भिन्न", "ভগ্নাংশ", "பின்னம்"],
    },
    {
        "id": "ans-democracy", "intent": "ANSWER",
        "expected_flow": None, "genkit_flow": "instant-answer",
        "entities": ["democracy", "लोकतंत्र", "গণতন্ত্র", "ஜனநாயகம்"],
    },
    {
        "id": "cre-lesson", "intent": "CREATE",
        "expected_flow": "lessonPlan", "genkit_flow": "lesson-plan",
        "entities": ["water cycle", "जल चक्र", "lesson"],
    },
    {
        "id": "cre-quiz", "intent": "CREATE",
        "expected_flow": "quiz", "genkit_flow": "quiz-generator",
        "entities": ["photosynthesis", "quiz", "प्रकाश संश्लेषण"],
    },
    {
        "id": "cre-workshet", "intent": "CREATE",
        "expected_flow": "worksheet", "genkit_flow": "worksheet-wizard",
        "entities": ["fraction", "worksheet", "भिन्न"],
    },
    {
        "id": "act-visual", "intent": "ACTION",
        "expected_flow": "visualAid", "genkit_flow": "visual-aid-designer",
        "entities": ["digestive", "diagram", "पाचन"],
    },
    {
        "id": "act-exam", "intent": "ACTION",
        "expected_flow": "examPaper", "genkit_flow": "exam-paper",
        "entities": ["exam", "science", "परीक्षा"],
    },
    {
        "id": "act-video", "intent": "ACTION",
        "expected_flow": "videoStoryteller", "genkit_flow": "video-storyteller",
        "entities": ["solar system", "video", "सौर मंडल"],
    },
]

# ── Prompts: 11 languages × the 9 archetypes above, same order ────────────
PROMPTS: dict[str, list[str]] = {
    "en": [
        "What is photosynthesis?",
        "Explain what a fraction is",
        "What is democracy?",
        "Make a lesson plan on the water cycle for class 6",
        "Create a quiz on photosynthesis for class 7",
        "Make a worksheet on fractions for class 5",
        "Draw a diagram of the human digestive system for class 8",
        "Create a class 10 science exam paper",
        "Find videos on the solar system for class 6",
    ],
    "hi": [
        "प्रकाश संश्लेषण क्या है?",
        "भिन्न क्या होती है, समझाइए",
        "लोकतंत्र क्या है?",
        "कक्षा 6 के लिए जल चक्र पर पाठ योजना बनाइए",
        "कक्षा 7 के लिए प्रकाश संश्लेषण पर एक प्रश्नोत्तरी बनाइए",
        "कक्षा 5 के लिए भिन्न पर कार्यपत्रक बनाइए",
        "कक्षा 8 के लिए मानव पाचन तंत्र का चित्र बनाइए",
        "कक्षा 10 का विज्ञान प्रश्न पत्र बनाइए",
        "कक्षा 6 के लिए सौर मंडल पर वीडियो खोजिए",
    ],
    "bn": [
        "সালোকসংশ্লেষ কী?",
        "ভগ্নাংশ কী তা ব্যাখ্যা করুন",
        "গণতন্ত্র কী?",
        "ষষ্ঠ শ্রেণির জন্য জলচক্রের উপর একটি পাঠ পরিকল্পনা তৈরি করুন",
        "সপ্তম শ্রেণির জন্য সালোকসংশ্লেষের উপর একটি কুইজ তৈরি করুন",
        "পঞ্চম শ্রেণির জন্য ভগ্নাংশের উপর একটি ওয়ার্কশিট তৈরি করুন",
        "অষ্টম শ্রেণির জন্য মানব পরিপাকতন্ত্রের একটি চিত্র আঁকুন",
        "দশম শ্রেণির বিজ্ঞান পরীক্ষার প্রশ্নপত্র তৈরি করুন",
        "ষষ্ঠ শ্রেণির জন্য সৌরজগতের উপর ভিডিও খুঁজুন",
    ],
    "ta": [
        "ஒளிச்சேர்க்கை என்றால் என்ன?",
        "பின்னம் என்றால் என்ன என்பதை விளக்குங்கள்",
        "ஜனநாயகம் என்றால் என்ன?",
        "6ஆம் வகுப்புக்கு நீர்ச்சுழற்சி பற்றி பாடத் திட்டம் உருவாக்குங்கள்",
        "7ஆம் வகுப்புக்கு ஒளிச்சேர்க்கை பற்றி வினாடி வினா உருவாக்குங்கள்",
        "5ஆம் வகுப்புக்கு பின்னங்கள் பற்றி பயிற்சித்தாள் உருவாக்குங்கள்",
        "8ஆம் வகுப்புக்கு மனித செரிமான மண்டலத்தின் படம் வரையுங்கள்",
        "10ஆம் வகுப்பு அறிவியல் தேர்வுத் தாள் உருவாக்குங்கள்",
        "6ஆம் வகுப்புக்கு சூரிய குடும்பம் பற்றிய வீடியோக்களைத் தேடுங்கள்",
    ],
    "te": [
        "కిరణజన్య సంయోగక్రియ అంటే ఏమిటి?",
        "భిన్నం అంటే ఏమిటో వివరించండి",
        "ప్రజాస్వామ్యం అంటే ఏమిటి?",
        "6వ తరగతికి నీటి చక్రంపై పాఠ ప్రణాళిక తయారు చేయండి",
        "7వ తరగతికి కిరణజన్య సంయోగక్రియపై క్విజ్ తయారు చేయండి",
        "5వ తరగతికి భిన్నాలపై వర్క్‌షీట్ తయారు చేయండి",
        "8వ తరగతికి మానవ జీర్ణవ్యవస్థ చిత్రం గీయండి",
        "10వ తరగతి సైన్స్ పరీక్ష పత్రం తయారు చేయండి",
        "6వ తరగతికి సౌర వ్యవస్థపై వీడియోలు వెతకండి",
    ],
    "mr": [
        "प्रकाशसंश्लेषण म्हणजे काय?",
        "अपूर्णांक म्हणजे काय ते समजावून सांगा",
        "लोकशाही म्हणजे काय?",
        "इयत्ता ६ वीसाठी जलचक्रावर पाठ योजना तयार करा",
        "इयत्ता ७ वीसाठी प्रकाशसंश्लेषणावर प्रश्नमंजुषा तयार करा",
        "इयत्ता ५ वीसाठी अपूर्णांकांवर कार्यपत्रिका तयार करा",
        "इयत्ता ८ वीसाठी मानवी पचनसंस्थेचे चित्र काढा",
        "इयत्ता १० वीचा विज्ञान प्रश्नपत्रिका तयार करा",
        "इयत्ता ६ वीसाठी सौरमालेवर व्हिडिओ शोधा",
    ],
    "gu": [
        "પ્રકાશસંશ્લેષણ શું છે?",
        "અપૂર્ણાંક શું છે તે સમજાવો",
        "લોકશાહી શું છે?",
        "ધોરણ 6 માટે જળચક્ર પર પાઠ યોજના બનાવો",
        "ધોરણ 7 માટે પ્રકાશસંશ્લેષણ પર ક્વિઝ બનાવો",
        "ધોરણ 5 માટે અપૂર્ણાંક પર વર્કશીટ બનાવો",
        "ધોરણ 8 માટે માનવ પાચનતંત્રનું ચિત્ર દોરો",
        "ધોરણ 10 નું વિજ્ઞાન પરીક્ષા પેપર બનાવો",
        "ધોરણ 6 માટે સૌરમંડળ પર વિડિઓ શોધો",
    ],
    "kn": [
        "ದ್ಯುತಿಸಂಶ್ಲೇಷಣೆ ಎಂದರೇನು?",
        "ಭಿನ್ನರಾಶಿ ಎಂದರೇನು ಎಂದು ವಿವರಿಸಿ",
        "ಪ್ರಜಾಪ್ರಭುತ್ವ ಎಂದರೇನು?",
        "6ನೇ ತರಗತಿಗೆ ಜಲಚಕ್ರದ ಬಗ್ಗೆ ಪಾಠ ಯೋಜನೆ ಮಾಡಿ",
        "7ನೇ ತರಗತಿಗೆ ದ್ಯುತಿಸಂಶ್ಲೇಷಣೆ ಬಗ್ಗೆ ರಸಪ್ರಶ್ನೆ ಮಾಡಿ",
        "5ನೇ ತರಗತಿಗೆ ಭಿನ್ನರಾಶಿಗಳ ಬಗ್ಗೆ ಕಾರ್ಯಹಾಳೆ ಮಾಡಿ",
        "8ನೇ ತರಗತಿಗೆ ಮಾನವ ಜೀರ್ಣಾಂಗ ವ್ಯವಸ್ಥೆಯ ಚಿತ್ರ ಬಿಡಿಸಿ",
        "10ನೇ ತರಗತಿಯ ವಿಜ್ಞಾನ ಪರೀಕ್ಷಾ ಪ್ರಶ್ನೆಪತ್ರಿಕೆ ಮಾಡಿ",
        "6ನೇ ತರಗತಿಗೆ ಸೌರವ್ಯೂಹದ ಬಗ್ಗೆ ವೀಡಿಯೊಗಳನ್ನು ಹುಡುಕಿ",
    ],
    "ml": [
        "പ്രകാശസംശ്ലേഷണം എന്താണ്?",
        "ഭിന്നസംഖ്യ എന്താണെന്ന് വിശദീകരിക്കുക",
        "ജനാധിപത്യം എന്താണ്?",
        "ആറാം ക്ലാസിന് ജലചക്രത്തെക്കുറിച്ച് പാഠ പദ്ധതി ഉണ്ടാക്കുക",
        "ഏഴാം ക്ലാസിന് പ്രകാശസംശ്ലേഷണത്തെക്കുറിച്ച് ക്വിസ് ഉണ്ടാക്കുക",
        "അഞ്ചാം ക്ലാസിന് ഭിന്നസംഖ്യകളെക്കുറിച്ച് വർക്ക്ഷീറ്റ് ഉണ്ടാക്കുക",
        "എട്ടാം ക്ലാസിന് മനുഷ്യ ദഹനവ്യവസ്ഥയുടെ ചിത്രം വരയ്ക്കുക",
        "പത്താം ക്ലാസ് സയൻസ് പരീക്ഷാ ചോദ്യപേപ്പർ ഉണ്ടാക്കുക",
        "ആറാം ക്ലാസിന് സൗരയൂഥത്തെക്കുറിച്ചുള്ള വീഡിയോകൾ കണ്ടെത്തുക",
    ],
    "pa": [
        "ਪ੍ਰਕਾਸ਼ ਸੰਸ਼ਲੇਸ਼ਣ ਕੀ ਹੈ?",
        "ਭਿੰਨ ਕੀ ਹੁੰਦਾ ਹੈ, ਸਮਝਾਓ",
        "ਲੋਕਤੰਤਰ ਕੀ ਹੈ?",
        "ਜਮਾਤ 6 ਲਈ ਜਲ ਚੱਕਰ ਉੱਤੇ ਪਾਠ ਯੋਜਨਾ ਬਣਾਓ",
        "ਜਮਾਤ 7 ਲਈ ਪ੍ਰਕਾਸ਼ ਸੰਸ਼ਲੇਸ਼ਣ ਉੱਤੇ ਕੁਇਜ਼ ਬਣਾਓ",
        "ਜਮਾਤ 5 ਲਈ ਭਿੰਨਾਂ ਉੱਤੇ ਵਰਕਸ਼ੀਟ ਬਣਾਓ",
        "ਜਮਾਤ 8 ਲਈ ਮਨੁੱਖੀ ਪਾਚਨ ਪ੍ਰਣਾਲੀ ਦਾ ਚਿੱਤਰ ਬਣਾਓ",
        "ਜਮਾਤ 10 ਦਾ ਵਿਗਿਆਨ ਪ੍ਰੀਖਿਆ ਪੇਪਰ ਬਣਾਓ",
        "ਜਮਾਤ 6 ਲਈ ਸੂਰਜੀ ਮੰਡਲ ਉੱਤੇ ਵੀਡੀਓ ਲੱਭੋ",
    ],
    "or": [
        "ଆଲୋକ ସଂଶ୍ଳେଷଣ କ'ଣ?",
        "ଭଗ୍ନାଂଶ କ'ଣ ବୁଝାନ୍ତୁ",
        "ଗଣତନ୍ତ୍ର କ'ଣ?",
        "ଷଷ୍ଠ ଶ୍ରେଣୀ ପାଇଁ ଜଳଚକ୍ର ଉପରେ ପାଠ ଯୋଜନା ପ୍ରସ୍ତୁତ କରନ୍ତୁ",
        "ସପ୍ତମ ଶ୍ରେଣୀ ପାଇଁ ଆଲୋକ ସଂଶ୍ଳେଷଣ ଉପରେ କୁଇଜ୍ ପ୍ରସ୍ତୁତ କରନ୍ତୁ",
        "ପଞ୍ଚମ ଶ୍ରେଣୀ ପାଇଁ ଭଗ୍ନାଂଶ ଉପରେ ୱାର୍କସିଟ୍ ପ୍ରସ୍ତୁତ କରନ୍ତୁ",
        "ଅଷ୍ଟମ ଶ୍ରେଣୀ ପାଇଁ ମାନବ ପାଚନ ତନ୍ତ୍ରର ଚିତ୍ର ଅଙ୍କନ କରନ୍ତୁ",
        "ଦଶମ ଶ୍ରେଣୀର ବିଜ୍ଞାନ ପରୀକ୍ଷା ପ୍ରଶ୍ନପତ୍ର ପ୍ରସ୍ତୁତ କରନ୍ତୁ",
        "ଷଷ୍ଠ ଶ୍ରେଣୀ ପାଇଁ ସୌରଜଗତ ଉପରେ ଭିଡିଓ ଖୋଜନ୍ତୁ",
    ],
}


# ── Per-language concept terms for the ANSWER archetypes ─────────────────
# The entity check needs the concept word in the language the answer is
# actually written in. A shared English/Hindi/Bengali/Tamil list failed 19
# perfectly-correct cells: `te-ans-photosyn` answers with
# "కిరణజన్య సంయోగక్రియ", and even `mr-ans-democracy` uses "लोकशाही" where the
# Hindi list had "लोकतंत्र". Different word, same script.
CONCEPT_TERMS: dict[str, dict[str, str]] = {
    "photosynthesis": {
        "en": "photosynthesis", "hi": "प्रकाश संश्लेषण", "bn": "সালোকসংশ্লেষ",
        "ta": "ஒளிச்சேர்க்கை", "te": "కిరణజన్య సంయోగక్రియ", "mr": "प्रकाशसंश्लेषण",
        "gu": "પ્રકાશસંશ્લેષણ", "kn": "ದ್ಯುತಿಸಂಶ್ಲೇಷಣೆ", "ml": "പ്രകാശസംശ്ലേഷണം",
        "pa": "ਪ੍ਰਕਾਸ਼ ਸੰਸ਼ਲੇਸ਼ਣ", "or": "ଆଲୋକ ସଂଶ୍ଳେଷଣ",
    },
    "fraction": {
        "en": "fraction", "hi": "भिन्न", "bn": "ভগ্নাংশ", "ta": "பின்னம்",
        "te": "భిన్నం", "mr": "अपूर्णांक", "gu": "અપૂર્ણાંક", "kn": "ಭಿನ್ನರಾಶಿ",
        "ml": "ഭിന്നസംഖ്യ", "pa": "ਭਿੰਨ", "or": "ଭଗ୍ନାଂଶ",
    },
    "democracy": {
        "en": "democracy", "hi": "लोकतंत्र", "bn": "গণতন্ত্র", "ta": "ஜனநாயகம்",
        "te": "ప్రజాస్వామ్యం", "mr": "लोकशाही", "gu": "લોકશાહી",
        "kn": "ಪ್ರಜಾಪ್ರಭುತ್ವ", "ml": "ജനാധിപത്യം", "pa": "ਲੋਕਤੰਤਰ", "or": "ଗଣତନ୍ତ୍ର",
    },
}

# archetype id -> CONCEPT_TERMS key (ANSWER archetypes only)
ANSWER_CONCEPT = {
    "ans-photosyn": "photosynthesis",
    "ans-fractions": "fraction",
    "ans-democracy": "democracy",
}


OUT = Path(__file__).parent / "vidya_parity_cells.json"


def build() -> list[dict]:
    cells = []
    for lang, prompts in PROMPTS.items():
        if len(prompts) != len(ARCHETYPES):
            raise SystemExit(f"{lang}: {len(prompts)} prompts, expected {len(ARCHETYPES)}")
        for arch, message in zip(ARCHETYPES, prompts, strict=True):
            concept = ANSWER_CONCEPT.get(arch["id"])
            if concept:
                # Native term first, English second: answers sometimes carry the
                # English word alongside the local one, and either counts.
                entities = [CONCEPT_TERMS[concept][lang], CONCEPT_TERMS[concept]["en"]]
            else:
                entities = arch["entities"]
            cells.append({
                "cell": f"{lang}-{arch['id']}",
                "lang": lang,
                "intent": arch["intent"],
                "message": message,
                "expectedFlow": arch["expected_flow"],
                "genkitFlow": arch["genkit_flow"],
                "entities": entities,
            })
    return cells


if __name__ == "__main__":
    cells = build()
    if len(cells) != 99:
        raise SystemExit(f"expected 99 cells, built {len(cells)}")
    OUT.write_text(json.dumps(cells, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"wrote {len(cells)} cells to {OUT}")
