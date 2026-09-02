import { useState } from "react";
import Faravahar from "../components/Faravahar";
import type { Screen } from "../lib/utils";
import { Api, ApiError } from "../lib/api";

type LoginMode = "login" | "register" | "forgot";

interface LoginProps {
  glass?: boolean;
  busy?: boolean;
  error?: string | null;
  onLogin: (username: string, password: string) => void;
  onRegister: (username: string, password: string, displayName: string) => void;
  onNavigate: (s: Screen) => void;
}

export default function Login({ glass = false, busy = false, error, onLogin, onRegister, onNavigate }: LoginProps) {
  const [mode, setMode] = useState<LoginMode>("login");
  const [forgotStep, setForgotStep] = useState(1);

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");

  const [forgotUsername, setForgotUsername] = useState("");
  const [resetCode, setResetCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [forgotBusy, setForgotBusy] = useState(false);
  const [forgotError, setForgotError] = useState<string | null>(null);
  const [forgotSuccess, setForgotSuccess] = useState<string | null>(null);

  const cardClass = glass ? "card-glass" : "card-solid";

  function submitAuth() {
    if (!username.trim() || !password) return;
    if (mode === "login") onLogin(username.trim(), password);
    else onRegister(username.trim(), password, displayName.trim() || username.trim());
  }

  async function submitForgotStep1() {
    if (!forgotUsername.trim()) return;
    setForgotError(null);
    setForgotBusy(true);
    try {
      await Api.forgotPassword(forgotUsername.trim());
      setForgotSuccess("کد بازیابی از طریق ربات تلگرام ارسال شد.");
      setForgotStep(2);
    } catch (e) {
      setForgotError(e instanceof ApiError ? e.message : "ارسال کد ناموفق بود");
    } finally {
      setForgotBusy(false);
    }
  }

  async function submitForgotStep2() {
    if (!resetCode.trim() || !newPassword) return;
    setForgotError(null);
    setForgotBusy(true);
    try {
      await Api.resetPassword(forgotUsername.trim(), resetCode.trim(), newPassword);
      setForgotSuccess("رمز عبور با موفقیت تغییر کرد. حالا وارد شوید.");
      setMode("login");
      setForgotStep(1);
      setUsername(forgotUsername.trim());
      setPassword("");
    } catch (e) {
      setForgotError(e instanceof ApiError ? e.message : "تغییر رمز عبور ناموفق بود");
    } finally {
      setForgotBusy(false);
    }
  }

  return (
    <div
      className="bg-pattern min-h-screen flex flex-col items-center justify-center px-5 py-12"
      style={{ direction: "rtl" }}
    >
      {/* Faravahar watermark */}
      <Faravahar
        size={280}
        className="faravahar-watermark"
        mono
        style={{
          position: "fixed",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          color: "var(--gold)",
        } as React.CSSProperties}
      />

      <div className="w-full" style={{ maxWidth: 400, position: "relative", zIndex: 1 }}>
        {/* Brand mark */}
        <div className="flex flex-col items-center gap-3 mb-10 animate-fade-up">
          <div style={{ filter: "drop-shadow(0 0 20px rgba(212,162,76,0.4))" }}>
            <Faravahar size={72} animated />
          </div>
          <div>
            <h1 className="logo-shimmer text-center" style={{ fontSize: 24, fontWeight: 800 }}>
              اپکس پلنر
            </h1>
            <p className="text-center" style={{ color: "var(--fg-muted)", fontSize: 13, marginTop: 4 }}>
              دستیار مطالعه کنکور
            </p>
          </div>
        </div>

        {/* Auth card */}
        <div className={`${cardClass} p-6 animate-fade-up`} style={{ animationDelay: "0.1s" }}>
          {mode !== "forgot" ? (
            <>
              {/* Segmented control */}
              <div className="seg-control mb-6">
                <button
                  className={`seg-tab ${mode === "login" ? "seg-tab-active" : ""}`}
                  onClick={() => setMode("login")}
                  disabled={busy}
                >
                  ورود
                </button>
                <button
                  className={`seg-tab ${mode === "register" ? "seg-tab-active" : ""}`}
                  onClick={() => setMode("register")}
                  disabled={busy}
                >
                  ثبت‌نام
                </button>
              </div>

              {/* Form fields */}
              <div className="flex flex-col gap-4">
                {mode === "register" && (
                  <div>
                    <label
                      style={{ fontSize: 13, fontWeight: 600, color: "var(--fg-muted)", display: "block", marginBottom: 6 }}
                    >
                      نام نمایشی
                    </label>
                    <input
                      className="input-field"
                      type="text"
                      placeholder="مثال: محمدامین"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      disabled={busy}
                    />
                  </div>
                )}

                <div>
                  <label
                    style={{ fontSize: 13, fontWeight: 600, color: "var(--fg-muted)", display: "block", marginBottom: 6 }}
                  >
                    نام کاربری
                  </label>
                  <input
                    className="input-field"
                    type="text"
                    placeholder="نام کاربری خود را وارد کنید"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    disabled={busy}
                  />
                </div>

                <div>
                  <label
                    style={{ fontSize: 13, fontWeight: 600, color: "var(--fg-muted)", display: "block", marginBottom: 6 }}
                  >
                    رمز عبور
                  </label>
                  <input
                    className="input-field"
                    type="password"
                    placeholder="رمز عبور را وارد کنید"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={busy}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") submitAuth();
                    }}
                  />
                </div>
              </div>

              {error && (
                <div
                  style={{
                    marginTop: 12,
                    color: "#E0685A",
                    fontSize: 13,
                    fontWeight: 600,
                    background: "rgba(224,104,90,0.08)",
                    border: "1px solid rgba(224,104,90,0.25)",
                    borderRadius: 10,
                    padding: "8px 12px",
                  }}
                >
                  {error}
                </div>
              )}

              {/* Forgot password */}
              {mode === "login" && (
                <button
                  onClick={() => {
                    setMode("forgot");
                    setForgotError(null);
                    setForgotSuccess(null);
                  }}
                  style={{
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    color: "var(--gold)",
                    fontSize: 13,
                    fontFamily: "inherit",
                    marginTop: 8,
                    display: "block",
                  }}
                >
                  فراموشی رمز عبور
                </button>
              )}

              {/* CTA */}
              <button
                className="btn-primary w-full mt-6"
                style={{ fontSize: 16, opacity: busy ? 0.7 : 1 }}
                onClick={submitAuth}
                disabled={busy || !username.trim() || !password}
              >
                {busy ? "لطفاً صبر کنید…" : mode === "login" ? "ورود به حساب" : "ایجاد حساب"}
              </button>
            </>
          ) : (
            /* Forgot Password */
            <>
              <button
                onClick={() => {
                  setMode("login");
                  setForgotStep(1);
                  setForgotError(null);
                }}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: "var(--fg-muted)",
                  fontSize: 13,
                  fontFamily: "inherit",
                  marginBottom: 16,
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                }}
              >
                ← بازگشت
              </button>

              <h3 style={{ fontWeight: 700, fontSize: 17, marginBottom: 6 }}>فراموشی رمز عبور</h3>
              <p style={{ color: "var(--fg-muted)", fontSize: 13, marginBottom: 20 }}>
                {forgotStep === 1
                  ? "نام کاربری خود را وارد کنید. کد بازیابی از طریق ربات تلگرام ارسال می‌شود."
                  : "کد ۶ رقمی ارسال‌شده را وارد کنید."}
              </p>

              <div className="flex flex-col gap-4">
                {forgotStep === 1 ? (
                  <div>
                    <label style={{ fontSize: 13, fontWeight: 600, color: "var(--fg-muted)", display: "block", marginBottom: 6 }}>
                      نام کاربری
                    </label>
                    <input
                      className="input-field"
                      type="text"
                      placeholder="نام کاربری"
                      value={forgotUsername}
                      onChange={(e) => setForgotUsername(e.target.value)}
                      disabled={forgotBusy}
                    />
                  </div>
                ) : (
                  <>
                    <div>
                      <label style={{ fontSize: 13, fontWeight: 600, color: "var(--fg-muted)", display: "block", marginBottom: 6 }}>
                        کد بازیابی
                      </label>
                      <input
                        className="input-field"
                        type="text"
                        placeholder="۱۲۳۴۵۶"
                        style={{ letterSpacing: "0.3em", textAlign: "center", direction: "ltr" }}
                        value={resetCode}
                        onChange={(e) => setResetCode(e.target.value)}
                        disabled={forgotBusy}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: 13, fontWeight: 600, color: "var(--fg-muted)", display: "block", marginBottom: 6 }}>
                        رمز عبور جدید
                      </label>
                      <input
                        className="input-field"
                        type="password"
                        placeholder="رمز عبور جدید"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        disabled={forgotBusy}
                      />
                    </div>
                  </>
                )}
              </div>

              {forgotError && (
                <div
                  style={{
                    marginTop: 12,
                    color: "#E0685A",
                    fontSize: 13,
                    fontWeight: 600,
                    background: "rgba(224,104,90,0.08)",
                    border: "1px solid rgba(224,104,90,0.25)",
                    borderRadius: 10,
                    padding: "8px 12px",
                  }}
                >
                  {forgotError}
                </div>
              )}
              {forgotSuccess && !forgotError && (
                <div
                  style={{
                    marginTop: 12,
                    color: "var(--gold)",
                    fontSize: 13,
                    fontWeight: 600,
                  }}
                >
                  {forgotSuccess}
                </div>
              )}

              <button
                className="btn-primary w-full mt-6"
                style={{ fontSize: 15, opacity: forgotBusy ? 0.7 : 1 }}
                onClick={forgotStep === 1 ? submitForgotStep1 : submitForgotStep2}
                disabled={
                  forgotBusy ||
                  (forgotStep === 1 ? !forgotUsername.trim() : !resetCode.trim() || !newPassword)
                }
              >
                {forgotBusy
                  ? "لطفاً صبر کنید…"
                  : forgotStep === 1
                    ? "ارسال کد بازیابی"
                    : "تغییر رمز عبور"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
