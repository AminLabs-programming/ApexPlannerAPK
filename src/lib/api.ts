/* =========================================================================
   لایه‌ی ارتباط با بکند — پورت مستقیم و ۱:۱ از api.js پروژه‌ی اصلی.
   تمام مسیرها (endpoint)، پارامترها، و شکل payload دقیقاً همون‌هایی هستن که
   بکند FastAPI انتظارشون رو داره. چیزی از خودم اضافه/کم نکردم.
   ========================================================================= */

import { APEX_CONFIG } from "./config";

const TOKEN_KEY = "apex_token";
const USER_CACHE_KEY = "apex_user_cache";

function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}
function setToken(token: string) {
  try {
    localStorage.setItem(TOKEN_KEY, token);
  } catch {
    /* noop */
  }
}
function clearToken() {
  try {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_CACHE_KEY);
  } catch {
    /* noop */
  }
}
function getCachedUser(): any {
  try {
    const raw = localStorage.getItem(USER_CACHE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}
function setCachedUser(user: any) {
  try {
    localStorage.setItem(USER_CACHE_KEY, JSON.stringify(user));
  } catch {
    /* noop */
  }
}

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
  // status===0 یعنی اصلاً به سرور نرسیدیم (آفلاین/DNS/تایم‌اوت) — این با
  // خطاهای واقعی سرور (۴xx/۵xx) فرق داره و باید باعث صف‌شدن عملیات بشه.
  get isNetworkError() {
    return this.status === 0;
  }
}

function backendBase() {
  return (APEX_CONFIG.BACKEND_URL || "").replace(/\/+$/, "");
}

interface RequestOpts {
  json?: unknown;
  params?: Record<string, string | number | boolean | undefined | null>;
  auth?: boolean;
  formData?: FormData;
}

async function request<T = any>(method: string, path: string, opts: RequestOpts = {}): Promise<T> {
  const { json, params, auth = true, formData } = opts;
  const base = backendBase();
  let url = base + path;
  if (params) {
    const qs = new URLSearchParams(
      Object.entries(params)
        .filter(([, v]) => v !== undefined && v !== null)
        .map(([k, v]) => [k, String(v)])
    ).toString();
    if (qs) url += "?" + qs;
  }
  const headers: Record<string, string> = {};
  if (!formData) headers["Content-Type"] = "application/json";
  if (auth) {
    const token = getToken();
    if (token) headers["Authorization"] = "Bearer " + token;
  }
  let res: Response;
  try {
    res = await fetch(url, {
      method,
      headers,
      body: formData ? formData : json !== undefined ? JSON.stringify(json) : undefined,
    });
  } catch {
    throw new ApiError("اتصال به سرور برقرار نشد. اینترنتت یا آدرس بکند رو چک کن.", 0);
  }
  let body: any = null;
  try {
    body = await res.json();
  } catch {
    /* body may be empty */
  }
  if (!res.ok) {
    const detail = (body && body.detail) || `خطای سرور (${res.status})`;
    if (res.status === 401) clearToken();
    throw new ApiError(detail, res.status);
  }
  return body as T;
}

export const Api = {
  ApiError,
  getToken,
  setToken,
  clearToken,
  getCachedUser,
  setCachedUser,
  isLoggedIn: () => !!getToken(),

  // ---- connectivity ----
  ping: (): Promise<boolean> =>
    request("GET", "/auth/me")
      .then(() => true)
      .catch((e) => {
        if (e instanceof ApiError && !e.isNetworkError) return true;
        return false;
      }),

  // ---- auth ----
  register: (username: string, password: string, display_name: string) =>
    request("POST", "/auth/register", { json: { username, password, display_name }, auth: false }),
  login: (username: string, password: string) =>
    request("POST", "/auth/login", { json: { username, password }, auth: false }),
  me: () => request("GET", "/auth/me"),
  updateMe: (payload: unknown) => request("PATCH", "/auth/me", { json: payload }),
  changePassword: (currentPassword: string, newPassword: string) =>
    request("PATCH", "/auth/change-password", {
      json: { current_password: currentPassword, new_password: newPassword },
    }),
  forgotPassword: (username: string) =>
    request("POST", "/auth/forgot-password", { json: { username }, auth: false }),
  resetPassword: (username: string, code: string, newPassword: string) =>
    request("POST", "/auth/reset-password", {
      json: { username, code, new_password: newPassword },
      auth: false,
    }),

  // ---- plan items ----
  listPlanItems: (params?: Record<string, any>) => request("GET", "/plan-items", { params }),
  createPlanItem: (payload: unknown) => request("POST", "/plan-items", { json: payload }),
  updatePlanItem: (id: string, payload: unknown) =>
    request("PATCH", `/plan-items/${id}`, { json: payload }),
  deletePlanItem: (id: string) => request("DELETE", `/plan-items/${id}`),

  // ---- questions ----
  listQuestions: () => request("GET", "/questions"),
  createQuestion: (payload: unknown) => request("POST", "/questions", { json: payload }),
  updateQuestion: (id: string, payload: unknown) =>
    request("PATCH", `/questions/${id}`, { json: payload }),
  deleteQuestion: (id: string) => request("DELETE", `/questions/${id}`),

  // ---- exams ----
  listExams: () => request("GET", "/exams"),
  createExam: (payload: unknown) => request("POST", "/exams", { json: payload }),
  updateExam: (id: string, payload: unknown) => request("PATCH", `/exams/${id}`, { json: payload }),
  deleteExam: (id: string) => request("DELETE", `/exams/${id}`),

  // ---- alarms ----
  listAlarms: () => request("GET", "/alarms"),
  createAlarm: (payload: unknown) => request("POST", "/alarms", { json: payload }),
  updateAlarm: (id: string, payload: unknown) => request("PATCH", `/alarms/${id}`, { json: payload }),
  deleteAlarm: (id: string) => request("DELETE", `/alarms/${id}`),

  // ---- admin ----
  adminListMembers: () => request("GET", "/admin/members"),
  adminSetBan: (userId: string, banned: boolean) =>
    request("POST", `/admin/members/${userId}/ban`, { json: { banned } }),
  adminDeleteMember: (userId: string) => request("DELETE", `/admin/members/${userId}`),
  adminResetPassword: (userId: string, newPassword?: string | null) =>
    request("POST", `/admin/members/${userId}/reset-password`, {
      json: { new_password: newPassword || null },
    }),

  // ---- admin: notion sync ----
  adminNotionStatus: () => request("GET", "/admin/notion/status"),
  adminNotionSync: (date?: string | null) =>
    request("POST", "/admin/notion/sync", { json: { date: date || null } }),

  // ---- analysis bank ----
  listAnalysisExams: (params?: { grade?: number }) => request("GET", "/analysis-exams", { params }),
  getAnalysisExam: (id: string) => request("GET", `/analysis-exams/${id}`),
  createAnalysisExam: (
    meta: {
      title: string;
      date?: string;
      grade: number;
      question_count: number;
      manual_start_page?: number;
      manual_end_page?: number;
      overall_note?: string;
    },
    file: File
  ) => {
    const fd = new FormData();
    fd.append("title", meta.title);
    fd.append("date", meta.date || "");
    fd.append("grade", String(meta.grade));
    fd.append("question_count", String(meta.question_count));
    if (meta.manual_start_page != null) fd.append("manual_start_page", String(meta.manual_start_page));
    if (meta.manual_end_page != null) fd.append("manual_end_page", String(meta.manual_end_page));
    fd.append("overall_note", meta.overall_note || "");
    fd.append("pdf", file, file.name);
    return request("POST", "/analysis-exams", { formData: fd });
  },
  updateAnalysisExam: (id: string, payload: unknown) =>
    request("PATCH", `/analysis-exams/${id}`, { json: payload }),
  remapAnalysisExam: (id: string, startPage: number, endPage: number) =>
    request("POST", `/analysis-exams/${id}/remap`, {
      json: { manual_start_page: startPage, manual_end_page: endPage },
    }),
  deleteAnalysisExam: (id: string) => request("DELETE", `/analysis-exams/${id}`),
  upsertAnalysisNote: (examId: string, payload: unknown) =>
    request("POST", `/analysis-exams/${examId}/notes`, { json: payload }),
  deleteAnalysisNote: (examId: string, noteId: string) =>
    request("DELETE", `/analysis-exams/${examId}/notes/${noteId}`),
  listAnalysisNotes: (params?: { grade?: number; category?: string; subject?: string; status?: string }) =>
    request("GET", "/analysis-notes", { params }),
  getAnalysisPdfUrl: (examId: string, forceDownload?: boolean) => {
    const dl = forceDownload ? "&download=1" : "";
    return `${backendBase()}/analysis-exams/${examId}/pdf?token=${encodeURIComponent(getToken() || "")}${dl}`;
  },
};
