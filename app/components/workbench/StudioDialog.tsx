import { useEffect, useRef, type ReactNode } from "react";
import { X } from "lucide-react";
import { useI18n } from "../../i18n";

export function StudioDialog({
  title,
  onClose,
  children,
  wide = false,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const { t } = useI18n();
  useEffect(() => {
    const element = ref.current;
    element?.showModal();
    return () => element?.close();
  }, []);
  return (
    <dialog
      ref={ref}
      className={`studio-dialog ${wide ? "studio-dialog-wide" : ""}`}
      aria-labelledby="dialog-title"
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
    >
      <header>
        <h2 id="dialog-title">{title}</h2>
        <button
          className="studio-icon-button"
          aria-label={t("common.close")}
          onClick={onClose}
        >
          <X size={18} />
        </button>
      </header>
      <div className="studio-dialog-body">{children}</div>
    </dialog>
  );
}
