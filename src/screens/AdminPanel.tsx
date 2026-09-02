import { useEffect, useState } from "react";
import { Api, ApiError } from "../lib/api";
import { memberFromApi, type AdminMember } from "../lib/types";
import { useAppData } from "../lib/AppDataContext";

interface AdminPanelProps {
  glass?: boolean;
  onBack: () => void;
  isOnline?: boolean;
}

export default function AdminPanel({ glass = false, onBack, isOnline = true }: AdminPanelProps) {
  const { db } = useAppData();
  const [members, setMembers] = useState<AdminMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [busyMemberId, setBusyMemberId] = useState<string | null>(null);

  const cardClass = glass ? "card-glass" : "card-solid";

  useEffect(() => {
    if (!isOnline) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    Api.adminListMembers()
      .then((raw: any[]) => {
        if (!cancelled) setMembers(raw.map(memberFromApi));
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof ApiError ? e.message : "بارگذاری اعضا ناموفق بود");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    Api.adminNotionStatus()
      .then((s: any) => {
        if (!cancelled && s?.last_sync_label) setLastSync(s.last_sync_label);
      })
      .catch(() => {
        /* status endpoint optional */
      });

    return () => {
      cancelled = true;
    };
  }, [isOnline]);

  async function handleSync() {
    setSyncing(true);
    try {
      await Api.adminNotionSync();
      setLastSync("همین الان");
    } catch {
      /* toast handled by caller if needed */
    } finally {
      setSyncing(false);
    }
  }

  async function toggleBan(m: AdminMember) {
    setBusyMemberId(m.id);
    try {
      await Api.adminSetBan(m.id, m.status !== "banned");
      setMembers((prev) =>
        prev.map((x) => (x.id === m.id ? { ...x, status: x.status === "banned" ? "active" : "banned" } : x))
      );
    } catch {
      /* keep UI unchanged on failure */
    } finally {
      setBusyMemberId(null);
    }
  }

  async function removeMember(m: AdminMember) {
    if (!confirm(`حذف «${m.name}» از گروه؟ این عملیات غیرقابل بازگشت است.`)) return;
    setBusyMemberId(m.id);
    try {
      await Api.adminDeleteMember(m.id);
      setMembers((prev) => prev.filter((x) => x.id !== m.id));
    } catch {
      /* noop */
    } finally {
      setBusyMemberId(null);
    }
  }

  if (!isOnline) {
    return (
      <div className="bg-pattern min-h-screen pt-16 flex flex-col items-center justify-center px-6" style={{ direction: "rtl" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>📡</div>
          <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>اتصال به اینترنت لازم است</h2>
          <p style={{ color: "var(--fg-muted)", fontSize: 14, lineHeight: 1.6 }}>
            پنل مدیریت گروه نیاز به اتصال اینترنت دارد. لطفاً اتصال خود را بررسی کنید.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-pattern min-h-screen pb-12 pt-16" style={{ direction: "rtl" }}>
      <div className="px-4" style={{ maxWidth: 520, margin: "0 auto" }}>
        {/* Back + title */}
        <div className="flex items-center gap-3 pt-4 mb-6">
          <button
            onClick={onBack}
            style={{
              background: "var(--muted-bg)", border: "none", borderRadius: 10,
              width: 36, height: 36, cursor: "pointer", color: "var(--fg-muted)",
              fontSize: 18, display: "flex", alignItems: "center", justifyContent: "center",
            }}
          >
            ›
          </button>
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 700 }}>پنل مدیریت گروه</h2>
            <p style={{ fontSize: 12, color: "var(--fg-muted)" }}>مدیر: {db.profile.name}</p>
          </div>
        </div>

        {/* Notion sync */}
        <div className={`${cardClass} p-4 mb-4`}>
          <div className="flex items-center justify-between mb-3">
            <div>
              <div style={{ fontSize: 15, fontWeight: 700 }}>همگام‌سازی Notion</div>
              <div style={{ fontSize: 12, color: "var(--fg-muted)", marginTop: 2 }}>
                آخرین همگام‌سازی: {lastSync || "نامشخص"}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div
                style={{
                  width: 8, height: 8, borderRadius: "50%",
                  background: syncing ? "#E8B85C" : "#5BF0A8",
                  boxShadow: syncing ? "0 0 8px rgba(232,184,92,0.6)" : "0 0 8px rgba(91,240,168,0.6)",
                  animation: syncing ? "pulse-glow 1s ease-in-out infinite" : "none",
                }}
              />
              <span style={{ fontSize: 12, color: "var(--fg-muted)" }}>
                {syncing ? "در حال همگام‌سازی..." : "همگام‌شده"}
              </span>
            </div>
          </div>
          <button className="btn-secondary w-full" style={{ fontSize: 14 }} onClick={handleSync} disabled={syncing}>
            {syncing ? "در حال همگام‌سازی..." : "همگام‌سازی اکنون"}
          </button>
        </div>

        {/* Members list */}
        <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 12 }}>اعضای گروه</h3>

        {loading ? (
          <div style={{ fontSize: 13, color: "var(--fg-muted)", textAlign: "center", padding: "20px 0" }}>
            در حال بارگذاری…
          </div>
        ) : error ? (
          <div style={{ fontSize: 13, color: "#E0685A", textAlign: "center", padding: "20px 0" }}>{error}</div>
        ) : (
          <div className="flex flex-col gap-2">
            {members.map((m) => (
              <div key={m.id} className={`${cardClass} p-4`} style={{ opacity: busyMemberId === m.id ? 0.6 : 1 }}>
                <div className="flex items-center gap-3">
                  <div
                    style={{
                      width: 40, height: 40, borderRadius: "50%",
                      background:
                        m.role === "admin" ? "linear-gradient(135deg, #E8B85C, #C49040)" : m.status === "banned" ? "#555" : "var(--muted-bg)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontWeight: 700, fontSize: 15, color: m.role === "admin" ? "#1C1510" : "var(--fg-muted)",
                      flexShrink: 0, boxShadow: m.role === "admin" ? "var(--shadow-gold-sm)" : "none",
                    }}
                  >
                    {m.name[0]}
                  </div>

                  <div style={{ flex: 1 }}>
                    <div className="flex items-center gap-2">
                      <span style={{ fontSize: 14, fontWeight: 600, color: m.status === "banned" ? "var(--fg-muted)" : "var(--fg)" }}>
                        {m.name}
                      </span>
                      {m.role === "admin" && (
                        <span style={{ fontSize: 10, fontWeight: 700, color: "var(--gold)", background: "rgba(212,162,76,0.12)", borderRadius: 5, padding: "1px 6px" }}>
                          مدیر
                        </span>
                      )}
                      {m.status === "banned" && (
                        <span style={{ fontSize: 10, fontWeight: 700, color: "#F05B5B", background: "rgba(240,91,91,0.12)", borderRadius: 5, padding: "1px 6px" }}>
                          مسدود
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 11, color: "var(--fg-muted)", marginTop: 1 }}>
                      {m.username} · {m.lastSeen}
                    </div>
                  </div>

                  {m.role !== "admin" && (
                    <div className="flex gap-1">
                      <button
                        onClick={() => toggleBan(m)}
                        disabled={busyMemberId === m.id}
                        style={{
                          background: m.status === "banned" ? "rgba(91,240,168,0.12)" : "rgba(240,91,91,0.12)",
                          border: "none", borderRadius: 8, padding: "5px 8px", cursor: "pointer",
                          color: m.status === "banned" ? "#3BC878" : "#F05B5B",
                          fontSize: 11, fontWeight: 600, fontFamily: "inherit",
                        }}
                      >
                        {m.status === "banned" ? "رفع مسدود" : "مسدود"}
                      </button>
                      <button
                        onClick={() => removeMember(m)}
                        disabled={busyMemberId === m.id}
                        style={{
                          background: "var(--muted-bg)", border: "none", borderRadius: 8, padding: "5px 8px",
                          cursor: "pointer", color: "var(--fg-muted)", fontSize: 11, fontFamily: "inherit",
                        }}
                      >
                        🗑️
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
