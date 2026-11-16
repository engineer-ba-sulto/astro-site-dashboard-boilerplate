import { formatJst, labelForCategory, labelForStatus } from "./constants";

export type CsvContact = {
  createdAt: number;
  name: string | null;
  email: string;
  category: string | null;
  message: string;
  status: string;
  adminNote: string | null;
};

const headers = [
  "受信日時",
  "名前",
  "メールアドレス",
  "お問い合わせの種類",
  "本文",
  "ステータス",
  "管理メモ",
] as const;

function neutralize(value: string): string {
  if (/^[=+\-@]/.test(value)) return `'${value}`;
  return value;
}

function escapeCell(value: string): string {
  const safe = neutralize(value);
  if (/[",\n\r]/.test(safe)) return `"${safe.replaceAll('"', '""')}"`;
  return safe;
}

/** BOM 付き UTF-8 の CSV。ヘッダーは日本語。 */
export function contactsToCsv(rows: readonly CsvContact[]): string {
  const lines = [headers.map(escapeCell).join(",")];
  for (const row of rows) {
    const cells = [
      formatJst(row.createdAt),
      row.name ?? "",
      row.email,
      labelForCategory(row.category),
      row.message,
      labelForStatus(row.status),
      row.adminNote ?? "",
    ];
    lines.push(cells.map(escapeCell).join(","));
  }
  return `\uFEFF${lines.join("\r\n")}\r\n`;
}
