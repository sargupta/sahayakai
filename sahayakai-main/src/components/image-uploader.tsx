"use client";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { UploadCloud, X, AlertCircle, Loader2 } from "lucide-react";
import Image from "next/image";
import { useState, type FC, useRef, useEffect } from "react";
import { storage, auth } from "@/lib/firebase";
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { v4 as uuidv4 } from "uuid";
import { useLanguage } from "@/context/language-context";

type ImageUploaderProps = {
  onImageUpload: (url: string) => void;
  className?: string;
  /**
   * Legacy prop — NOT consumed by this component. Still declared because other
   * pages (quiz-generator, worksheet-wizard, community, lesson-plan) pass it;
   * removing it is a cross-cutting cleanup outside the assessment-scanner scope.
   */
  language?: string;
  compact?: boolean;
  onAuthRequired?: () => void;
  maxImageDimension?: number;
  /**
   * Opt-in: when provided, the drop zone / browse dialog ALSO accepts a PDF and
   * hands the raw File to this callback (instead of the image path). The caller
   * is responsible for turning it into images. Pages that don't pass this keep
   * image-only behaviour unchanged.
   */
  onPdfSelected?: (file: File) => void;
};

const MAX_FILE_SIZE = 4 * 1024 * 1024;
const DOWNSCALE_QUALITY = 0.92;

function fileToDataUri(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

async function downscaleImage(
  file: File,
  maxDimension: number,
  quality = DOWNSCALE_QUALITY,
): Promise<File> {
  const dataUri = await fileToDataUri(file);
  const img = document.createElement("img");
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error("image decode failed"));
    img.src = dataUri;
  });

  const longest = Math.max(img.naturalWidth, img.naturalHeight);
  if (longest <= maxDimension) return file;

  const scale = maxDimension / longest;
  const width = Math.round(img.naturalWidth * scale);
  const height = Math.round(img.naturalHeight * scale);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return file;
  ctx.fillStyle = "#ffffff"; // design-token-allow: canvas fillStyle needs a literal color, not a Tailwind token
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(img, 0, 0, width, height);

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", quality),
  );
  if (!blob) return file;

  const jpgName = file.name.replace(/\.[^./\\]+$/, "") + ".jpg";
  return new File([blob], jpgName, { type: "image/jpeg" });
}

// Local `translations` removed (Wave 6 cleanup). All strings now via global useLanguage().
export const ImageUploader: FC<ImageUploaderProps> = ({ onImageUpload, className, compact = false, onAuthRequired, maxImageDimension, onPdfSelected }) => {
  const { t: translate } = useLanguage();
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Revoke the local object URL when the preview changes or the component
  // unmounts, so the blob doesn't linger for the page's lifetime. The parent
  // remounts this uploader (key change) after each successful add, so without
  // this every upload would orphan one blob URL.
  useEffect(() => {
    if (!preview || !preview.startsWith("blob:")) return;
    return () => URL.revokeObjectURL(preview);
  }, [preview]);

  const handleFileChange = async (inputFile: File | null) => {
    if (!inputFile) return;

    setError(null);

    // Opt-in PDF path: hand the raw file to the caller (which renders it to page
    // images) and skip the single-image upload flow entirely.
    if (onPdfSelected && inputFile.type === 'application/pdf') {
      onPdfSelected(inputFile);
      return;
    }

    if (!['image/jpeg', 'image/png', 'image/webp'].includes(inputFile.type)) {
      setError(
        onPdfSelected
          ? translate("Invalid file type. Please upload a JPEG, PNG, WEBP image or a PDF.")
          : translate("Invalid file type. Please upload a JPEG, PNG, or WEBP image."),
      );
      return;
    }

    // Downscale oversized photos before anything else (opt-in via
    // maxImageDimension). Falls back to the original on any decode failure so a
    // quirky image never blocks the upload. The size gate below runs on the
    // RESULT, so a large original is fine as long as the downscaled file fits.
    let file = inputFile;
    if (maxImageDimension) {
      try {
        file = await downscaleImage(inputFile, maxImageDimension);
      } catch {
        file = inputFile;
      }
    }

    if (file.size > MAX_FILE_SIZE) {
      setError(translate("File is too large. Please upload an image under 4MB."));
      return;
    }

    // Auth gate — Storage rules (storage.rules) reject any write without an
    // authenticated owner. The old `uid = user ? user.uid : 'anonymous'`
    // fallback produced a `users/anonymous/…` path that was ALWAYS denied
    // (silently, as a torn-down request), so we must have a real user first.
    // Prompt sign-in and bail rather than fire a doomed upload.
    const user = auth.currentUser;
    if (!user) {
      setError(translate("Please sign in to upload an image."));
      onAuthRequired?.();
      return;
    }

    // Show local preview immediately
    const objectUrl = URL.createObjectURL(file);
    setPreview(objectUrl);

    // Start Upload
    setIsUploading(true);
    setUploadProgress(0);

    try {
      const storagePath = `users/${user.uid}/uploads/${uuidv4()}_${file.name}`;
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
        accept={
          onPdfSelected
            ? "image/png, image/jpeg, image/webp, application/pdf"
            : "image/png, image/jpeg, image/webp"
        }
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
