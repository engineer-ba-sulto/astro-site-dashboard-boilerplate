/**
 * ローカル D1 に架空の問い合わせを 10 件入れる。
 * example.com の行は入れ直す。実在の個人情報は含めない。
 */
import { $ } from "bun";

type Seed = {
  name: string | null;
  email: string;
  category: string | null;
  message: string;
  status: string;
  adminNote: string | null;
  hoursAgo: number;
};

const seeds: Seed[] = [
  {
    name: "山田 太郎（サンプル）",
    email: "taro.yamada@example.com",
    category: "work",
    message: "【サンプル】浴室のリフォームを検討しています。工期と費用の目安を教えてください。",
    status: "new",
    adminNote: null,
    hoursAgo: 2,
  },
  {
    name: null,
    email: "suzuki@example.net",
    category: "general",
    message: "【サンプル】玄関ドアの建て付けが悪く、閉まりにくくなっています。",
    status: "new",
    adminNote: null,
    hoursAgo: 5,
  },
  {
    name: "佐藤 花子（サンプル）",
    email: "hanako.s@example.com",
    category: "work",
    message: "【サンプル】介護保険の住宅改修で手すりを付けたいです。",
    status: "new",
    adminNote: null,
    hoursAgo: 26,
  },
  {
    name: "田中 一郎（サンプル）",
    email: "i.tanaka@example.com",
    category: "other",
    message: "【サンプル】先月の網戸の件で、少し気になる所があります。",
    status: "in_progress",
    adminNote: "【サンプルメモ】火曜に折り返す",
    hoursAgo: 50,
  },
  {
    name: "高橋 美咲（サンプル）",
    email: "misaki.t@example.com",
    category: "work",
    message: "【サンプル】キッチンの交換を考えています。",
    status: "done",
    adminNote: "【サンプルメモ】見積もり済み",
    hoursAgo: 90,
  },
  {
    name: null,
    email: "offer@spam-example.xyz",
    category: null,
    message:
      "【サンプル】これは迷惑メールの見本です。検索順位を保証します、という文面のダミーです。",
    status: "spam",
    adminNote: null,
    hoursAgo: 120,
  },
  {
    name: "伊藤 健（サンプル）",
    email: "ken.ito@example.com",
    category: "general",
    message: "【サンプル】網戸の張り替えだけでもお願いできますか。",
    status: "new",
    adminNote: null,
    hoursAgo: 8,
  },
  {
    name: "渡辺 咲（サンプル）",
    email: "saki.watanabe@example.com",
    category: "work",
    message: "【サンプル】段差の解消について、写真を送りたいです。",
    status: "in_progress",
    adminNote: null,
    hoursAgo: 30,
  },
  {
    name: "中村 浩（サンプル）",
    email: "hiro.nakamura@example.com",
    category: "other",
    message: "【サンプル】営業時間を教えてください。問い合わせのダミーです。",
    status: "done",
    adminNote: null,
    hoursAgo: 200,
  },
  {
    name: "小林 真由（サンプル）",
    email: "mayu.kobayashi@example.com",
    category: "work",
    message: "【サンプル】トイレ交換の相談です。平日午前を希望します。",
    status: "new",
    adminNote: null,
    hoursAgo: 3,
  },
];

function sqlString(value: string | null): string {
  if (value === null) return "null";
  return `'${value.replaceAll("'", "''")}'`;
}

const now = Math.floor(Date.now() / 1000);
const statements = [
  "delete from contacts where email like '%@example.com' or email like '%@example.net' or email like '%@spam-example.xyz';",
  ...seeds.map((seed) => {
    const created = now - seed.hoursAgo * 3600;
    return `insert into contacts (name, email, category, message, status, admin_note, ip_hash, user_agent, created_at, updated_at, deleted_at) values (${sqlString(seed.name)}, ${sqlString(seed.email)}, ${sqlString(seed.category)}, ${sqlString(seed.message)}, ${sqlString(seed.status)}, ${sqlString(seed.adminNote)}, 'sample-ip-hash', 'SampleBrowser/1.0', ${created}, ${created}, null);`;
  }),
];

const file = new URL("./seed.generated.sql", import.meta.url);
await Bun.write(file, `${statements.join("\n")}\n`);
await $`wrangler d1 execute astro-site-dashboard-db --local --file=${file.pathname}`;
console.log("サンプルの問い合わせを 10 件入れました。");
