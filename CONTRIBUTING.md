# 開発への参加

ランタイムは Bun です。Node.js ではスクリプトを実行しません。

```bash
bun install
bun run check
bun test
bun run build
bunx biome check .
```

フォーマットは `bun run format` です。ESLint と Prettier は使いません。

秘密とローカル D1 はコミットしないでください。`.env` と `.dev.vars` は ignore されています。サンプルの文面は、実在の事業者や人物に見えないものだけにします。
