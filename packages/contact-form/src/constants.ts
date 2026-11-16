export const contactStatuses = ["new", "in_progress", "done", "spam"] as const;
export type ContactStatus = (typeof contactStatuses)[number];

export const contactCategories = ["general", "work", "other"] as const;
export type ContactCategory = (typeof contactCategories)[number];

export const statusLabels: Record<ContactStatus, string> = {
  new: "未対応",
  in_progress: "対応中",
  done: "完了",
  spam: "迷惑",
};

export const categoryOptions = [
  { value: "general", label: "一般的なご相談" },
  { value: "work", label: "工事・見積もりの相談" },
  { value: "other", label: "その他" },
] as const satisfies ReadonlyArray<{ value: ContactCategory; label: string }>;

export const categoryLabels: Record<ContactCategory, string> = {
  general: "一般的なご相談",
  work: "工事・見積もりの相談",
  other: "その他",
};

export const fieldLimits = {
  name: 100,
  email: 254,
  message: 5000,
  adminNote: 5000,
} as const;

export function isContactStatus(value: string): value is ContactStatus {
  return (contactStatuses as readonly string[]).includes(value);
}

export function isContactCategory(value: string): value is ContactCategory {
  return (contactCategories as readonly string[]).includes(value);
}

export function labelForStatus(status: string | null | undefined): string {
  if (status && isContactStatus(status)) return statusLabels[status];
  return "—";
}

export function labelForCategory(category: string | null | undefined): string {
  if (category && isContactCategory(category)) return categoryLabels[category];
  return "未選択";
}

/** UNIX 秒を JST の `YYYY/MM/DD HH:mm` にする。 */
export function formatJst(unixSeconds: number): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(unixSeconds * 1000));
  const pick = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";
  return `${pick("year")}/${pick("month")}/${pick("day")} ${pick("hour")}:${pick("minute")}`;
}
