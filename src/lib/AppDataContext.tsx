/* =========================================================================
   AppDataContext — معادل ری‌اکتیِ DB سراسری + منطق سینک/آفلاینِ app.js اصلی.
   هر صفحه به‌جای خوندن یه متغیر global، از useAppData() استفاده می‌کنه.
   رفتار offline-first (کش IndexedDB + صف outbox + retry خودکار) دقیقاً
   همون منطق پروژه‌ی اصلیه — فقط قالبش به هوک/context تبدیل شده.
   ========================================================================= */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { Api, ApiError } from "./api";
import { Store, type Entity, type OpKind, type OutboxOp } from "./store";
import {
  type AppDB,
  type PlanItem,
  type Question,
  type Exam,
  type Alarm,
  type AnalysisExamListItem,
  defaultDB,
  planItemFromApi,
  planItemToApiCreate,
  planItemToApiUpdate,
  questionFromApi,
  examFromApi,
  alarmFromApi,
  analysisExamListFromApi,
  analysisExamFullFromApi,
  analysisNoteFromApi,
} from "./types";

function uid() {
  return "x" + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

function isOfflineError(e: unknown) {
  if (e instanceof ApiError) return e.isNetworkError;
  return !navigator.onLine;
}

interface AppDataValue {
  db: AppDB;
  loading: boolean;
  isOfflineBoot: boolean;
  pendingCount: number;
  isOnline: boolean;

  // auth
  login: (username: string, password: string) => Promise<void>;
  register: (username: string, password: string, displayName: string) => Promise<void>;
  logout: () => Promise<void>;

  // plan items
  addPlanItem: (payload: Partial<PlanItem>) => Promise<void>;
  updatePlanItem: (id: string, payload: Partial<PlanItem>) => Promise<void>;
  deletePlanItem: (id: string) => Promise<void>;

  // questions
  addQuestion: (payload: Partial<Question>) => Promise<void>;
  updateQuestion: (id: string, payload: Partial<Question>) => Promise<void>;
  deleteQuestion: (id: string) => Promise<void>;

  // exams
  addExam: (payload: Partial<Exam>) => Promise<void>;
  updateExam: (id: string, payload: Partial<Exam>) => Promise<void>;
  deleteExam: (id: string) => Promise<void>;

  // alarms
  addAlarm: (payload: Partial<Alarm>) => Promise<void>;
  updateAlarm: (id: string, payload: Partial<Alarm>) => Promise<void>;
  deleteAlarm: (id: string) => Promise<void>;

  // local-only (timer sessions — never hit the backend)
  addSession: (session: { subject: string; minutes: number; mode: string }) => void;

  // analysis bank (lazy — نه بخشی از سینک اصلی، طبق طراحی app.js اصلی)
  analysisExams: import("./types").AnalysisExamListItem[];
  analysisExamsLoading: boolean;
  loadAnalysisExams: (grade?: number) => Promise<void>;
  uploadAnalysisExam: (
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
  ) => Promise<any>;
  deleteAnalysisExam: (id: string) => Promise<void>;
  getAnalysisExamDetail: (id: string) => Promise<import("./types").AnalysisExamFull>;
  upsertAnalysisNote: (examId: string, payload: unknown) => Promise<any>;

  refresh: () => Promise<void>;
}

const AppDataCtx = createContext<AppDataValue | null>(null);

function currentUserId(db: AppDB) {
  return db.profile.userId || Api.getCachedUser()?.id || null;
}

export function AppDataProvider({ children }: { children: React.ReactNode }) {
  const [db, setDb] = useState<AppDB>(defaultDB());
  const [loading, setLoading] = useState(true);
  const [isOfflineBoot, setIsOfflineBoot] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  const dbRef = useRef(db);
  dbRef.current = db;
  const lockChain = useRef<Promise<any>>(Promise.resolve());

  function withDbLock<T>(fn: () => Promise<T> | T): Promise<T> {
    const run = lockChain.current.then(fn, fn);
    lockChain.current = run.then(
      () => {},
      () => {}
    );
    return run;
  }

  const persistNow = useCallback(async (nextDb: AppDB) => {
    const userId = currentUserId(nextDb);
    await Store.saveDbCache(userId, nextDb);
  }, []);

  const updateDb = useCallback(
    (mutator: (prev: AppDB) => AppDB) => {
      setDb((prev) => {
        const next = mutator(prev);
        persistNow(next);
        return next;
      });
    },
    [persistNow]
  );

  const refreshPendingBadge = useCallback(async () => {
    const userId = currentUserId(dbRef.current);
    if (!userId) {
      setPendingCount(0);
      return;
    }
    try {
      const n = await Store.countPending(userId);
      setPendingCount(n);
    } catch {
      /* noop */
    }
  }, []);

  // ---- sync from server (full refresh, only when online) ----
  const syncFromServer = useCallback(async () => {
    return withDbLock(async () => {
      const [me, items, questions, exams, alarms] = await Promise.all([
        Api.me(),
        Api.listPlanItems(),
        Api.listQuestions(),
        Api.listExams(),
        Api.listAlarms(),
      ]);
      const prevSessions = dbRef.current.sessions || [];
      const fresh = defaultDB();
      fresh.sessions = prevSessions;
      fresh.profile = {
        name: me.display_name,
        goalHoursPerDay: me.goal_hours_per_day,
        examTargetLabel: me.exam_target_label || "",
        role: me.role,
        userId: me.id,
        username: me.username,
      };
      fresh.planItems = items.map(planItemFromApi);
      fresh.questions = questions.map(questionFromApi);
      fresh.exams = exams.map(examFromApi);
      fresh.alarms = alarms.map(alarmFromApi);
      Api.setCachedUser(me);
      setIsOfflineBoot(false);
      setDb(fresh);
      await persistNow(fresh);
      return fresh;
    });
  }, [persistNow]);

  // ---- boot: load cache first, then try to sync if online ----
  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        if (Api.isLoggedIn()) {
          const cachedUser = Api.getCachedUser();
          if (cachedUser?.id) {
            const cached = await Store.loadDbCache(cachedUser.id);
            if (cached) {
              const fresh = defaultDB();
              for (const k of Object.keys(fresh) as (keyof AppDB)[]) {
                if (!(k in cached)) (cached as any)[k] = (fresh as any)[k];
              }
              setDb(cached);
              setIsOfflineBoot(true);
            }
          }
          if (navigator.onLine) {
            try {
              await syncFromServer();
            } catch {
              /* stay on cached/offline data */
            }
          }
          await refreshPendingBadge();
        }
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- online/offline listeners + outbox processing ----
  const outboxProcessing = useRef(false);

  const applyOutboxOp = useCallback(async (op: OutboxOp, idMap: Record<string, string>) => {
    const resolveId = (id?: string) => (id && idMap[id] ? idMap[id] : id);
    if (op.entity === "planItem") {
      if (op.kind === "create") {
        const created = await Api.createPlanItem(op.payload);
        idMap[op.tempId!] = created.id;
        updateDb((prev) => ({
          ...prev,
          planItems: prev.planItems.map((x) =>
            x.id === op.tempId ? { ...planItemFromApi(created) } : x
          ),
        }));
      } else if (op.kind === "update") {
        await Api.updatePlanItem(resolveId(op.realId)!, op.payload);
      } else if (op.kind === "delete") {
        await Api.deletePlanItem(resolveId(op.realId)!);
      }
    } else if (op.entity === "question") {
      if (op.kind === "create") {
        const created = await Api.createQuestion(op.payload);
        idMap[op.tempId!] = created.id;
        updateDb((prev) => ({
          ...prev,
          questions: prev.questions.map((x) =>
            x.id === op.tempId ? { ...questionFromApi(created) } : x
          ),
        }));
      } else if (op.kind === "update") {
        await Api.updateQuestion(resolveId(op.realId)!, op.payload);
      } else if (op.kind === "delete") {
        await Api.deleteQuestion(resolveId(op.realId)!);
      }
    } else if (op.entity === "exam") {
      if (op.kind === "create") {
        const created = await Api.createExam(op.payload);
        idMap[op.tempId!] = created.id;
        updateDb((prev) => ({
          ...prev,
          exams: prev.exams.map((x) => (x.id === op.tempId ? { ...examFromApi(created) } : x)),
        }));
      } else if (op.kind === "update") {
        await Api.updateExam(resolveId(op.realId)!, op.payload);
      } else if (op.kind === "delete") {
        await Api.deleteExam(resolveId(op.realId)!);
      }
    } else if (op.entity === "alarm") {
      if (op.kind === "create") {
        const created = await Api.createAlarm(op.payload);
        idMap[op.tempId!] = created.id;
        updateDb((prev) => ({
          ...prev,
          alarms: prev.alarms.map((x) => (x.id === op.tempId ? { ...alarmFromApi(created) } : x)),
        }));
      } else if (op.kind === "update") {
        await Api.updateAlarm(resolveId(op.realId)!, op.payload);
      } else if (op.kind === "delete") {
        await Api.deleteAlarm(resolveId(op.realId)!);
      }
    }
  }, [updateDb]);

  const processOutbox = useCallback(async () => {
    if (outboxProcessing.current || !navigator.onLine) return;
    const userId = currentUserId(dbRef.current);
    if (!userId) return;
    outboxProcessing.current = true;
    let processedCount = 0;
    try {
      const idMap: Record<string, string> = {};
      const ops = await Store.listOps(userId);
      for (const op of ops) {
        try {
          await applyOutboxOp(op, idMap);
          await Store.removeOp(op.opId);
          processedCount++;
        } catch (e) {
          if (isOfflineError(e)) break;
          await Store.removeOp(op.opId);
          processedCount++;
        }
      }
    } finally {
      outboxProcessing.current = false;
      await refreshPendingBadge();
    }
    if (processedCount > 0 && navigator.onLine) {
      try {
        await syncFromServer();
      } catch {
        /* retried later */
      }
    }
  }, [applyOutboxOp, refreshPendingBadge, syncFromServer]);

  useEffect(() => {
    const onOnline = () => {
      setIsOnline(true);
      processOutbox();
    };
    const onOffline = () => setIsOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, [processOutbox]);

  const queueOp = useCallback(
    async (kind: OpKind, entity: Entity, opts: { tempId?: string; realId?: string; payload?: unknown }) => {
      const userId = currentUserId(dbRef.current);
      if (!userId) return null;
      const opId = await Store.enqueueOp(userId, { kind, entity, ...opts });
      await refreshPendingBadge();
      return opId;
    },
    [refreshPendingBadge]
  );

  // ---- generic offline-optimistic CRUD factory (mirrors makeOfflineCrud) ----
  function makeCrud<TLocal extends { id: string }>(opts: {
    entity: Entity;
    listKey: keyof AppDB;
    fromApi: (raw: any) => TLocal;
    apiCreate: (payload: any) => Promise<any>;
    apiUpdate: (id: string, payload: any) => Promise<any>;
    apiDelete: (id: string) => Promise<any>;
    unshift?: boolean;
  }) {
    const { entity, listKey, fromApi, apiCreate, apiUpdate, apiDelete, unshift } = opts;

    async function add(payload: any) {
      const tempId = uid();
      const optimistic = fromApi({ ...payload, id: tempId });
      updateDb((prev) => ({
        ...prev,
        [listKey]: unshift
          ? [optimistic, ...(prev[listKey] as any[])]
          : [...(prev[listKey] as any[]), optimistic],
      }));
      try {
        const created = await apiCreate(payload);
        const real = fromApi(created);
        updateDb((prev) => ({
          ...prev,
          [listKey]: (prev[listKey] as any[]).map((x) => (x.id === tempId ? real : x)),
        }));
      } catch (e) {
        if (isOfflineError(e)) {
          await queueOp("create", entity, { tempId, payload });
          return;
        }
        updateDb((prev) => ({
          ...prev,
          [listKey]: (prev[listKey] as any[]).filter((x) => x.id !== tempId),
        }));
        throw e;
      }
    }

    async function update(id: string, payload: any) {
      let backup: any = null;
      updateDb((prev) => {
        const list = prev[listKey] as any[];
        const idx = list.findIndex((x) => x.id === id);
        if (idx < 0) return prev;
        backup = { ...list[idx] };
        const optimistic = fromApi({ ...backup, ...payload, id });
        const nextList = [...list];
        nextList[idx] = optimistic;
        return { ...prev, [listKey]: nextList };
      });
      if (!backup) return;
      try {
        const updated = await apiUpdate(id, payload);
        const real = fromApi(updated);
        updateDb((prev) => ({
          ...prev,
          [listKey]: (prev[listKey] as any[]).map((x) => (x.id === id ? real : x)),
        }));
      } catch (e) {
        if (isOfflineError(e)) {
          await queueOp("update", entity, { realId: id, payload });
          return;
        }
        updateDb((prev) => ({
          ...prev,
          [listKey]: (prev[listKey] as any[]).map((x) => (x.id === id ? backup : x)),
        }));
        throw e;
      }
    }

    async function del(id: string) {
      let backup: any = null;
      updateDb((prev) => {
        const list = prev[listKey] as any[];
        backup = list.find((x) => x.id === id) || null;
        return { ...prev, [listKey]: list.filter((x) => x.id !== id) };
      });
      try {
        await apiDelete(id);
      } catch (e) {
        if (isOfflineError(e)) {
          await queueOp("delete", entity, { realId: id });
          return;
        }
        if (backup) {
          updateDb((prev) => ({ ...prev, [listKey]: [...(prev[listKey] as any[]), backup] }));
        }
        throw e;
      }
    }

    return { add, update, del };
  }

  const planItemCrud = makeCrud<PlanItem>({
    entity: "planItem",
    listKey: "planItems",
    fromApi: (raw) =>
      raw.study_minutes !== undefined || raw.name === undefined
        ? planItemFromApi(raw)
        : ({
            id: raw.id,
            name: raw.name,
            date: raw.date,
            category: raw.category,
            status: raw.status || "pending",
            studyMinutes: raw.studyMinutes || 0,
            testCount: raw.testCount || 0,
            timeLabel: raw.timeLabel || "",
            notes: raw.notes || "",
          } as PlanItem),
    apiCreate: (p) => Api.createPlanItem(planItemToApiCreate(p)),
    apiUpdate: (id, p) => Api.updatePlanItem(id, planItemToApiUpdate(p)),
    apiDelete: (id) => Api.deletePlanItem(id),
  });

  const questionCrud = makeCrud<Question>({
    entity: "question",
    listKey: "questions",
    fromApi: (raw) => (raw.options !== undefined ? questionFromApi(raw) : raw),
    apiCreate: (p) => Api.createQuestion(p),
    apiUpdate: (id, p) => Api.updateQuestion(id, p),
    apiDelete: (id) => Api.deleteQuestion(id),
    unshift: true,
  });

  const examCrud = makeCrud<Exam>({
    entity: "exam",
    listKey: "exams",
    fromApi: (raw) => (raw.subjects !== undefined ? examFromApi(raw) : raw),
    apiCreate: (p) => Api.createExam(p),
    apiUpdate: (id, p) => Api.updateExam(id, p),
    apiDelete: (id) => Api.deleteExam(id),
    unshift: true,
  });

  const alarmCrud = makeCrud<Alarm>({
    entity: "alarm",
    listKey: "alarms",
    fromApi: (raw) => (raw.time !== undefined ? alarmFromApi(raw) : raw),
    apiCreate: (p) => Api.createAlarm(p),
    apiUpdate: (id, p) => Api.updateAlarm(id, p),
    apiDelete: (id) => Api.deleteAlarm(id),
  });

  // ---- auth ----
  const login = useCallback(
    async (username: string, password: string) => {
      const res = await Api.login(username, password);
      Api.setToken(res.access_token);
      await syncFromServer();
      await refreshPendingBadge();
    },
    [syncFromServer, refreshPendingBadge]
  );

  const register = useCallback(
    async (username: string, password: string, displayName: string) => {
      const res = await Api.register(username, password, displayName);
      Api.setToken(res.access_token);
      await syncFromServer();
      await refreshPendingBadge();
    },
    [syncFromServer, refreshPendingBadge]
  );

  const logout = useCallback(async () => {
    const userId = currentUserId(dbRef.current);
    // پیش از پاک‌سازی، هر تغییر سینک‌نشده رو تلاش می‌کنیم برسونیم (اگه آنلاینیم)
    if (userId && navigator.onLine) {
      try {
        await processOutbox();
      } catch {
        /* noop */
      }
    }
    Api.clearToken();
    if (userId) await Store.clearDbCache(userId);
    setDb(defaultDB());
    setPendingCount(0);
    setIsOfflineBoot(false);
  }, [processOutbox]);

  const addSession = useCallback(
    (session: { subject: string; minutes: number; mode: string }) => {
      updateDb((prev) => ({
        ...prev,
        sessions: [
          { id: uid(), date: new Date().toISOString().slice(0, 10), ...session } as any,
          ...prev.sessions,
        ],
      }));
    },
    [updateDb]
  );

  // ---- analysis bank (lazy-loaded) ----
  const [analysisExams, setAnalysisExams] = useState<AnalysisExamListItem[]>([]);
  const [analysisExamsLoading, setAnalysisExamsLoading] = useState(false);

  const loadAnalysisExams = useCallback(async (grade?: number) => {
    setAnalysisExamsLoading(true);
    try {
      const raw = await Api.listAnalysisExams(grade !== undefined ? { grade } : undefined);
      setAnalysisExams(raw.map(analysisExamListFromApi));
    } finally {
      setAnalysisExamsLoading(false);
    }
  }, []);

  const uploadAnalysisExam = useCallback(
    async (
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
      const created = await Api.createAnalysisExam(meta, file);
      setAnalysisExams((prev) => [analysisExamListFromApi(created), ...prev]);
      return created;
    },
    []
  );

  const deleteAnalysisExamFn = useCallback(async (id: string) => {
    await Api.deleteAnalysisExam(id);
    setAnalysisExams((prev) => prev.filter((e) => e.id !== id));
  }, []);

  const getAnalysisExamDetail = useCallback(async (id: string) => {
    const raw = await Api.getAnalysisExam(id);
    return analysisExamFullFromApi(raw);
  }, []);

  const upsertAnalysisNoteFn = useCallback(async (examId: string, payload: unknown) => {
    const raw = await Api.upsertAnalysisNote(examId, payload);
    return analysisNoteFromApi(raw);
  }, []);

  const value: AppDataValue = {
    db,
    loading,
    isOfflineBoot,
    pendingCount,
    isOnline,
    login,
    register,
    logout,
    addPlanItem: planItemCrud.add,
    updatePlanItem: planItemCrud.update,
    deletePlanItem: planItemCrud.del,
    addQuestion: questionCrud.add,
    updateQuestion: questionCrud.update,
    deleteQuestion: questionCrud.del,
    addExam: examCrud.add,
    updateExam: examCrud.update,
    deleteExam: examCrud.del,
    addAlarm: alarmCrud.add,
    updateAlarm: alarmCrud.update,
    deleteAlarm: alarmCrud.del,
    addSession,
    analysisExams,
    analysisExamsLoading,
    loadAnalysisExams,
    uploadAnalysisExam,
    deleteAnalysisExam: deleteAnalysisExamFn,
    getAnalysisExamDetail,
    upsertAnalysisNote: upsertAnalysisNoteFn,
    refresh: syncFromServer,
  };

  return <AppDataCtx.Provider value={value}>{children}</AppDataCtx.Provider>;
}

export function useAppData() {
  const ctx = useContext(AppDataCtx);
  if (!ctx) throw new Error("useAppData must be used within AppDataProvider");
  return ctx;
}
