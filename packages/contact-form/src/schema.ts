import { z } from "zod";
import {
  categoryLabels,
  contactCategories,
  contactStatuses,
  fieldLimits,
  labelForCategory,
} from "./constants";

const emptyToUndefined = (value: unknown) => {
  if (value === null || value === undefined) return undefined;
  if (typeof value === "string" && value.trim() === "") return undefined;
  return value;
};

export const contactInputSchema = z.object({
  name: z.preprocess(
    emptyToUndefined,
    z
      .string()
      .trim()
      .max(fieldLimits.name, `名前は${fieldLimits.name}文字以内で入力してください`)
      .optional(),
  ),
  email: z
    .string()
    .trim()
    .min(1, "メールアドレスを入力してください")
    .max(fieldLimits.email, `メールアドレスは${fieldLimits.email}文字以内で入力してください`)
    .email("メールアドレスの形式が正しくありません"),
  category: z.preprocess(
    emptyToUndefined,
    z.enum(contactCategories, { error: "お問い合わせの種類を選び直してください" }).optional(),
  ),
  message: z
    .string()
    .trim()
    .min(1, "本文を入力してください")
    .max(fieldLimits.message, `本文は${fieldLimits.message}文字以内で入力してください`),
  privacy_agreed: z.preprocess(
    (value) => {
      if (value === "true" || value === "on" || value === 1) return true;
      if (value === "false" || value === "off" || value === 0 || value === "") return false;
      return value;
    },
    z.literal(true, { error: "プライバシーポリシーへの同意が必要です" }),
  ),
  turnstile_token: z.preprocess(emptyToUndefined, z.string().optional()),
  website: z.preprocess((value) => {
    if (value === null || value === undefined) return "";
    return value;
  }, z.string()),
});

export type ContactInput = z.output<typeof contactInputSchema>;

export const adminUpdateSchema = z
  .object({
    status: z.enum(contactStatuses, { error: "ステータスの値が正しくありません" }).optional(),
    admin_note: z
      .string()
      .max(fieldLimits.adminNote, `管理メモは${fieldLimits.adminNote}文字以内で入力してください`)
      .nullable()
      .optional(),
  })
  .refine((value) => value.status !== undefined || value.admin_note !== undefined, {
    message: "更新する項目がありません",
  });

export type AdminUpdate = z.output<typeof adminUpdateSchema>;

export const contactListQuerySchema = z.object({
  status: z.preprocess(
    emptyToUndefined,
    z.enum(contactStatuses, { error: "ステータスの値が正しくありません" }).optional(),
  ),
  q: z.preprocess(
    emptyToUndefined,
    z.string().trim().max(200, "検索語は200文字以内で入力してください").optional(),
  ),
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(20),
});

export type ContactListQuery = z.output<typeof contactListQuerySchema>;

type IssueList = { issues: ReadonlyArray<{ message?: string; path?: ReadonlyArray<PropertyKey> }> };

export function firstIssueMessage(error: IssueList): string {
  return error.issues[0]?.message ?? "入力内容を確認してください";
}

export function fieldErrors(error: IssueList): Record<string, string> {
  const result: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path?.[0];
    if (typeof key === "string" && issue.message && result[key] === undefined) {
      result[key] = issue.message;
    }
  }
  return result;
}

export { categoryLabels, labelForCategory };
