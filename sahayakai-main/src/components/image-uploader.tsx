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
import { useLanguage } from "@/context/language-context";

type ImageUploaderProps = {
  onImageUpload: (url: string) => void;
  className?: string;
  language?: string; // legacy prop kept for backwards compat — not used anymore
  compact?: boolean;
};

const MAX_FILE_SIZE = 4 * 1024 * 1024; // 4MB

// Local `translations` removed (Wave 6 cleanup). All strings now via global useLanguage().
export const ImageUploader: FC<ImageUploaderProps> = ({ onImageUpload, className, compact = false }) => {
  const { t: translate } = useLanguage();
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (file: File | null) => {
    if (!file) return;

    setError(null);

    if (file.size > MAX_FILE_SIZE) {
      setError(translate("File is too large. Please upload an image under 4MB."));
      return;
    }

    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setError(translate("Invalid file type. Please upload a JPEG, PNG, or WEBP image."));
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
          setError(translate("Failed to upload image. Please try again."));
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
      setError(translate("Failed to upload image. Please try again."));
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
            alt={translate("Image Preview")}
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
                {translate("Change")}
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
              <span>{translate("Drag & drop here or")} <span className="font-semibold text-primary">{translate("browse")}</span></span>
            ) : (
              <>
                {translate("Drag & drop here or")}{' '}
                <span className="font-semibold text-primary">{translate("browse")}</span>
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
          <AlertTitle>{translate("Upload Error")}</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
    </div>
  );
};
