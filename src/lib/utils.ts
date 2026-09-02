export const toPersian = (n: number | string): string =>
  String(n).replace(/[0-9]/g, (d) => "۰۱۲۳۴۵۶۷۸۹"[+d]);

export const toArabicNum = toPersian;

const JALALI_MONTHS = [
  "فروردین","اردیبهشت","خرداد","تیر","مرداد","شهریور",
  "مهر","آبان","آذر","دی","بهمن","اسفند",
];

const JALALI_DAYS_SHORT = ["ش","ی","د","س","چ","پ","ج"];
const JALALI_DAYS = ["شنبه","یکشنبه","دوشنبه","سه‌شنبه","چهارشنبه","پنجشنبه","جمعه"];

export const fakeJalali = {
  today: "۱۴۰۳/۰۵/۱۰",
  todayLong: "شنبه، ۱۰ مرداد ۱۴۰۳",
  month: "مرداد ۱۴۰۳",
  year: "۱۴۰۳",
};

export const weekDays = JALALI_DAYS_SHORT.map((d, i) => ({
  short: d,
  full: JALALI_DAYS[i],
  num: toPersian(i + 8),
}));

export const SUBJECTS = [
  { id: "math", label: "ریاضی", color: "#5B8BF0" },
  { id: "physics", label: "فیزیک", color: "#F0885B" },
  { id: "chemistry", label: "شیمی", color: "#5BF0A8" },
  { id: "biology", label: "زیست", color: "#8BF05B" },
  { id: "lit", label: "ادبیات", color: "#F05BB8" },
  { id: "arabic", label: "عربی", color: "#A85BF0" },
  { id: "religion", label: "دینی", color: "#F0D45B" },
  { id: "lang", label: "زبان", color: "#5BD0F0" },
  { id: "other", label: "سایر", color: "#B0B0B0" },
];

export const CATEGORIES = [
  { id: "all", label: "همه" },
  { id: "lesson", label: "درسی" },
  { id: "personal", label: "پرورشی" },
  { id: "other", label: "غیر درسی" },
];

export type Screen =
  | "splash"
  | "login"
  | "register"
  | "forgot"
  | "home"
  | "plan"
  | "timer"
  | "questions"
  | "stats"
  | "analysis"
  | "analysis-detail"
  | "profile"
  | "admin";

export type SurfaceStyle = "solid" | "glass";
export type ColorMode = "light" | "dark" | "system";
