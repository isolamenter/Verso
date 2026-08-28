import { useState, useRef } from "react";
import { useI18n } from "../../../i18n";

export interface AssetUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUpload: (file: File) => Promise<void>;
}

export function AssetUploadModal({
  isOpen,
  onClose,
  onUpload,
}: AssetUploadModalProps) {
  const { t } = useI18n();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  if (!isOpen) return null;

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setSelectedFile(e.dataTransfer.files[0]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) return;

    setIsUploading(true);
    try {
      await onUpload(selectedFile);
      onClose();
    } finally {
      setIsUploading(false);
      setSelectedFile(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 backdrop-blur-xs p-4 font-serif">
      <div className="bg-paper border border-ink-muted/25 rounded-lg shadow-xl max-w-md w-full p-6 animate-scale-in space-y-4">
        <div className="flex items-center justify-between border-b border-ink-muted/15 pb-3">
          <h3 className="text-sm font-semibold text-ink">{t("knowledge.uploadModalTitle")}</h3>
          <button onClick={onClose} className="text-ink-muted hover:text-ink text-xs p-1">
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          {/* Dropzone */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleFileDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
              dragOver
                ? "border-cinnabar bg-cinnabar/5"
                : "border-ink-muted/30 hover:border-ink-muted/60 bg-paper-light"
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              accept="image/*,audio/*,video/*,text/*,.pdf,.md,.txt,.doc,.docx"
              onChange={(e) => {
                if (e.target.files && e.target.files[0]) {
                  setSelectedFile(e.target.files[0]);
                }
              }}
            />

            <div className="space-y-1">
              <div className="text-2xl">📁</div>
              <p className="text-xs text-ink font-medium">
                {selectedFile ? selectedFile.name : t("knowledge.uploadDragHint")}
              </p>
              <p className="text-[10px] text-ink-muted">
                {t("knowledge.uploadSupportedFormats")}
              </p>
            </div>
          </div>

          {selectedFile && (
            <div className="p-2.5 bg-paper-light border border-ink-muted/20 rounded text-[11px] text-ink-muted flex items-center justify-between">
              <span>{t("knowledge.uploadFileSize", { size: (selectedFile.size / 1024).toFixed(1) })}</span>
              <span>{t("knowledge.uploadFileType", { type: selectedFile.type || t("knowledge.uploadUnknownType") })}</span>
            </div>
          )}

          <div className="flex items-center justify-end space-x-2 pt-2 border-t border-ink-muted/15">
            <button
              type="button"
              onClick={onClose}
              disabled={isUploading}
              className="px-4 py-2 border border-ink-muted/20 rounded text-ink-muted hover:text-ink transition-colors"
            >
              {t("common.cancel")}
            </button>
            <button
              type="submit"
              disabled={isUploading || !selectedFile}
              className="px-4 py-2 bg-ink text-paper rounded font-medium hover:bg-ink/90 disabled:opacity-40 transition-colors shadow-xs"
            >
              {isUploading ? t("knowledge.uploading") : t("knowledge.confirmUpload")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

