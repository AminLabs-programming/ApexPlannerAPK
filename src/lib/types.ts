/* =========================================================================
   شکل داده‌ها — پورت از توابع fromApi توی app.js اصلی (camelCase داخلی،
   snake_case سمت سرور). این فایل تنها منبع حقیقت شکل داده‌ی هر موجودیته.
   ========================================================================= */

export type Role = "member" | "admin";

export interface Profile {
  name: string;
  goalHoursPerDay: number;
  examTargetLabel: string;
  role: Role;
  userId: string | null;
  username?: string;
}

export type PlanCategory = "درسی" | "توسعه فردی" | "غیردرسی";
export type PlanStatus = "pending" | "done" | "partial" | "missed";

export interface PlanItem {
  id: string;
  name: string;
  date: string; // YYYY-MM-DD (gregorian)
  category: PlanCategory;
  status: PlanStatus;
  studyMinutes: number;
  testCount: number;
  timeLabel: string;
  notes: string;
}

export interface QuestionOption {
  text: string;
  correct: boolean;
}

export type Difficulty = "easy" | "mid" | "hard";

export interface Question {
  id: string;
  text: string;
  options: QuestionOption[];
  subject: string;
  topic: string;
  difficulty: Difficulty;
  createdAt?: string;
}

export interface ExamSubjectScore {
  name: string;
  percent: number;
}

export interface Exam {
  id: string;
  name: string;
  date: string;
  subjects: ExamSubjectScore[];
}

export interface Alarm {
  id: string;
  label: string;
  time: string; // HH:MM
  days: number[]; // 0=Saturday..6=Friday
  enabled: boolean;
}

export interface StudySession {
  id: string;
  date: string;
  subject: string;
  minutes: number;
  mode: "pomodoro" | "countdown" | "stopwatch" | "manual";
}

export interface AnalysisExamListItem {
  id: string;
  title: string;
  date: string;
  grade: number | null;
  gradeLabel: string;
  pageCount: number;
  questionCount: number;
  mappingMethod: string;
  overallNote: string;
  notesCount: number;
  createdAt?: string;
}

export interface AnalysisNote {
  id: string;
  examId: string;
  questionNumber: number;
  status: "correct" | "incorrect" | "unanswered";
  subject?: string;
  category?: string;
  note?: string;
}

export interface AnalysisExamFull extends AnalysisExamListItem {
  notes: AnalysisNote[];
  manualStartPage?: number | null;
  manualEndPage?: number | null;
}

export interface AdminMember {
  id: string;
  name: string;
  username: string;
  role: Role;
  status: "active" | "banned";
  lastSeen: string;
}

export interface AppDB {
  profile: Profile;
  planItems: PlanItem[];
  questions: Question[];
  exams: Exam[];
  alarms: Alarm[];
  sessions: StudySession[];
  analysisExams: AnalysisExamListItem[];
  analysisExamsLoaded: boolean;
}

export function defaultDB(): AppDB {
  return {
    profile: {
      name: "دانش‌آموز",
      goalHoursPerDay: 5,
      examTargetLabel: "",
      role: "member",
      userId: null,
    },
    planItems: [],
    questions: [],
    exams: [],
    alarms: [],
    sessions: [],
    analysisExams: [],
    analysisExamsLoaded: false,
  };
}

// ---- تبدیل شکل داده‌ی API (snake_case) به شکل داخلی اپ (camelCase) ----
export function planItemFromApi(i: any): PlanItem {
  return {
    id: i.id,
    name: i.name,
    date: i.date,
    category: i.category,
    status: i.status,
    studyMinutes: i.study_minutes,
    testCount: i.test_count,
    timeLabel: i.time_label || "",
    notes: i.notes || "",
  };
}
export function planItemToApiCreate(i: Partial<PlanItem>) {
  return { name: i.name, date: i.date, category: i.category, time_label: i.timeLabel || "" };
}
export function planItemToApiUpdate(patch: Partial<PlanItem>) {
  const out: Record<string, any> = {};
  if ("name" in patch) out.name = patch.name;
  if ("date" in patch) out.date = patch.date;
  if ("category" in patch) out.category = patch.category;
  if ("status" in patch) out.status = patch.status;
  if ("studyMinutes" in patch) out.study_minutes = patch.studyMinutes;
  if ("testCount" in patch) out.test_count = patch.testCount;
  if ("timeLabel" in patch) out.time_label = patch.timeLabel;
  if ("notes" in patch) out.notes = patch.notes;
  return out;
}
export function questionFromApi(q: any): Question {
  return {
    id: q.id,
    text: q.text,
    options: q.options || [],
    subject: q.subject || "",
    topic: q.topic || "",
    difficulty: q.difficulty || "mid",
    createdAt: q.created_at,
  };
}
export function examFromApi(e: any): Exam {
  return { id: e.id, name: e.name, date: e.date, subjects: e.subjects || [] };
}
export function alarmFromApi(a: any): Alarm {
  return { id: a.id, label: a.label, time: a.time, days: a.days || [], enabled: a.enabled };
}
export function analysisExamListFromApi(e: any): AnalysisExamListItem {
  return {
    id: e.id,
    title: e.title,
    date: e.date || "",
    grade: e.grade ?? null,
    gradeLabel: e.grade_label || "",
    pageCount: e.page_count,
    questionCount: e.question_count,
    mappingMethod: e.mapping_method,
    overallNote: e.overall_note || "",
    notesCount: e.notes_count || 0,
    createdAt: e.created_at,
  };
}
export function analysisNoteFromApi(n: any): AnalysisNote {
  return {
    id: n.id,
    examId: n.exam_id,
    questionNumber: n.question_number,
    status: n.status,
    subject: n.subject || "",
    category: n.category || "",
    note: n.note || "",
  };
}
export function analysisExamFullFromApi(e: any): AnalysisExamFull {
  return {
    ...analysisExamListFromApi(e),
    notes: (e.notes || []).map(analysisNoteFromApi),
    manualStartPage: e.manual_start_page ?? null,
    manualEndPage: e.manual_end_page ?? null,
  };
}
export function memberFromApi(m: any): AdminMember {
  return {
    id: m.id,
    name: m.display_name || m.name || m.username,
    username: "@" + m.username,
    role: m.role,
    status: m.banned ? "banned" : "active",
    lastSeen: m.last_seen_label || "",
  };
}
