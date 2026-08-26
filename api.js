   لایه‌ی ارتباط با بکند - ApexPlanner
   ========================================================================= */

const Api = (() => {
  const TOKEN_KEY = "apex_token";
  const USER_CACHE_KEY = "apex_user_cache";

  function getToken() {
    try { return localStorage.getItem(TOKEN_KEY); } catch (e) { return null; }
  }
  function setToken(token) {
    try { localStorage.setItem(TOKEN_KEY, token); } catch (e) {}
  }
  function clearToken() {
    try {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_CACHE_KEY);
    } catch (e) {}
  }
  function getCachedUser() {
    try {
      const raw = localStorage.getItem(USER_CACHE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  }
  function setCachedUser(user) {
    try { localStorage.setItem(USER_CACHE_KEY, JSON.stringify(user)); } catch (e) {}
  }

  class ApiError extends Error {
    constructor(message, status) {
      super(message);
      this.status = status;
    }
  }

  async function request(method, path, { json, params, auth = true } = {}) {
    const base = (APEX_CONFIG.BACKEND_URL || "").replace(/\/+$/, "");
    let url = base + path;
    if (params) {
      const qs = new URLSearchParams(
        Object.entries(params).filter(([, v]) => v !== undefined && v !== null)
      ).toString();
      if (qs) url += "?" + qs;
    }
    const headers = { "Content-Type": "application/json" };
    if (auth) {
      const token = getToken();
      if (token) headers["Authorization"] = "Bearer " + token;
    }
    let res;
    try {
      res = await fetch(url, {
        method,
        headers,
        body: json !== undefined ? JSON.stringify(json) : undefined,
      });
    } catch (networkErr) {
      throw new ApiError("اتصال به سرور برقرار نشد. اینترنتت یا آدرس بکند رو چک کن.", 0);
    }
    let body = null;
    try { body = await res.json(); } catch (e) {}
    if (!res.ok) {
      const detail = (body && body.detail) || `خطای سرور (${res.status})`;
      if (res.status === 401) {
        clearToken();
      }
      throw new ApiError(detail, res.status);
    }
    return body;
  }

  return {
    ApiError,
    getToken, setToken, clearToken, getCachedUser, setCachedUser,
    isLoggedIn: () => !!getToken(),

    // ---- auth ----
    register: (username, password, display_name) =>
      request("POST", "/auth/register", { json: { username, password, display_name }, auth: false }),
    login: (username, password) =>
      request("POST", "/auth/login", { json: { username, password }, auth: false }),
    me: () => request("GET", "/auth/me"),
    updateMe: (payload) => request("PATCH", "/auth/me", { json: payload }),

    // ---- plan items ----
    listPlanItems: (params) => request("GET", "/plan-items", { params }),
    createPlanItem: (payload) => request("POST", "/plan-items", { json: payload }),
    updatePlanItem: (id, payload) => request("PATCH", `/plan-items/${id}`, { json: payload }),
    deletePlanItem: (id) => request("DELETE", `/plan-items/${id}`),

    // ---- questions ----
    listQuestions: () => request("GET", "/questions"),
    createQuestion: (payload) => request("POST", "/questions", { json: payload }),
    updateQuestion: (id, payload) => request("PATCH", `/questions/${id}`, { json: payload }),
    deleteQuestion: (id) => request("DELETE", `/questions/${id}`),

    // ---- exams ----
    listExams: () => request("GET", "/exams"),
    createExam: (payload) => request("POST", "/exams", { json: payload }),
    updateExam: (id, payload) => request("PATCH", `/exams/${id}`, { json: payload }),
    deleteExam: (id) => request("DELETE", `/exams/${id}`),

    // ---- alarms ----
    listAlarms: () => request("GET", "/alarms"),
    createAlarm: (payload) => request("POST", "/alarms", { json: payload }),
    updateAlarm: (id, payload) => request("PATCH", `/alarms/${id}`, { json: payload }),
    deleteAlarm: (id) => request("DELETE", `/alarms/${id}`),

    // ---- admin ----
    adminListMembers: () => request("GET", "/admin/members"),
    adminSetBan: (userId, banned) => request("POST", `/admin/members/${userId}/ban`, { json: { banned } }),
    adminDeleteMember: (userId) => request("DELETE", `/admin/members/${userId}`),
    
    // ---- NEW: Notion & Restore Points ----
    syncNotion: () => request("POST", "/admin/notion/sync"),
    listRestorePoints: () => request("GET", "/admin/restore-points"),
    createRestorePoint: (name) => request("POST", "/admin/restore-points", { json: { name } }),
    getRestorePoint: (id) => request("GET", `/admin/restore-points/${id}`),
    applyRestorePoint: (id) => request("POST", `/admin/restore-points/${id}/apply`),
  };
})();

if (typeof window !== 'undefined') window.Api = Api;
