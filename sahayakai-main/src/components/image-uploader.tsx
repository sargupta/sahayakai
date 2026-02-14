"use client";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { UploadCloud, X, AlertCircle, Loader2 } from "lucide-react";
import Image from "next/image";
import { useState, type FC, useRef } from "react";
import { storage, auth } from "@/lib/firebase";
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { v4 as uuidv4 } from "uuid";

type ImageUploaderProps = {
  onImageUpload: (url: string) => void;
  className?: string;
  language?: string;
  compact?: boolean;
};

const MAX_FILE_SIZE = 4 * 1024 * 1024; // 4MB

const translations: Record<string, Record<string, string>> = {
  en: {
    title: "Upload Textbook Page",
    dragDrop: "Drag & drop here or",
    browse: "browse",
    preview: "Image Preview",
    change: "Change",
    errorTitle: "Upload Error",
    errorSize: "File is too large. Please upload an image under 4MB.",
    errorType: "Invalid file type. Please upload a JPEG, PNG, or WEBP image.",
    errorRead: "Could not read the file. Please try again.",
    uploading: "Uploading...",
    errorUpload: "Failed to upload image. Please try again.",
  },
  hi: {
    title: "पाठ्यपुस्तक पृष्ठ अपलोड करें",
    dragDrop: "यहां खींचें और छोड़ें या",
    browse: "ब्राउज़ करें",
    preview: "छवि पूर्वावलोकन",
    change: "बदलें",
    errorTitle: "अपलोड त्रुटि",
    errorSize: "फ़ाइल बहुत बड़ी है। कृपया 4MB से कम की छवि अपलोड करें।",
    errorType: "अमान्य फ़ाइल प्रकार। कृपया एक JPEG, PNG, या WEBP छवि अपलोड करें।",
    errorRead: "फ़ाइल पढ़ी नहीं जा सकी। कृपया पुनः प्रयास करें।",
    uploading: "अपलोड हो रहा है...",
    errorUpload: "छवि अपलोड करने में विफल। कृपया पुन: प्रयास करें।",
  },
  bn: {
    title: "পাঠ্যপুস্তকের পৃষ্ঠা আপলোড করুন",
    dragDrop: "এখানে টেনে আনুন বা",
    browse: "ব্রাউজ করুন",
    preview: "ছবির প্রিভিউ",
    change: "পরিবর্তন করুন",
    errorTitle: "আপলোড ত্রুটি",
    errorSize: "ফাইলটি খুব বড়। অনুগ্রহ করে 4MB এর কম ছবি আপলোড করুন।",
    errorType: "অবৈধ ফাইলের প্রকার। অনুগ্রহ করে একটি JPEG, PNG, বা WEBP ছবি আপলোড করুন।",
    errorRead: "ফাইলটি পড়া যায়নি। অনুগ্রহ করে আবার চেষ্টা করুন।",
    uploading: "আপলোড হচ্ছে...",
    errorUpload: "ছবি আপলোড করতে ব্যর্থ হয়েছে। অনুগ্রহ করে আবার চেষ্টা করুন।",
  },
  te: {
    title: "పాఠ్యపుస్తకం పేజీని అప్‌లోడ్ చేయండి",
    dragDrop: "ఇక్కడ లాగండి మరియు వదలండి లేదా",
    browse: "బ్రౌజ్ చేయండి",
    preview: "చిత్ర పరిదృశ్యం",
    change: "మార్చండి",
    errorTitle: "అప్‌లోడ్ లోపం",
    errorSize: "ఫైల్ చాలా పెద్దది। దయచేసి 4MB కంటే తక్కువ చిత్రాన్ని అప్‌లోడ్ చేయండి।",
    errorType: "చెల్లని ఫైల్ రకం। దయచేసి ఒక JPEG, PNG, లేదా WEBP చిత్రాన్ని అప్‌లోడ్ చేయండి।",
    errorRead: "ఫైల్ చదవబడలేదు। దయచేసి మళ్లీ ప్రయత్నించండి।",
    uploading: "అప్‌లోడ్ అవుతోంది...",
    errorUpload: "చిత్రాన్ని అప్‌లోడ్ చేయడంలో విఫలమైంది। దయచేసి మళ్లీ ప్రయత్నించండి।",
  },
  mr: {
    title: "पाठ्यपुस्तक पृष्ठ अपलोड करा",
    dragDrop: "येथे ड्रॅग आणि ड्रॉप करा किंवा",
    browse: "ब्राउझ करा",
    preview: "प्रतिमा पूर्वावलोकन",
    change: "बदला",
    errorTitle: "अपलोड त्रुटी",
    errorSize: "फाइल खूप मोठी आहे. कृपया 4MB पेक्षा कमी आकाराची प्रतिमा अपलोड करा.",
    errorType: "अवैध फाइल प्रकार. कृपया JPEG, PNG, किंवा WEBP प्रतिमा अपलोड करा.",
    errorRead: "फाइल वाचता आली नाही. कृपया पुन्हा प्रयत्न करा.",
    uploading: "अपलोड होत आहे...",
    errorUpload: "प्रतिमा अपलोड करण्यात अयशस्वी. कृपया पुन्हा प्रयत्न करा.",
  },
  ta: {
    title: "பாடநூல் பக்கத்தை பதிவேற்றவும்",
    dragDrop: "இங்கே இழுத்து விடுங்கள் அல்லது",
    browse: "உலாவுக",
    preview: "படத்தின் முன்னோட்டம்",
    change: "மாற்றவும்",
    errorTitle: "பதிவேற்ற பிழை",
    errorSize: "கோப்பு மிகவும் பெரியது. தயவுசெய்து 4MB க்கு கீழ் ஒரு படத்தை பதிவேற்றவும்.",
    errorType: "தவறான கோப்பு வகை. தயவுசெய்து ஒரு JPEG, PNG, அல்லது WEBP படத்தை பதிவேற்றவும்.",
    errorRead: "கோப்பை படிக்க முடியவில்லை. தயவுசெய்து மீண்டும் முயற்சிக்கவும்.",
    uploading: "பதிவேற்றுகிறது...",
    errorUpload: "படத்தை பதிவேற்ற முடியவில்லை. மீண்டும் முயற்சிக்கவும்.",
  },
  gu: {
    title: "પાઠ્યપુસ્તક પૃષ્ઠ અપલોડ કરો",
    dragDrop: "અહીં ખેંચો અને છોડો અથવા",
    browse: "બ્રાઉઝ કરો",
    preview: "છબી પૂર્વાવલોકન",
    change: "બદલો",
    errorTitle: "અપલોડ ભૂલ",
    errorSize: "ફાઇલ ખૂબ મોટી છે. કૃપા કરીને 4MB થી ઓછી છબી અપલોડ કરો.",
    errorType: "અમાન્ય ફાઇલ પ્રકાર. કૃપા કરીને JPEG, PNG, અથવા WEBP છબી અપલોડ કરો.",
    errorRead: "ફાઇલ વાંચી શકાઈ નથી. કૃપા કરીને ફરી પ્રયાસ કરો.",
    uploading: "અપલોડ થઈ રહ્યું છે...",
    errorUpload: "છબી અપલોડ કરવામાં નિષ્ફળ. કૃપા કરીને ફરી પ્રયાસ કરો.",
  },
  kn: {
    title: "ಪಠ್ಯಪುಸ್ತಕ ಪುಟವನ್ನು ಅಪ್‌ಲೋಡ್ ಮಾಡಿ",
    dragDrop: "ಇಲ್ಲಿ ಎಳೆದು ಬಿಡಿ ಅಥವಾ",
    browse: "ಬ್ರೌಸ್ ಮಾಡಿ",
    preview: "ಚಿತ್ರ ಪೂರ್ವವೀಕ್ಷಣೆ",
    change: "ಬದಲಾಯಿಸಿ",
    errorTitle: "ಅಪ್‌ಲೋಡ್ ದೋಷ",
    errorSize: "ಫೈಲ್ ತುಂಬಾ ದೊಡ್ಡದಾಗಿದೆ. ದಯವಿಟ್ಟು 4MB ಗಿಂತ ಕಡಿಮೆ ಇರುವ ಚಿತ್ರವನ್ನು ಅಪ್‌ಲೋಡ್ ಮಾಡಿ.",
    errorType: "ಅಮಾನ್ಯ ಫೈಲ್ ಪ್ರಕಾರ. ದಯವಿಟ್ಟು JPEG, PNG, ಅಥವಾ WEBP ಚಿತ್ರವನ್ನು ಅಪ್‌ಲೋಡ್ ಮಾಡಿ.",
    errorRead: "ಫೈಲ್ ಓದಲಾಗಲಿಲ್ಲ. ದಯವಿಟ್ಟು ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ.",
    uploading: "ಅಪ್‌ಲೋಡ್ ಆಗುತ್ತಿದೆ...",
    errorUpload: "ಚಿತ್ರ ಅಪ್‌ಲೋಡ್ ವಿಫಲವಾಗಿದೆ. ದಯವಿಟ್ಟು ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ.",
  },
};


export const ImageUploader: FC<ImageUploaderProps> = ({ onImageUpload, className, language = 'en', compact = false }) => {
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const t = translations[language] || translations.en;

  const handleFileChange = async (file: File | null) => {
    if (!file) return;

    setError(null);

    if (file.size > MAX_FILE_SIZE) {
      setError(t.errorSize);
      return;
    }

    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setError(t.errorType);
      return;
    }

    // Show local preview immediately
    const objectUrl = URL.createObjectURL(file);
    setPreview(objectUrl);

    // Start Upload
    setIsUploading(true);
    setUploadProgress(0);

    try {
      const user = auth.currentUser;
      const uid = user ? user.uid : 'anonymous';
      const storagePath = `users/${uid}/uploads/${uuidv4()}_${file.name}`;
      const storageRef = ref(storage, storagePath);

      const uploadTask = uploadBytesResumable(storageRef, file);

      uploadTask.on('state_changed',
        (snapshot) => {
          const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          setUploadProgress(progress);
        },
        (error) => {
          console.error("Upload failed", error);
          setError(t.errorUpload);
          setIsUploading(false);
          // Don't clear preview immediately, let user see error
        },
        async () => {
          const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
          setIsUploading(false);
          onImageUpload(downloadURL);
        }
      );

    } catch (err: any) {
      console.error("Upload error", err);
      setError(t.errorUpload);
      setIsUploading(false);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    const file = e.dataTransfer.files[0];
    handleFileChange(file);
  };

  const handleRemoveImage = () => {
    setPreview(null);
    setError(null);
    setIsUploading(false);
    onImageUpload("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  return (
    <div className={cn("w-full space-y-4", className)}>
      {preview ? (
        <div className="w-full relative group">
          <Image
            src={preview}
            alt={t.preview}
            width={400}
            height={400}
            className={cn(
              "w-full h-auto max-h-[400px] object-contain rounded-lg border-2 border-dashed border-border",
              isUploading && "opacity-50"
            )}
          />

          {isUploading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/20 rounded-lg">
              <Loader2 className="h-8 w-8 animate-spin text-white mb-2" />
              <span className="text-white text-sm font-medium">{Math.round(uploadProgress)}%</span>
            </div>
          )}

          {!isUploading && (
            <div className="absolute top-2 right-2 flex items-center gap-2">
              <Button variant="secondary" size="sm" onClick={() => fileInputRef.current?.click()}>
                <UploadCloud className="mr-2 h-4 w-4" />
                {t.change}
              </Button>
              <Button variant="destructive" size="icon" onClick={handleRemoveImage}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      ) : (
        <div
          className={cn(
            "w-full border-2 border-dashed border-border rounded-lg flex justify-center items-center text-center cursor-pointer hover:border-primary transition-colors",
            compact ? "h-14 p-1 flex-row gap-2" : "h-32 flex-col p-4"
          )}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <UploadCloud className={cn("text-muted-foreground", compact ? "h-5 w-5" : "h-10 w-10 mb-2")} />
          <p className={cn("text-muted-foreground", compact ? "text-xs" : "text-sm")}>
            {compact ? (
              <span>{t.dragDrop} <span className="font-semibold text-primary">{t.browse}</span></span>
            ) : (
              <>
                {t.dragDrop}{' '}
                <span className="font-semibold text-primary">{t.browse}</span>
              </>
            )}
          </p>
        </div>
      )}

      <input
        type="file"
        ref={fileInputRef}
        className="hidden"
        accept="image/png, image/jpeg, image/webp"
        onChange={(e) => handleFileChange(e.target.files?.[0] || null)}
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
