import { useState, useEffect } from "react";
import type { Screen, SurfaceStyle, ColorMode } from "./lib/utils";
import { AppDataProvider, useAppData } from "./lib/AppDataContext";
import { Api } from "./lib/api";

import Splash from "./screens/Splash";
import Login from "./screens/Login";
import Home from "./screens/Home";
import Plan from "./screens/Plan";
import Timer from "./screens/Timer";
import Questions from "./screens/Questions";
import Stats from "./screens/Stats";
import AnalysisBank from "./screens/AnalysisBank";
import AnalysisDetail from "./screens/AnalysisDetail";
import Profile from "./screens/Profile";
import AdminPanel from "./screens/AdminPanel";
import ConceptGallery from "./screens/ConceptGallery";
import BottomNav from "./components/BottomNav";
import TopBar from "./components/TopBar";
import LoadingScreen from "./components/LoadingScreen";

const APP_SCREENS: Screen[] = ["home", "plan", "timer", "questions", "stats", "analysis"];

export default function App() {
  return (
    <AppDataProvider>
      <AppShell />
    </AppDataProvider>
  );
}

function AppShell() {
  const { db, loading, isOfflineBoot, pendingCount, login, register, logout } = useAppData();

  const [screen, setScreen] = useState<Screen>("splash");
  const [darkMode, setDarkMode] = useState(false);
  const [surfaceStyle, setSurfaceStyle] = useState<SurfaceStyle>("glass");
  const [colorMode, setColorMode] = useState<ColorMode>("light");
  const [showToast, setShowToast] = useState(false);
  const [toastMsg, setToastMsg] = useState("");
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [activeAnalysisExamId, setActiveAnalysisExamId] = useState<string | null>(null);

  const glass = surfaceStyle === "glass";

  useEffect(() => {
    if (darkMode) document.documentElement.classList.add("dark");
    else document.documentElement.classList.remove("dark");
  }, [darkMode]);

  useEffect(() => {
    if (colorMode === "system") {
      const mq = window.matchMedia("(prefers-color-scheme: dark)");
      setDarkMode(mq.matches);
      const handler = (e: MediaQueryListEvent) => setDarkMode(e.matches);
      mq.addEventListener("change", handler);
      return () => mq.removeEventListener("change", handler);
    }
  }, [colorMode]);

  const navigate = (s: Screen) => setScreen(s);

  const toast = (msg: string) => {
    setToastMsg(msg);
    setShowToast(true);
    setTimeout(() => setShowToast(false), 2800);
  };

  const handleSplashDone = () => {
    if (Api.isLoggedIn()) {
      setScreen("home");
    } else {
      setScreen("login");
    }
  };

  const handleLogin = async (username: string, password: string) => {
    setAuthError(null);
    setAuthBusy(true);
    try {
      await login(username, password);
      toast("خوش آمدید! 🎉");
      setScreen("home");
    } catch (e: any) {
      setAuthError(e?.message || "ورود ناموفق بود");
    } finally {
      setAuthBusy(false);
    }
  };

  const handleRegister = async (username: string, password: string, displayName: string) => {
    setAuthError(null);
    setAuthBusy(true);
    try {
      await register(username, password, displayName);
      toast("ثبت‌نام با موفقیت انجام شد 🎉");
      setScreen("home");
    } catch (e: any) {
      setAuthError(e?.message || "ثبت‌نام ناموفق بود");
    } finally {
      setAuthBusy(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    toast("با موفقیت خارج شدید");
    setScreen("login");
  };

  const isMainApp = APP_SCREENS.includes(screen) || screen === "analysis-detail";
  const isProfileScreen = screen === "profile";

  return (
    <div
      className="relative"
      style={{
        minHeight: "100vh",
        maxWidth: 520,
        margin: "0 auto",
        direction: "rtl",
      }}
    >
      {/* ── Splash (برند + انتظار برای بوت واقعی دیتا) ── */}
      {screen === "splash" && <Splash onDone={handleSplashDone} dataReady={!loading} />}

      {/* ── Concept Gallery ── */}
      {screen === "concepts" && (
        <ConceptGallery onEnterApp={() => setScreen("login")} onBack={() => setScreen("login")} />
      )}

      {/* ── Login / Register / Forgot ── */}
      {(screen === "login" || screen === "register" || screen === "forgot") && (
        <Login
          glass={glass}
          busy={authBusy}
          error={authError}
          onLogin={handleLogin}
          onRegister={handleRegister}
          onNavigate={navigate}
        />
      )}

      {/* ── Main App (with TopBar + BottomNav) ── */}
      {(isMainApp || isProfileScreen || screen === "admin") && (
        <>
          {/* Top bar */}
          {isMainApp || isProfileScreen ? (
            <TopBar
              onProfile={() => setScreen("profile")}
              glass={glass}
              hasPendingSync={pendingCount > 0}
              hasAlarms={db.alarms.length > 0}
              onNavigate={navigate}
            />
          ) : null}

          {/* Offline / cached-data banner */}
          {isOfflineBoot && (isMainApp || isProfileScreen) && (
            <div
              style={{
                position: "fixed",
                top: 60,
                left: "50%",
                transform: "translateX(-50%)",
                zIndex: 45,
                background: "rgba(28,21,16,0.9)",
                color: "#F0E6CC",
                fontSize: 12,
                fontWeight: 600,
                padding: "6px 14px",
                borderRadius: 20,
                border: "1px solid rgba(212,162,76,0.3)",
                whiteSpace: "nowrap",
              }}
            >
              حالت آفلاین — نمایش آخرین نسخه‌ی ذخیره‌شده
            </div>
          )}

          {/* Screen content */}
          <div style={{ minHeight: "100vh" }}>
            {loading && screen !== "profile" && screen !== "admin" ? (
              <LoadingScreen fullscreen={false} label="در حال هماهنگ‌سازی…" />
            ) : (
              <>
                {screen === "home" && <Home glass={glass} onNavigate={(s) => navigate(s as Screen)} />}
                {screen === "plan" && <Plan glass={glass} />}
                {screen === "timer" && <Timer glass={glass} />}
                {screen === "questions" && <Questions glass={glass} />}
                {screen === "stats" && <Stats glass={glass} />}
                {screen === "analysis" && (
                  <AnalysisBank
                    glass={glass}
                    onDetail={(examId) => {
                      setActiveAnalysisExamId(examId);
                      setScreen("analysis-detail");
                    }}
                  />
                )}
                {screen === "analysis-detail" && activeAnalysisExamId && (
                  <AnalysisDetail
                    glass={glass}
                    examId={activeAnalysisExamId}
                    onBack={() => setScreen("analysis")}
                  />
                )}
              </>
            )}
            {screen === "profile" && (
              <Profile
                glass={glass}
                darkMode={darkMode}
                setDarkMode={setDarkMode}
                surfaceStyle={surfaceStyle}
                setSurfaceStyle={setSurfaceStyle}
                colorMode={colorMode}
                setColorMode={setColorMode}
                onNavigate={navigate}
                onLogout={handleLogout}
              />
            )}
            {screen === "admin" && (
              <AdminPanel glass={glass} onBack={() => setScreen("profile")} isOnline />
            )}
          </div>

          {/* Bottom nav (not on admin or detail) */}
          {screen !== "admin" && screen !== "analysis-detail" && (
            <BottomNav
              active={isProfileScreen ? "home" : (screen as Screen)}
              onNavigate={(s) => {
                if (s === "analysis" || APP_SCREENS.includes(s)) {
                  setScreen(s);
                }
              }}
              glass={glass}
            />
          )}
        </>
      )}

      {/* ── Toast ── */}
      {showToast && (
        <div
          style={{
            position: "fixed",
            bottom: 100,
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 200,
            background: darkMode ? "rgba(30,25,20,0.95)" : "rgba(28,21,16,0.92)",
            color: "#F0E6CC",
            padding: "10px 20px",
            borderRadius: 50,
            fontSize: 14,
            fontWeight: 600,
            backdropFilter: "blur(16px)",
            border: "1px solid rgba(212,162,76,0.3)",
            boxShadow: "0 4px 24px rgba(0,0,0,0.3), 0 0 20px rgba(212,162,76,0.1)",
            whiteSpace: "nowrap",
            animation: "toast-in 0.3s ease forwards",
          }}
        >
          {toastMsg}
        </div>
      )}
    </div>
  );
}
