import { useEffect } from "react";

interface BottomSheetProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  glass?: boolean;
}

export default function BottomSheet({ open, onClose, title, children, glass = false }: BottomSheetProps) {
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end"
      style={{ maxWidth: 520, margin: "0 auto" }}
    >
      {/* Backdrop */}
      <div
        className="sheet-backdrop absolute inset-0 animate-fade-in"
        onClick={onClose}
      />

      {/* Sheet */}
      <div
        className={`sheet ${glass ? "glass" : ""} relative w-full animate-slide-up`}
        style={{ maxHeight: "85vh", overflowY: "auto" }}
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div
            style={{
              width: 36,
              height: 4,
              borderRadius: 2,
              background: "var(--muted-bg)",
            }}
          />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-2 pb-4">
          <h3 style={{ fontSize: 17, fontWeight: 700, color: "var(--fg)" }}>{title}</h3>
          <button
            onClick={onClose}
            style={{
              background: "var(--muted-bg)",
              border: "none",
              borderRadius: "50%",
              width: 30,
              height: 30,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              color: "var(--fg-muted)",
              fontSize: 16,
            }}
          >
            ✕
          </button>
        </div>

        <div className="px-5 pb-8">{children}</div>
      </div>
    </div>
  );
}
