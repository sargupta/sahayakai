"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Form } from "@/components/ui/form";
import { Loader2 } from "lucide-react";
import { LessonPlanDisplay } from "@/components/lesson-plan-display";
import { LessonPlanHeader } from "@/components/lesson-plan/lesson-plan-header";
import { LessonPlanInputSection } from "@/components/lesson-plan/lesson-plan-input-section";
import { LessonPlanSidebar } from "@/components/lesson-plan/lesson-plan-sidebar";
import { useLessonPlan } from "../hooks/use-lesson-plan";

type LessonPlanViewProps = ReturnType<typeof useLessonPlan>;

const translations: Record<string, any> = {
    en: {
        title: "Lesson Plan",
        description: "Create a comprehensive lesson plan using your voice or by typing a topic below.",
        inputs: {
            microphone: "Speak your lesson topic...",
            quickIdeas: "Quick Ideas",
            quickTemplates: "Quick Start Templates"
        },
        sidebar: {
            configuration: "Lesson Plan Settings",
            customizeOutput: "Customize the output.",
            contextImage: "Add Context Image (Optional)",
            grade: "Grade",
            language: "Language",
            subject: "Subject",
            showAdvanced: "Show Advanced Options",
            hideAdvanced: "Hide Advanced Options",
            resources: "Resources Available",
            difficulty: "Difficulty Level",
            standard: "(Standard)",
            ncert: "Link NCERT Chapter (Optional)"
        },
        generateButton: "Generate Lesson Plan",
        generating: "Generating Lesson Plan..."
    },
    hi: {
        title: "पाठ योजना",
        description: "अपनी आवाज़ का उपयोग करके या नीचे कोई विषय टाइप करके एक व्यापक पाठ योजना बनाएं।",
        inputs: {
            microphone: "अपने पाठ का विषय बोलें...",
            quickIdeas: "त्वरित विचार",
            quickTemplates: "त्वरित शुरुआत टेम्पलेट्स"
        },
        sidebar: {
            configuration: "2. कॉन्फ़िगरेशन",
            customizeOutput: "आउटपुट को अनुकूलित करें।",
            contextImage: "संदर्भ छवि जोड़ें (वैकल्पिक)",
            grade: "कक्षा",
            language: "भाषा",
            subject: "विषय",
            showAdvanced: "उन्नत विकल्प दिखाएं",
            hideAdvanced: "उन्नत विकल्प छिपाएं",
            resources: "उपलब्ध संसाधन",
            difficulty: "कठिनाई स्तर",
            standard: "(मानक)",
            ncert: "NCERT अध्याय लिंक करें (वैकल्पिक)"
        },
        generateButton: "पाठ योजना बनाएं",
        generating: "पाठ योजना बन रही है..."
    },
    bn: {
        title: "পাঠ পরিকল্পনা",
        description: "আপনার কণ্ঠস্বর ব্যবহার করে বা নীচে একটি বিষয় টাইপ করে একটি ব্যাপক পাঠ পরিকল্পনা তৈরি করুন।",
        inputs: {
            microphone: "আপনার পাঠের বিষয় বলুন...",
            quickIdeas: "দ্রুত ধারণা",
            quickTemplates: "দ্রুত শুরুর টেমপ্লেট"
        },
        sidebar: {
            configuration: "2. কনফিগারেশন",
            customizeOutput: "আউটপুট কাস্টমাইজ করুন।",
            contextImage: "প্রসঙ্গ ছবি যোগ করুন (ঐচ্ছিক)",
            grade: "শ্রেণী",
            language: "ভাষা",
            showAdvanced: "উন্নত বিকল্প দেখান",
            hideAdvanced: "উন্নত বিকল্প লুকান",
            resources: "উপলব্ধ সম্পদ",
            difficulty: "কঠিনতা স্তর",
            standard: "(মানক)",
            ncert: "NCERT অধ্যায় লিঙ্ক করুন (ঐচ্ছিক)"
        },
        generateButton: "পাঠ পরিকল্পনা তৈরি করুন",
        generating: "পাঠ পরিকল্পনা তৈরি হচ্ছে..."
    },
    te: {
        title: "పాఠ్య ప్రణాళిక",
        description: "మీ స్వరాన్ని ఉపయోగించి లేదా క్రింద ఒక అంశాన్ని టైప్ చేయడం ద్వారా సమగ్ర పాఠ్య ప్రణాళికను సృష్టించండి.",
        inputs: {
            microphone: "మీ పాఠం అంశాన్ని మాట్లాడండి...",
            quickIdeas: "త్వరిత ఆలోచనలు",
            quickTemplates: "త్వరిత ప్రారంభ టెంప్లేట్లు"
        },
        sidebar: {
            configuration: "2. కాన్ఫిగరేషన్",
            customizeOutput: "అవుట్‌పుట్‌ను అనుకూలీకరించండి.",
            contextImage: "సందర్భ చిత్రాన్ని జోడించండి (ఐచ్ఛికం)",
            grade: "తరగతి",
            language: "భాష",
            showAdvanced: "అధునాతన ఎంపికలను చూపించు",
            hideAdvanced: "అధునాతన ఎంపికలను దాచు",
            resources: "అందుబాటులో ఉన్న వనరులు",
            difficulty: "క్లిష్టత స్థాయి",
            standard: "(ప్రామాణిక)",
            ncert: "NCERT అధ్యాయాన్ని లింక్ చేయండి (ఐచ్ఛికం)"
        },
        generateButton: "పాఠ్య ప్రణాళికను రూపొందించండి",
        generating: "పాఠ్య ప్రణాళిక రూపొందించబడుతోంది..."
    },
    mr: {
        title: "पाठ नियोजन",
        description: "तुमचा आवाज वापरून किंवा खाली एखादा विषय टाइप करून सर्वसमावेशक पाठ नियोजन तयार करा.",
        inputs: {
            microphone: "तुमच्या पाठाचा विषय बोला...",
            quickIdeas: "जलद कल्पना",
            quickTemplates: "जलद प्रारंभ टेम्पलेट्स"
        },
        sidebar: {
            configuration: "2. कॉन्फिगरेशन",
            customizeOutput: "आउटपुट सानुकूलित करा.",
            contextImage: "संदर्भ प्रतिमा जोडा (वैकल्पिक)",
            grade: "इयत्ता",
            language: "भाषा",
            showAdvanced: "प्रगत पर्याय दाखवा",
            hideAdvanced: "प्रगत पर्याय लपवा",
            resources: "उपलब्ध संसाधने",
            difficulty: "काठिन्य पातळी",
            standard: "(मानक)",
            ncert: "NCERT धडा लिंक करा (वैकल्पिक)"
        },
        generateButton: "पाठ नियोजन तयार करा",
        generating: "पाठ नियोजन तयार होत आहे..."
    },
    ta: {
        title: "பாடத் திட்டம்",
        description: "உங்கள் குரலைப் பயன்படுத்தி அல்லது கீழே ஒரு தலைப்பைத் தட்டச்சு செய்து விரிவான பாடத் திட்டத்தை உருவாக்கவும்.",
        inputs: {
            microphone: "உங்கள் பாடத் தலைப்பைப் பேசுங்கள்...",
            quickIdeas: "விரைவான யோசனைகள்",
            quickTemplates: "விரைவுத் தொடக்க வார்ப்புருக்கள்"
        },
        sidebar: {
            configuration: "2. கட்டமைப்பு",
            customizeOutput: "வெளியீட்டைத் தனிப்பயனாக்கவும்.",
            contextImage: "சூழல் படத்தைச் சேர்க்கவும் (விருப்பத்தேர்வு)",
            grade: "வகுப்பு",
            language: "மொழி",
            showAdvanced: "மேம்பட்ட விருப்பங்களைக் காட்டு",
            hideAdvanced: "மேம்பட்ட விருப்பங்களை மறை",
            resources: "கிடைக்கும் வளங்கள்",
            difficulty: "கடினத் தன்மை",
            standard: "(தரநிலை)",
            ncert: "NCERT அத்தியாயத்தை இணைக்கவும் (விருப்பத்தேர்வு)"
        },
        generateButton: "பாடத் திட்டத்தை உருவாக்கவும்",
        generating: "பாடத் திட்டம் உருவாகிறது..."
    },
    gu: {
        title: "પાઠ યોજના",
        description: "તમારા અવાજનો ઉપયોગ કરીને અથવા નીચે કોઈ વિષય ટાઈપ કરીને એક વ્યાપક પાઠ યોજના બનાવો.",
        inputs: {
            microphone: "તમારા પાઠનો વિષય બોલો...",
            quickIdeas: "ઝડપી વિચારો",
            quickTemplates: "ઝડપી શરૂઆત નમૂનાઓ"
        },
        sidebar: {
            configuration: "2. રૂપરેખાંકન",
            customizeOutput: "આઉટપુટ કસ્ટમાઇઝ કરો.",
            contextImage: "સંદર્ભ છબી ઉમેરો (વૈકલ્પિક)",
            grade: "ધોરણ",
            language: "ભાષા",
            showAdvanced: "અદ્યતન વિકલ્પો બતાવો",
            hideAdvanced: "અદ્યતન વિકલ્પો છુપાવો",
            resources: "ઉપલબ્ધ સંસાધનો",
            difficulty: "મુશ્કેલી સ્તર",
            standard: "(પ્રમાણભૂત)",
            ncert: "NCERT પ્રકરણ લિંક કરો (વૈકલ્પિક)"
        },
        generateButton: "પાઠ યોજના બનાવો",
        generating: "પાઠ યોજના બની રહી છે..."
    },
    kn: {
        title: "ಪಾಠ ಯೋಜನೆ",
        description: "ನಿಮ್ಮ ಧ್ವನಿಯನ್ನು ಬಳಸಿ ಅಥವಾ ಕೆಳಗೆ ವಿಷಯವನ್ನು ಟೈಪ್ ಮಾಡುವ ಮೂಲಕ ಸಮಗ್ರ ಪಾಠ ಯೋಜನೆಯನ್ನು ರಚಿಸಿ.",
        inputs: {
            microphone: "ನಿಮ್ಮ ಪಾಠದ ವಿಷಯವನ್ನು ಮಾತನಾಡಿ...",
            quickIdeas: "ತ್ವರಿತ ಆಲೋಚನೆಗಳು",
            quickTemplates: "ತ್ವರಿತ ಆರಂಭದ ಟೆಂಪ್ಲೇಟ್‌ಗಳು"
        },
        sidebar: {
            configuration: "2. ಸಂರಚನೆ",
            customizeOutput: "ಔಟ್‌ಪುಟ್ ಅನ್ನು ಕಸ್ಟಮೈಸ್ ಮಾಡಿ.",
            contextImage: "ಸಂದರ್ಭ ಚಿತ್ರವನ್ನು ಸೇರಿಸಿ (ಐಚ್ಛಿಕ)",
            grade: "ತರಗತಿ",
            language: "ಭಾಷೆ",
            subject: "ವಿಷಯ",
            showAdvanced: "ಸುಧಾರಿತ ಆಯ್ಕೆಗಳನ್ನು ತೋರಿಸಿ",
            hideAdvanced: "ಸುಧಾರಿತ ಆಯ್ಕೆಗಳನ್ನು ಮರೆಮಾಡಿ",
            resources: "ಲಭ್ಯವಿರುವ ಸಂಪನ್ಮೂಲಗಳು",
            difficulty: "ಕಠಿಣತೆಯ ಮಟ್ಟ",
            standard: "(ಪ್ರಮಾಣಿತ)",
            ncert: "NCERT ಅಧ್ಯಾಯವನ್ನು ಲಿಂಕ್ ಮಾಡಿ (ಐಚ್ಛಿಕ)"
        },
        generateButton: "ಪಾಠ ಯೋಜನೆಯನ್ನು ರಚಿಸಿ",
        generating: "ಪಾಠ ಯೋಜನೆಯನ್ನು ರಚಿಸಲಾಗುತ್ತಿದೆ..."
    },
    pa: {
        title: "ਪਾਠ ਯੋਜਨਾ",
        description: "ਆਪਣੀ ਆਵਾਜ਼ ਦੀ ਵਰਤੋਂ ਕਰਕੇ ਜਾਂ ਹੇਠਾਂ ਕੋਈ ਵਿਸ਼ਾ ਟਾਈਪ ਕਰਕੇ ਇੱਕ ਵਿਆਪਕ ਪਾਠ ਯੋਜਨਾ ਬਣਾਓ।",
        inputs: {
            microphone: "ਆਪਣੇ ਪਾਠ ਦਾ ਵਿਸ਼ਾ ਬੋਲੋ...",
            quickIdeas: "ਤੇਜ਼ ਵਿਚਾਰ",
            quickTemplates: "ਤੇਜ਼ ਸ਼ੁਰੂਆਤੀ ਨਮੂਨੇ"
        },
        sidebar: {
            configuration: "2. ਸੰਰਚਨਾ",
            customizeOutput: "ਆਉਟਪੁੱਟ ਨੂੰ ਅਨੁਕੂਲਿਤ ਕਰੋ।",
            contextImage: "ਸੰਦਰਭ ਚਿੱਤਰ ਸ਼ਾਮਲ ਕਰੋ (ਵਿਕਲਪਿਕ)",
            grade: "ਜਮਾਤ",
            language: "ਭਾਸ਼ਾ",
            showAdvanced: "ਉੱਨਤ ਵਿਕਲਪ ਦਿਖਾਓ",
            hideAdvanced: "ਉੱਨਤ ਵਿਕਲਪ ਲੁਕਾਓ",
            resources: "ਉਪਲਬਧ ਸਰੋਤ",
            difficulty: "ਮੁਸ਼ਕਲ ਪੱਧਰ",
            standard: "(ਮਿਆਰੀ)",
            ncert: "NCERT ਅਧਿਆਇ ਲਿੰਕ ਕਰੋ (ਵਿਕਲਪਿਕ)"
        },
        generateButton: "ਪਾਠ ਯੋਜਨਾ ਬਣਾਓ",
        generating: "ਪਾਠ ਯੋਜਨਾ ਬਣ ਰਹੀ ਹੈ..."
    },
    ml: {
        title: "പാഠ്യപദ്ധതി",
        description: "നിങ്ങളുടെ ശബ്ദം ഉപയോഗിച്ചോ താഴെ ഒരു വിഷയം ടൈപ്പ് ചെയ്തോ സമഗ്രമായ ഒരു പാഠ്യപദ്ധതി തയ്യാറാക്കുക.",
        inputs: {
            microphone: "നിങ്ങളുടെ പാഠ വിഷയം പറയുക...",
            quickIdeas: "പെട്ടെന്നുള്ള ആശയങ്ങൾ",
            quickTemplates: "പെട്ടെന്നുള്ള തുടക്ക ടെംപ്ലേറ്റുകൾ"
        },
        sidebar: {
            configuration: "2. ക്രമീകരണം",
            customizeOutput: "ഔട്ട്‌പുട്ട് ക്രമീകരിക്കുക.",
            contextImage: "സന്ദർഭ ചിത്രം ചേർക്കുക (ഓപ്ഷണൽ)",
            grade: "ക്ലാസ്",
            language: "ഭാഷ",
            showAdvanced: "വിപുലമായ ഓപ്ഷനുകൾ കാണിക്കുക",
            hideAdvanced: "വിപുലമായ ഓപ്ഷനുകൾ മറയ്ക്കുക",
            resources: "ലഭ്യമായ വിഭവങ്ങൾ",
            difficulty: "ബുദ്ധിമുട്ട് നില",
            standard: "(സാധാരണം)",
            ncert: "NCERT അധ്യായം ലിങ്ക് ചെയ്യുക (ഓപ്ഷണൽ)"
        },
        generateButton: "പാഠ്യപദ്ധതി തയ്യാറാക്കുക",
        generating: "പാഠ്യപദ്ധതി തയ്യാറാക്കുന്നു..."
    },
    or: {
        title: "ପାଠ ଯୋଜନା",
        description: "ଆପଣଙ୍କ ସ୍ୱର ବ୍ୟବହାର କରି କିମ୍ବା ନିମ୍ନରେ ଏକ ବିଷୟ ଟାଇପ୍ କରି ଏକ ବିସ୍ତୃତ ପାଠ ଯୋଜନା ତିଆରି କରନ୍ତୁ |",
        inputs: {
            microphone: "ଆପଣଙ୍କ ପାଠ ବିଷୟ କୁହନ୍ତୁ...",
            quickIdeas: "ଶୀଘ୍ର ଧାରଣା",
            quickTemplates: "ଶୀଘ୍ର ଆରମ୍ଭ ଟେମ୍ପଲେଟ୍"
        },
        sidebar: {
            configuration: "2. ବିନ୍ୟାସ",
            customizeOutput: "ଆଉଟପୁଟ୍ କଷ୍ଟମାଇଜ୍ କରନ୍ତୁ |",
            contextImage: "ପ୍ରସଙ୍ଗ ଚିତ୍ର ଯୋଡନ୍ତୁ (ଇଚ୍ଛାଧୀନ)",
            grade: "ଶ୍ରେଣୀ",
            language: "ଭାଷା",
            showAdvanced: "ଉନ୍ନତ ବିକଳ୍ପ ଦେଖାନ୍ତୁ",
            hideAdvanced: "ଉନ୍ନତ ବିକଳ୍ପ ଲୁଚାନ୍ତୁ",
            resources: "ଉପଲବ୍ଧ ଉତ୍ସ",
            difficulty: "କଠିନତା ସ୍ତର",
            standard: "(ମାନକ)",
            ncert: "NCERT ଅଧ୍ୟାୟ ଲିଙ୍କ୍ କରନ୍ତୁ (ଇଚ୍ଛାଧୀନ)"
        },
        generateButton: "ପାଠ ଯୋଜନା ତିଆରି କରନ୍ତୁ",
        generating: "ପାଠ ଯୋଜନା ତିଆରି ହେଉଛି..."
    }
};

export function LessonPlanView({
    form,
    onSubmit,
    lessonPlan,
    isLoading,
    selectedChapter,
    setSelectedChapter,
    resourceLevel,
    setResourceLevel,
    difficultyLevel,
    setDifficultyLevel,
    currentGrade,
    selectedLanguage,
    topicPlaceholder,
    handleTranscript,
    handlePromptClick,
    handleTemplateSelect,
    loadingMessage,
}: LessonPlanViewProps) {
    const t = translations[selectedLanguage] || translations.en;
    return (
        <div className="w-full max-w-6xl mx-auto px-4 py-8 md:py-12">

            <div className="w-full bg-white border border-slate-200 shadow-sm rounded-2xl overflow-hidden">
                {/* Clean Top Bar */}
                <div className="h-1.5 w-full bg-primary" />


                <LessonPlanHeader
                    title={t.title}
                    description={t.description}
                />
                <CardContent>
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                                {/* LEFT COLUMN: Primary Task (7 cols) */}
                                <div className="lg:col-span-7 space-y-4 min-w-0">
                                    <LessonPlanInputSection
                                        topicPlaceholder={topicPlaceholder}
                                        labels={t.inputs}
                                        selectedLanguage={selectedLanguage}
                                        onTranscriptChange={handleTranscript}
                                        onPromptClick={handlePromptClick}
                                        onTemplateSelect={handleTemplateSelect}
                                    />
                                </div>

                                {/* RIGHT COLUMN: Secondary Context (5 cols) */}
                                <div className="lg:col-span-5 shrink-0 pt-4 lg:pt-0">
                                    <LessonPlanSidebar
                                        selectedLanguage={selectedLanguage}
                                        labels={t.sidebar}
                                        resourceLevel={resourceLevel}
                                        setResourceLevel={setResourceLevel}
                                        difficultyLevel={difficultyLevel}
                                        setDifficultyLevel={setDifficultyLevel}
                                        currentGrade={currentGrade}
                                        setSelectedChapter={setSelectedChapter}
                                        setTopic={(topic) => {
                                            form.setValue("topic", topic);
                                            form.trigger("topic");
                                        }}
                                        generateButton={
                                            <Button type="submit" disabled={isLoading} className="w-full text-lg py-6 bg-[#FF9933] hover:bg-[#FF9933]/90 text-white shadow-lg shadow-[#FF9933]/20 transition-all font-headline">
                                                {isLoading ? (
                                                    <>
                                                        <Loader2 className="mr-2 h-6 w-6 animate-spin" />
                                                        {t.generating}
                                                    </>
                                                ) : (
                                                    t.generateButton
                                                )}
                                            </Button>
                                        }
                                    />
                                </div>
                            </div>
                        </form>
                    </Form>
                </CardContent>
            </div>

            {lessonPlan && (
                <div className="mt-12 animate-in fade-in slide-in-from-bottom-8 duration-700">
                    <LessonPlanDisplay lessonPlan={lessonPlan} selectedLanguage={selectedLanguage} />
                </div>
            )}
        </div>
    );
}
