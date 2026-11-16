import { describe, expect, test } from "bun:test";
import { fieldLimits } from "./constants";
import { contactsToCsv } from "./csv";
import { contactInputSchema, fieldErrors } from "./schema";

const valid = {
  name: "山田 太郎",
  email: "taro@example.com",
  category: "work",
  message: "浴室の相談です。",
  privacy_agreed: true,
  website: "",
};

describe("contactInputSchema", () => {
  test("正常系", () => {
    const parsed = contactInputSchema.parse(valid);
    expect(parsed.email).toBe("taro@example.com");
    expect(parsed.category).toBe("work");
    expect(parsed.name).toBe("山田 太郎");
  });

  test("名前未入力と空文字は未入力として扱う", () => {
    expect(contactInputSchema.parse({ ...valid, name: "" }).name).toBeUndefined();
    expect(contactInputSchema.parse({ ...valid, name: undefined }).name).toBeUndefined();
  });

  test("名前の文字数境界", () => {
    expect(
      contactInputSchema.parse({ ...valid, name: "あ".repeat(fieldLimits.name) }).name,
    ).toHaveLength(fieldLimits.name);
    const tooLong = contactInputSchema.safeParse({
      ...valid,
      name: "あ".repeat(fieldLimits.name + 1),
    });
    expect(tooLong.success).toBe(false);
  });

  test("メールの必須・形式・254文字", () => {
    expect(contactInputSchema.safeParse({ ...valid, email: "" }).success).toBe(false);
    expect(contactInputSchema.safeParse({ ...valid, email: "not-an-email" }).success).toBe(false);
    const local = "a".repeat(64);
    const domain = `${"b".repeat(180)}.example.com`;
    const longEmail = `${local}@${domain}`;
    expect(longEmail.length).toBeGreaterThan(fieldLimits.email);
    expect(contactInputSchema.safeParse({ ...valid, email: longEmail }).success).toBe(false);
    const within = `${"a".repeat(20)}@example.com`;
    expect(within.length).toBeLessThanOrEqual(fieldLimits.email);
    expect(contactInputSchema.parse({ ...valid, email: within }).email).toBe(within);
  });

  test("本文の文字数境界", () => {
    expect(contactInputSchema.safeParse({ ...valid, message: "" }).success).toBe(false);
    expect(
      contactInputSchema.parse({ ...valid, message: "あ".repeat(fieldLimits.message) }).message,
    ).toHaveLength(fieldLimits.message);
    expect(
      contactInputSchema.safeParse({
        ...valid,
        message: "あ".repeat(fieldLimits.message + 1),
      }).success,
    ).toBe(false);
  });

  test("同意がないと失敗し、項目ごとのメッセージになる", () => {
    const result = contactInputSchema.safeParse({ ...valid, privacy_agreed: false, email: "" });
    expect(result.success).toBe(false);
    if (!result.success) {
      const errors = fieldErrors(result.error);
      expect(errors.email).toBeTruthy();
      expect(errors.privacy_agreed).toBeTruthy();
    }
  });

  test("カテゴリは列挙以外を拒み、空は未選択", () => {
    expect(contactInputSchema.safeParse({ ...valid, category: "sales" }).success).toBe(false);
    expect(contactInputSchema.parse({ ...valid, category: "" }).category).toBeUndefined();
  });

  test("ハニーポットの値そのものはスキーマでは弾かない", () => {
    expect(contactInputSchema.parse({ ...valid, website: "https://spam.example" }).website).toBe(
      "https://spam.example",
    );
  });
});

describe("contactsToCsv", () => {
  test("BOM・日本語ヘッダー・引用符と改行のエスケープ", () => {
    const csv = contactsToCsv([
      {
        createdAt: Date.parse("2026-11-09T05:02:00.000Z") / 1000,
        name: "山田, 太郎",
        email: "taro@example.com",
        category: "work",
        message: '1行目\n"引用"',
        status: "new",
        adminNote: null,
      },
    ]);
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(csv.startsWith("\uFEFF受信日時,名前,メールアドレス")).toBe(true);
    expect(csv).toContain('"山田, 太郎"');
    expect(csv).toContain('"1行目\n""引用"""');
    expect(csv).toContain("工事・見積もりの相談");
    expect(csv).toContain("未対応");
    expect(csv).toContain("2026/11/09 14:02");
  });

  test("数式として解釈されそうなセルは引用符で中和する", () => {
    const csv = contactsToCsv([
      {
        createdAt: 0,
        name: "=HYPERLINK()",
        email: "a@example.com",
        category: null,
        message: "本文",
        status: "spam",
        adminNote: null,
      },
    ]);
    expect(csv).toContain("'=HYPERLINK()");
  });
});
