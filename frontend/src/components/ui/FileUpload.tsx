// src/components/ui/FileUpload.tsx
"use client";

import React, { useState, useEffect } from "react";
import { X, UploadCloud, FileText, ExternalLink } from "lucide-react";
import { FormLabel } from "./form/form-label";
import { LoadingSpinner } from "./LoadingSpinner";
import { logger } from "@/lib/logger";
import { toast } from "@/stores/toast.store";

interface FileUploadProps {
  name: string;
  label?: string;
  accept?: string;
  disabled?: boolean;
  /**
   * Mark this upload as required. Shows a red asterisk on the label and
   * displays an error message if the user tries to submit without uploading.
   */
  required?: boolean;
  /**
   * When set to true, immediately show the required-empty error even if the
   * user has never interacted with this field. Useful for triggering validation
   * on form submit when the field is still empty.
   */
  forceValidate?: boolean;
  /**
   * Called when upload succeeds. Passes the uploaded image URL and its publicId.
   */
  onUpload: (payload: { url: string; publicId: string }) => void;
  onUploadingChange?: (uploading: boolean) => void;
  /**
   * Called when the file is removed.
   */
  onRemove?: () => void;
  /** Initial URL for preview (e.g. when editing) */
  initialUrl?: string;
  /** Initial publicId (e.g. when editing) */
  initialPublicId?: string;
  error?: string | null;
  description?: string;
  /** Cloudinary folder to group the uploaded asset (e.g. "lembaga-logos") */
  folder?: string;
  /** Optional external AbortController ref to allow parent to cancel upload */
  abortRef?: React.MutableRefObject<AbortController | null>;
}

export const FileUpload: React.FC<FileUploadProps> = ({
  name,
  label = "Upload",
  accept = "image/png, image/jpeg",
  disabled = false,
  required = false,
  forceValidate = false,
  onUpload,
  onUploadingChange,
  onRemove,
  initialUrl = "",
  initialPublicId = "",
  error = null,
  description = "",
  folder,
  abortRef,
}) => {
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string>(initialUrl);
  const [currentPublicId, setCurrentPublicId] = useState<string>(initialPublicId);
  // Track whether the current file is a PDF (for preview rendering)
  const [isPdf, setIsPdf] = useState<boolean>(
    initialUrl
      ? /\.pdf($|\?)/i.test(initialUrl) || initialUrl.includes("/raw/upload/")
      : false
  );
  // Show required-empty error after first interaction (remove or external error)
  const [touched, setTouched] = useState(false);
  const hasFile = Boolean(previewUrl);

  // Sync state if initial values change
  useEffect(() => {
    if (initialUrl) setPreviewUrl(initialUrl);
    if (initialPublicId) setCurrentPublicId(initialPublicId);
  }, [initialUrl, initialPublicId]);

  // Use external abortRef if provided, otherwise internal one
  const internalAbortRef = React.useRef<AbortController | null>(null);
  const abortControllerRef = abortRef ?? internalAbortRef;

  const handleChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const fileIsPdf = file.type === "application/pdf";
    if (file.size > 10 * 1024 * 1024) {
      toast.error("Gagal mengunggah: File terlalu besar. Maksimum 10 MB.");
      logger.error("File terlalu besar. Maksimum 10 MB.");
      // Reset the file input so it can trigger again
      e.target.value = "";
      return;
    }
    // abort any previous upload
    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;
    setUploading(true);
    onUploadingChange?.(true);

    // Keep track of the newly-uploaded file we need to clean up if this upload succeeds
    const oldPublicIdToDelete = (currentPublicId && currentPublicId !== initialPublicId) ? currentPublicId : null;

    logger.info({
      currentPublicId,
      initialPublicId,
      oldPublicIdToDelete
    }, "FileUpload handleChange: Upload starting");

    try {
      // use uploadService to handle Cloudinary upload
      const { handleUpload: upload } = await import("@/lib/upload/uploadService");
      const result = await upload(file, { folder });

      logger.info({ result }, "FileUpload handleChange: Upload succeeded");

      // If the new upload succeeded, delete the previous newly-uploaded file from Cloudinary
      if (oldPublicIdToDelete) {
        logger.info({ oldPublicIdToDelete }, "FileUpload handleChange: Deleting replaced temporary file");
        try {
          const { deleteFile } = await import("@/lib/upload/uploadService");
          await deleteFile(oldPublicIdToDelete);
          logger.info("FileUpload handleChange: Successfully deleted replaced temporary file");
        } catch (delErr) {
          logger.error({ err: delErr }, "FileUpload handleChange: Gagal menghapus file lama yang ditimpa");
        }
      }

      setPreviewUrl(result.url);
      setCurrentPublicId(result.publicId);
      setIsPdf(fileIsPdf);
      setTouched(true);
      onUpload({ url: result.url, publicId: result.publicId });
    } catch (err: any) {
      if (err.name === "AbortError") {
        logger.info("FileUpload handleChange: Upload dibatalkan");
      } else {
        logger.error({ err }, "FileUpload handleChange error");
        toast.error(
          err instanceof Error
            ? `Gagal mengunggah: ${err.message}`
            : "Gagal mengunggah file. Pastikan format valid dan koneksi stabil.",
        );
      }
    } finally {
      setUploading(false);
      onUploadingChange?.(false);
      abortControllerRef.current = null;
    }
  };

  const handleRemove = async () => {
    // If it's a newly uploaded file in this session, delete it from Cloudinary
    const isNewUpload = currentPublicId && currentPublicId !== initialPublicId;
    if (isNewUpload) {
      setDeleting(true);
      try {
        const { deleteFile } = await import("@/lib/upload/uploadService");
        await deleteFile(currentPublicId);
      } catch (err) {
        logger.error({ err }, "FileUpload handleRemove: Gagal menghapus file dari Cloudinary");
      } finally {
        setDeleting(false);
      }
    }

    setPreviewUrl("");
    setCurrentPublicId("");
    setIsPdf(false);
    setTouched(true); // mark touched so required error shows
    onRemove?.();

    // Reset file input value so user can upload the same file again if desired
    const fileInput = document.getElementById(name) as HTMLInputElement;
    if (fileInput) fileInput.value = "";
  };

  // Derived: show required-empty error when touched, force-validated, or external error forces it
  const requiredError = required && !hasFile && (touched || forceValidate || Boolean(error))
    ? "File ini wajib diupload"
    : null;
  const displayError = error || requiredError;
  const isInvalid = Boolean(displayError);

  return (
    <div className="space-y-1.5 w-full">
      <FormLabel htmlFor={name}>
        {label}
        {required && <span className="ml-1 text-destructive" aria-hidden="true">*</span>}
      </FormLabel>
      <div className={`relative flex flex-col items-center justify-center w-full min-h-[140px] border-2 border-dashed rounded-xl bg-surface/50 hover:bg-surface-muted transition-colors focus-within:ring-2 focus-within:ring-brand-primary/30 focus-within:border-brand-primary group ${
        isInvalid ? "border-destructive/70 bg-destructive/5" : "border-border/60"
      }`}>
        <input
          id={name}
          name={name}
          type="file"
          accept={accept}
          disabled={disabled || uploading || deleting}
          onChange={handleChange}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed z-10"
        />
        <div className="flex flex-col items-center justify-center p-6 text-center text-muted group-hover:text-primary transition-colors pointer-events-none">
          <UploadCloud className="w-8 h-8 mb-3 opacity-70 group-hover:opacity-100 group-hover:scale-110 transition-all duration-200" strokeWidth={1.5} />
          <p className="text-sm font-semibold mb-1">Pilih atau seret file ke sini</p>
          <p className="text-[11px] opacity-70">Maks. 10 MB &bull; {accept.replace(/image\//g, '').replace(/application\//g, '').toUpperCase().replace(/,\s*/g, ', ')}</p>
        </div>
      </div>

      {uploading && (
        <div className="mt-3">
          <p className="text-sm font-semibold text-primary mb-2">Pratinjau:</p>
          <div className="h-24 w-24 rounded-xl border border-border/40 bg-surface-soft animate-pulse flex items-center justify-center">
            <LoadingSpinner size="sm" className="border-t-brand-primary" />
          </div>
        </div>
      )}

      {previewUrl && !uploading && (
        <div className="mt-3">
          <p className="text-sm font-semibold text-primary mb-2">Pratinjau:</p>
          <div className={`relative rounded-xl border border-border/40 bg-surface-soft shadow-sm overflow-visible flex items-center justify-center group hover:shadow-md transition-all duration-200 ${
            isPdf ? "w-full p-3" : "w-24 h-24 p-1.5"
          }`}>
            {isPdf ? (
              /* PDF preview */
              <div className={`flex items-center gap-3 w-full ${deleting ? "opacity-40" : ""}` }>
                <div className="flex-shrink-0 w-10 h-10 bg-red-50 rounded-lg flex items-center justify-center">
                  <FileText className="w-6 h-6 text-red-500" strokeWidth={1.5} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-primary truncate">File PDF</p>
                  <a
                    href={previewUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[11px] text-brand-primary hover:underline flex items-center gap-1 mt-0.5"
                  >
                    <ExternalLink className="w-3 h-3" />
                    Buka / Lihat PDF
                  </a>
                </div>
              </div>
            ) : (
              /* Image preview */
              <img
                src={previewUrl}
                alt="Preview"
                className={`max-w-full max-h-full object-contain rounded-lg ${
                  deleting ? "opacity-40" : ""
                }`}
              />
            )}
            {deleting ? (
              <div className="absolute inset-0 flex items-center justify-center bg-surface/70 rounded-xl">
                <LoadingSpinner size="sm" className="border-t-destructive" />
              </div>
            ) : (
              <button
                type="button"
                onClick={handleRemove}
                disabled={disabled || uploading || deleting}
                className="absolute -top-2.5 -right-2.5 bg-destructive hover:bg-destructive/95 text-white rounded-full p-1 shadow-md hover:scale-110 active:scale-95 transition-all duration-150 disabled:opacity-50 disabled:scale-100 flex items-center justify-center cursor-pointer z-10"
                title="Batalkan & Hapus file"
              >
                <X className="w-3.5 h-3.5" strokeWidth={2.5} />
              </button>
            )}
          </div>
        </div>
      )}
      {description && (
        <p className="text-[11px] text-muted leading-tight mt-1">{description}</p>
      )}
      {displayError && (
        <p className="text-sm text-destructive mt-1">{displayError}</p>
      )}
    </div>
  );
};
