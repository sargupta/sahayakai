"use client";

/**
 * AssessmentCamera — photo-capture surface for the assignment-assessor flow.
 *
 * Why a new component (and not just extending <ImageUploader>):
 * - The assignment-assessor API expects a base64 **data URI inline** (so the
 *   server can pass it straight to Gemini). ImageUploader uploads to Firebase
 *   Storage and returns a download URL, which would force the server to do an
 *   extra fetch round-trip.
 * - We need `capture="environment"` so the rear camera fires on mobile.
 * - We need EXIF orientation handling so upside-down phone photos arrive the
 *   right way up before the model sees them.
 *
 * Decision (per plan §Camera): use the native `<input type="file" capture>`
 * path, not `getUserMedia`. Live camera preview is nicer but iOS Safari makes
 * it brittle and the kiosk-tier (read-only browsers) blocks it. The file
 * picker tier works everywhere.
 *
 * The component owns: file validation, EXIF re-orient, optional client-side
 * downscale, base64 conversion, preview, retake. It does NOT save to Firebase
 * Storage — the server does that on the way through.
 */

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { AlertCircle, Camera, Image as ImageIcon, Loader2, RefreshCw, X } from "lucide-react";
import Image from "next/image";
import { useRef, useState, type FC } from "react";

type Translations = Record<string, Record<string, string>>;

const translations: Translations = {
  en: {
    primaryLabel: "Take photo of student's work",
    primaryHelper: "Tap to open camera. Make sure handwriting is clear, well-lit, and the page is straight.",
    pickFromGallery: "Upload from gallery",
    preview: "Photo preview",
    retake: "Retake",
    remove: "Remove",
    processing: "Preparing photo…",
    errorTitle: "Photo error",
    errorSize: "Photo is too large (max 8 MB). Please retake at lower resolution.",
    errorType: "Unsupported format. Please use JPEG, PNG, or WebP.",
    errorRead: "Could not read the photo. Please try again.",
  },
  hi: {
    primaryLabel: "छात्र के काम की फ़ोटो लें",
    primaryHelper: "कैमरा खोलने के लिए टैप करें। हस्तलिपि साफ़, अच्छी रोशनी में, और पेज सीधा रखें।",
    pickFromGallery: "गैलरी से अपलोड करें",
    preview: "फ़ोटो पूर्वावलोकन",
    retake: "फिर से लें",
    remove: "हटाएँ",
    processing: "फ़ोटो तैयार हो रही है…",
    errorTitle: "फ़ोटो त्रुटि",
    errorSize: "फ़ोटो बहुत बड़ी है (अधिकतम 8 MB)। कृपया कम रिज़ॉल्यूशन पर पुनः लें।",
    errorType: "असमर्थित फ़ॉर्मैट। कृपया JPEG, PNG, या WebP का उपयोग करें।",
    errorRead: "फ़ोटो पढ़ी नहीं जा सकी। कृपया पुनः प्रयास करें।",
  },
  bn: {
    primaryLabel: "ছাত্রের কাজের ছবি তুলুন",
    primaryHelper: "ক্যামেরা খুলতে ট্যাপ করুন। হাতের লেখা স্পষ্ট, ভাল আলো এবং পৃষ্ঠা সোজা রাখুন।",
    pickFromGallery: "গ্যালারি থেকে আপলোড করুন",
    preview: "ছবির প্রিভিউ",
    retake: "আবার তুলুন",
    remove: "সরান",
    processing: "ছবি প্রস্তুত হচ্ছে…",
    errorTitle: "ছবির ত্রুটি",
    errorSize: "ছবি খুব বড় (সর্বোচ্চ 8 MB)। অনুগ্রহ করে কম রেজোলিউশনে আবার তুলুন।",
    errorType: "অসমর্থিত ফর্ম্যাট। অনুগ্রহ করে JPEG, PNG, বা WebP ব্যবহার করুন।",
    errorRead: "ছবি পড়া যায়নি। অনুগ্রহ করে আবার চেষ্টা করুন।",
  },
  ta: {
    primaryLabel: "மாணவரின் வேலையின் புகைப்படத்தை எடுக்கவும்",
    primaryHelper: "கேமராவை திறக்க தட்டவும். கையெழுத்து தெளிவாகவும், நல்ல வெளிச்சத்திலும், பக்கம் நேராகவும் இருக்க வேண்டும்.",
    pickFromGallery: "தொகுப்பிலிருந்து பதிவேற்றவும்",
    preview: "புகைப்பட முன்னோட்டம்",
    retake: "மீண்டும் எடுக்கவும்",
    remove: "அகற்று",
    processing: "புகைப்படத்தை தயார் செய்கிறது…",
    errorTitle: "புகைப்பட பிழை",
    errorSize: "புகைப்படம் மிகவும் பெரியது (அதிகபட்சம் 8 MB). குறைந்த தெளிவில் மீண்டும் எடுக்கவும்.",
    errorType: "ஆதரிக்கப்படாத வடிவம். JPEG, PNG, அல்லது WebP பயன்படுத்தவும்.",
    errorRead: "புகைப்படத்தைப் படிக்க முடியவில்லை. மீண்டும் முயற்சிக்கவும்.",
  },
  te: {
    primaryLabel: "విద్యార్థి పనిని ఫోటో తీయండి",
    primaryHelper: "కెమెరా తెరవడానికి నొక్కండి. చేతిరాత స్పష్టంగా, మంచి వెలుతురులో, పేజీ నేరుగా ఉండాలి.",
    pickFromGallery: "గ్యాలరీ నుండి అప్‌లోడ్ చేయండి",
    preview: "ఫోటో పరిదృశ్యం",
    retake: "మళ్లీ తీయండి",
    remove: "తొలగించండి",
    processing: "ఫోటో సిద్ధం చేస్తోంది…",
    errorTitle: "ఫోటో లోపం",
    errorSize: "ఫోటో చాలా పెద్దది (గరిష్టం 8 MB). తక్కువ రిజల్యూషన్‌లో మళ్లీ తీయండి.",
    errorType: "మద్దతు లేని ఫార్మాట్. దయచేసి JPEG, PNG, లేదా WebP ఉపయోగించండి.",
    errorRead: "ఫోటోను చదవలేకపోయాము. దయచేసి మళ్లీ ప్రయత్నించండి.",
  },
  kn: {
    primaryLabel: "ವಿದ್ಯಾರ್ಥಿಯ ಕೆಲಸದ ಫೋಟೋ ತೆಗೆಯಿರಿ",
    primaryHelper: "ಕ್ಯಾಮೆರಾ ತೆರೆಯಲು ಟ್ಯಾಪ್ ಮಾಡಿ. ಕೈಬರಹ ಸ್ಪಷ್ಟ, ಚೆನ್ನಾಗಿ ಬೆಳಗಿರಬೇಕು ಮತ್ತು ಪುಟ ನೇರವಾಗಿರಬೇಕು.",
    pickFromGallery: "ಗ್ಯಾಲರಿಯಿಂದ ಅಪ್‌ಲೋಡ್ ಮಾಡಿ",
    preview: "ಫೋಟೋ ಪೂರ್ವವೀಕ್ಷಣೆ",
    retake: "ಮತ್ತೆ ತೆಗೆಯಿರಿ",
    remove: "ತೆಗೆದುಹಾಕಿ",
    processing: "ಫೋಟೋ ಸಿದ್ಧಪಡಿಸಲಾಗುತ್ತಿದೆ…",
    errorTitle: "ಫೋಟೋ ದೋಷ",
    errorSize: "ಫೋಟೋ ತುಂಬಾ ದೊಡ್ಡದು (ಗರಿಷ್ಠ 8 MB). ಕಡಿಮೆ ರೆಸಲ್ಯೂಶನ್‌ನಲ್ಲಿ ಮತ್ತೆ ತೆಗೆಯಿರಿ.",
    errorType: "ಬೆಂಬಲಿಸದ ಸ್ವರೂಪ. JPEG, PNG, ಅಥವಾ WebP ಬಳಸಿ.",
    errorRead: "ಫೋಟೋ ಓದಲಾಗಲಿಲ್ಲ. ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ.",
  },
  ml: {
    primaryLabel: "വിദ്യാർത്ഥിയുടെ ജോലിയുടെ ഫോട്ടോ എടുക്കുക",
    primaryHelper: "ക്യാമറ തുറക്കാൻ ടാപ്പ് ചെയ്യുക. കൈയക്ഷരം വ്യക്തവും നന്നായി പ്രകാശിച്ചതും പേജ് നേരെയും ആയിരിക്കണം.",
    pickFromGallery: "ഗാലറിയിൽ നിന്നും അപ്‌ലോഡ് ചെയ്യുക",
    preview: "ഫോട്ടോ പ്രിവ്യൂ",
    retake: "വീണ്ടും എടുക്കുക",
    remove: "നീക്കം ചെയ്യുക",
    processing: "ഫോട്ടോ തയ്യാറാക്കുന്നു…",
    errorTitle: "ഫോട്ടോ പിശക്",
    errorSize: "ഫോട്ടോ വളരെ വലുതാണ് (പരമാവധി 8 MB). കുറഞ്ഞ റെസല്യൂഷനിൽ വീണ്ടും എടുക്കുക.",
    errorType: "പിന്തുണയ്‌ക്കാത്ത ഫോർമാറ്റ്. JPEG, PNG, അല്ലെങ്കിൽ WebP ഉപയോഗിക്കുക.",
    errorRead: "ഫോട്ടോ വായിക്കാൻ കഴിഞ്ഞില്ല. വീണ്ടും ശ്രമിക്കുക.",
  },
  gu: {
    primaryLabel: "વિદ્યાર્થીના કાર્યનો ફોટો લો",
    primaryHelper: "કેમેરા ખોલવા માટે ટેપ કરો. હસ્તાક્ષર સ્પષ્ટ, સારી લાઇટિંગ અને પૃષ્ઠ સીધું હોવું જોઈએ.",
    pickFromGallery: "ગેલેરીમાંથી અપલોડ કરો",
    preview: "ફોટો પૂર્વાવલોકન",
    retake: "ફરી લો",
    remove: "દૂર કરો",
    processing: "ફોટો તૈયાર કરી રહ્યું છે…",
    errorTitle: "ફોટો ભૂલ",
    errorSize: "ફોટો ખૂબ મોટો છે (મહત્તમ 8 MB). કૃપા કરીને નીચા રિઝોલ્યુશન પર ફરી લો.",
    errorType: "અસમર્થિત ફોર્મેટ. JPEG, PNG, અથવા WebP નો ઉપયોગ કરો.",
    errorRead: "ફોટો વાંચી શકાયો નથી. કૃપા કરીને ફરી પ્રયાસ કરો.",
  },
  pa: {
    primaryLabel: "ਵਿਦਿਆਰਥੀ ਦੇ ਕੰਮ ਦੀ ਫੋਟੋ ਲਓ",
    primaryHelper: "ਕੈਮਰਾ ਖੋਲ੍ਹਣ ਲਈ ਟੈਪ ਕਰੋ। ਹੱਥ ਲਿਖਤ ਸਾਫ਼, ਚੰਗੀ ਰੋਸ਼ਨੀ ਅਤੇ ਪੰਨਾ ਸਿੱਧਾ ਹੋਣਾ ਚਾਹੀਦਾ ਹੈ।",
    pickFromGallery: "ਗੈਲਰੀ ਤੋਂ ਅੱਪਲੋਡ ਕਰੋ",
    preview: "ਫੋਟੋ ਪ੍ਰੀਵਿਊ",
    retake: "ਦੁਬਾਰਾ ਲਓ",
    remove: "ਹਟਾਓ",
    processing: "ਫੋਟੋ ਤਿਆਰ ਹੋ ਰਹੀ ਹੈ…",
    errorTitle: "ਫੋਟੋ ਗਲਤੀ",
    errorSize: "ਫੋਟੋ ਬਹੁਤ ਵੱਡੀ ਹੈ (ਵੱਧ ਤੋਂ ਵੱਧ 8 MB)। ਘੱਟ ਰੈਜ਼ੋਲਿਊਸ਼ਨ 'ਤੇ ਦੁਬਾਰਾ ਲਓ।",
    errorType: "ਨਾ-ਸਮਰਥਿਤ ਫਾਰਮੈਟ। JPEG, PNG, ਜਾਂ WebP ਵਰਤੋ।",
    errorRead: "ਫੋਟੋ ਪੜ੍ਹੀ ਨਹੀਂ ਜਾ ਸਕੀ। ਕਿਰਪਾ ਕਰਕੇ ਦੁਬਾਰਾ ਕੋਸ਼ਿਸ਼ ਕਰੋ।",
  },
  mr: {
    primaryLabel: "विद्यार्थ्याच्या कामाचा फोटो काढा",
    primaryHelper: "कॅमेरा उघडण्यासाठी टॅप करा. हस्ताक्षर स्पष्ट, चांगल्या प्रकाशात आणि पान सरळ असावे.",
    pickFromGallery: "गॅलरीतून अपलोड करा",
    preview: "फोटो पूर्वावलोकन",
    retake: "पुन्हा काढा",
    remove: "काढून टाका",
    processing: "फोटो तयार होत आहे…",
    errorTitle: "फोटो त्रुटी",
    errorSize: "फोटो खूप मोठा आहे (कमाल 8 MB). कमी रिझोल्यूशनवर पुन्हा काढा.",
    errorType: "असमर्थित स्वरूप. JPEG, PNG, किंवा WebP वापरा.",
    errorRead: "फोटो वाचता आला नाही. कृपया पुन्हा प्रयत्न करा.",
  },
  or: {
    primaryLabel: "ଛାତ୍ରର କାମର ଫଟୋ ନିଅନ୍ତୁ",
    primaryHelper: "କ୍ୟାମେରା ଖୋଲିବାକୁ ଟ୍ୟାପ୍ କରନ୍ତୁ। ହସ୍ତଲେଖା ସ୍ପଷ୍ଟ, ଭଲ ଆଲୋକରେ ଏବଂ ପୃଷ୍ଠା ସିଧା ରଖନ୍ତୁ।",
    pickFromGallery: "ଗ୍ୟାଲେରୀରୁ ଅପଲୋଡ୍ କରନ୍ତୁ",
    preview: "ଫଟୋ ପ୍ରିଭ୍ୟୁ",
    retake: "ପୁନର୍ବାର ନିଅନ୍ତୁ",
    remove: "ହଟାନ୍ତୁ",
    processing: "ଫଟୋ ପ୍ରସ୍ତୁତ ହେଉଛି…",
    errorTitle: "ଫଟୋ ତ୍ରୁଟି",
    errorSize: "ଫଟୋ ବହୁତ ବଡ଼ (ସର୍ବାଧିକ 8 MB)। ଦୟାକରି କମ୍ ରେଜୋଲ୍ୟୁସନରେ ପୁନର୍ବାର ନିଅନ୍ତୁ।",
    errorType: "ଅସମର୍ଥିତ ଫର୍ମାଟ୍। JPEG, PNG, କିମ୍ବା WebP ବ୍ୟବହାର କରନ୍ତୁ।",
    errorRead: "ଫଟୋ ପଢ଼ିହେଲା ନାହିଁ। ଦୟାକରି ପୁନର୍ବାର ଚେଷ୍ଟା କରନ୍ତୁ।",
  },
};

export interface AssessmentCameraProps {
  /** Fires once the photo is ready as a base64 data URI. Empty string clears. */
  onImageReady: (dataUri: string) => void;
  /**
   * UI-language ISO code for the capture-pane chrome
   * (en/hi/bn/ta/te/kn/ml/gu/pa/mr/or). This is interface chrome, so it MUST
   * follow the app UI language (uiLangCode), NOT the selected AI-output
   * language. Caller passes `uiLangCode={LANGUAGE_TO_ISO[language]}`.
   */
  uiLangCode?: string;
  className?: string;
  /** Max file size in bytes. Defaults to 8 MB. */
  maxBytes?: number;
}

const DEFAULT_MAX_BYTES = 8 * 1024 * 1024;
const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp"];

export const AssessmentCamera: FC<AssessmentCameraProps> = ({
  onImageReady,
  uiLangCode = "en",
  className,
  maxBytes = DEFAULT_MAX_BYTES,
}) => {
  const t = translations[uiLangCode] || translations.en;
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);

  async function handleFile(file: File | null) {
    setError(null);
    if (!file) return;
    if (file.size > maxBytes) {
      setError(t.errorSize);
      return;
    }
    if (!ACCEPTED_TYPES.includes(file.type)) {
      setError(t.errorType);
      return;
    }
    setProcessing(true);
    try {
      const dataUri = await fileToOrientedDataUri(file);
      setPreview(dataUri);
      onImageReady(dataUri);
    } catch (err) {
      console.error("[AssessmentCamera] read failed", err);
      setError(t.errorRead);
    } finally {
      setProcessing(false);
    }
  }

  function handleRemove() {
    setPreview(null);
    setError(null);
    onImageReady("");
    if (cameraInputRef.current) cameraInputRef.current.value = "";
    if (galleryInputRef.current) galleryInputRef.current.value = "";
  }

  return (
    <div className={cn("w-full space-y-4", className)}>
      {preview ? (
        <div className="w-full relative group rounded-surface-lg overflow-hidden border border-border bg-muted/30">
          <Image
            src={preview}
            alt={t.preview}
            width={1200}
            height={1200}
            className={cn(
              "w-full h-auto max-h-[60vh] object-contain",
              processing && "opacity-60",
            )}
            unoptimized
          />
          {processing && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/30">
              <Loader2 className="h-10 w-10 animate-spin text-white" />
            </div>
          )}
          <div className="absolute top-3 right-3 flex items-center gap-2">
            <Button
              size="sm"
              variant="secondary"
              onClick={() => cameraInputRef.current?.click()}
              className="shadow-md"
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              {t.retake}
            </Button>
            <Button
              size="icon"
              variant="destructive"
              onClick={handleRemove}
              aria-label={t.remove}
              className="shadow-md"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <button
            type="button"
            onClick={() => cameraInputRef.current?.click()}
            disabled={processing}
            className={cn(
              "w-full min-h-[160px] sm:min-h-[200px] flex flex-col items-center justify-center gap-3",
              "rounded-surface-lg border-2 border-dashed border-primary/40 bg-primary/5",
              "hover:border-primary hover:bg-primary/10 transition-colors",
              "focus:outline-none focus:ring-2 focus:ring-primary/40 focus:ring-offset-2",
              processing && "opacity-60 cursor-wait",
            )}
          >
            <Camera className="h-10 w-10 sm:h-12 sm:w-12 text-primary" />
            <div className="text-center px-4">
              <p className="text-base sm:text-lg font-headline font-semibold text-foreground">
                {t.primaryLabel}
              </p>
              <p className="text-xs sm:text-sm text-muted-foreground mt-1 max-w-md mx-auto">
                {t.primaryHelper}
              </p>
            </div>
          </button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => galleryInputRef.current?.click()}
            disabled={processing}
            className="w-full text-muted-foreground"
          >
            <ImageIcon className="mr-2 h-4 w-4" />
            {t.pickFromGallery}
          </Button>
        </div>
      )}

      {processing && !preview && (
        <p className="text-xs text-muted-foreground flex items-center gap-2 justify-center">
          <Loader2 className="h-4 w-4 animate-spin" />
          {t.processing}
        </p>
      )}

      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => handleFile(e.target.files?.[0] || null)}
      />
      <input
        ref={galleryInputRef}
        type="file"
        accept={ACCEPTED_TYPES.join(",")}
        className="hidden"
        onChange={(e) => handleFile(e.target.files?.[0] || null)}
      />

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>{t.errorTitle}</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
    </div>
  );
};

/**
 * Read a File and return a base64 data URI. Best-effort EXIF orientation fix
 * via canvas redraw — modern browsers do this automatically when drawing an
 * Image to canvas with `imageOrientation: 'from-image'` (createImageBitmap
 * option), so on iOS Safari 13.4+ / Chrome / Firefox the photo is rotated
 * correctly without any extra library.
 *
 * Falls back to raw FileReader when canvas / createImageBitmap is unavailable
 * (Safari < 14 in private mode etc.).
 */
async function fileToOrientedDataUri(file: File): Promise<string> {
  // Fast path — try createImageBitmap with orientation correction. This is the
  // simplest cross-browser EXIF fix; the canvas redraw also caps the long edge
  // at 1600px to keep the payload to the API under the model's preferred size.
  try {
    if (typeof createImageBitmap === "function") {
      const bitmap = await createImageBitmap(file, {
        imageOrientation: "from-image",
      } as ImageBitmapOptions);
      const MAX_EDGE = 1600;
      const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
      const w = Math.round(bitmap.width * scale);
      const h = Math.round(bitmap.height * scale);
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("canvas-2d-unavailable");
      ctx.drawImage(bitmap, 0, 0, w, h);
      bitmap.close?.();
      // Encode as JPEG at q=0.9 — keeps handwriting detail while shrinking the
      // payload. WebP would be smaller but Gemini accepts JPEG natively.
      return canvas.toDataURL("image/jpeg", 0.9);
    }
  } catch (err) {
    // Fall through to FileReader path below.
    console.warn("[AssessmentCamera] createImageBitmap path failed, falling back", err);
  }

  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error || new Error("read-failed"));
    reader.onload = () => resolve(String(reader.result || ""));
    reader.readAsDataURL(file);
  });
}
