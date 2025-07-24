
"use client";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Image as ImageIcon, UploadCloud, X, AlertCircle } from "lucide-react";
import Image from "next/image";
import { useState, type FC, useRef } from "react";

type ImageUploaderProps = {
  onImageUpload: (dataUri: string) => void;
  className?: string;
  language?: string;
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
    },
    // Add other languages as needed...
};


export const ImageUploader: FC<ImageUploaderProps> = ({ onImageUpload, className, language = 'en' }) => {
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const t = translations[language] || translations.en;

  const handleFileChange = (file: File | null) => {
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

    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUri = e.target?.result as string;
      setPreview(dataUri);
      onImageUpload(dataUri);
    };
    reader.onerror = () => {
        setError(t.errorRead);
    }
    reader.readAsDataURL(file);
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
    onImageUpload("");
    if(fileInputRef.current) {
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
            className="w-full h-auto max-h-[400px] object-contain rounded-lg border-2 border-dashed border-border"
          />
          <div className="absolute top-2 right-2 flex items-center gap-2">
            <Button variant="secondary" size="sm" onClick={() => fileInputRef.current?.click()}>
              <UploadCloud className="mr-2 h-4 w-4" />
              {t.change}
            </Button>
            <Button variant="destructive" size="icon" onClick={handleRemoveImage}>
                <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      ) : (
        <div
            className="w-full h-48 border-2 border-dashed border-border rounded-lg flex flex-col justify-center items-center text-center p-4 cursor-pointer hover:border-primary transition-colors"
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
        >
          <UploadCloud className="h-10 w-10 text-muted-foreground mb-2" />
          <p className="text-muted-foreground">
            {t.dragDrop}{' '}
            <span className="font-semibold text-primary">{t.browse}</span>
          </p>
          <p className="text-xs text-muted-foreground mt-1">PNG, JPG, WEBP up to 4MB</p>
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
