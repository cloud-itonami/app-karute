# operator quickstart — app-karute

**所要 3 分。install も build も要らない。** この repo は今日
standalone では build できない（理由は下の Step 4）ので、この quickstart は
「build できるようにする手順」ではなく **「手元の checkout が健全か、
不変条件が守られているかを、依存ゼロで確かめる手順」** である。

下のコマンドは全て 2026-08-18 に実際に実行して出力を確認したもの。
**まだ通らない手順は Step 4 に「通らないこと」として書いてある** ——
書いてあるのに実行すると落ちる、という状態を作らないため。

前提: `git`・`node`（実測 v26.3.0）。`pnpm` は Step 4 でだけ使う。

---

## Step 0 — repo に入る

```bash
cd orgs/cloud-itonami/app-karute      # west checkout の場合
git rev-parse --is-shallow-repository # false であること
```

`true` なら ancestry の判定を信用しない（`git fetch --unshallow` で直す）。

## Step 1 — 何が入っているかを見る

```bash
git ls-files | wc -l                                    # 56
git ls-files | grep -v '^appview/' | sort               # メタデータと文書 8 件
```

期待される出力:

```
CLAUDE.md
NOTICE
OWNERS
PROJECT.jsonld
README.edn
README.md
docs/operator-quickstart.md
migration.edn
```

残り 48 ファイルは全て
`appview/etzhayyim-wasm-karute-karu7t3e/svelte/` の下にある UI 一式。
**この repo に backend も lexicon も無い**（`orgs/cloud-itonami/karute` に在る）。

## Step 2 — PHI 不変条件を確かめる（最重要・依存ゼロ）

plaintext PHI は `@etzhayyim/sdk` の `encryptedWrite()` 以外から
ネットワークに出てはいけない。実装上これは `fetch(` の出現箇所が
`karute-client.ts` 1 本に閉じていることで守られている。

```bash
cd appview/etzhayyim-wasm-karute-karu7t3e/svelte
grep -rn "fetch(" src/ | awk -F: '{print $1}' | sort | uniq -c
```

期待される出力（実測 2026-08-18）:

```
   2 src/lib/api/karute-client.ts
```

**`karute-client.ts` 以外のファイルが 1 行でも出たら、そこで止めて
レビューする。** PHI が平文のまま body に載る経路ができた可能性がある。

## Step 3 — actor identity が 3 箇所で一致しているか

DID / nanoid は `PROJECT.jsonld`・`CLAUDE.md`・実際の API ホスト名の
3 箇所に書かれている。ずれると deploy 先を間違える。

```bash
cd -                                  # repo root へ戻る
grep -oh 'did:web:[a-z.]*' PROJECT.jsonld CLAUDE.md | sort -u
grep -oh 'karu7t3e'        PROJECT.jsonld CLAUDE.md | sort -u
```

期待される出力（実測 2026-08-18）—— **どちらも 1 行であること。**
2 行出たら 2 つの identity が混在している:

```
did:web:karute.etzhayyim.com
karu7t3e
```

## Step 4 — build を試すと何が起きるか（**通らない**）

`CLAUDE.md` は次を指示しているが、**この repo 単体では Step 1 の install で止まる。**

```bash
cd appview/etzhayyim-wasm-karute-karu7t3e/svelte
pnpm install
```

実測 2026-08-18 の出力:

```
 ERR_PNPM_WORKSPACE_PKG_NOT_FOUND  In : "@etzhayyim/design-system@workspace:*"
 is in the dependencies but no package named "@etzhayyim/design-system"
 is present in the workspace
```

`pnpm dev` / `pnpm build` / `pnpm check` / `pnpm test` は全て
node_modules を必要とするので、ここから先へ進めない。**時間を溶かす前に
ここで止まること。**

### なぜ通らないのか（3 本とも実測で確認できる）

抽出時に monorepo への参照が 3 本残っている。次の 1 コマンドで全部見える:

```bash
node -e '
const {resolve}=require("node:path"), {existsSync}=require("node:fs");
const S="appview/etzhayyim-wasm-karute-karu7t3e/svelte";
const tw=resolve(S,"../../../../../packages/ts/design-system/dist");
const ROOT=resolve(S,"tests","../../../../../..");
console.log("[1] workspace dep :", require("./"+S+"/package.json").dependencies["@etzhayyim/design-system"]);
console.log("[2] tailwind glob :", tw, existsSync(tw)?"PRESENT":"ABSENT");
console.log("[3] tests ROOT    :", ROOT, existsSync(ROOT+"/00-contracts")?"PRESENT":"ABSENT");
'
```

実測 2026-08-18（repo を `/tmp/maturity-app-karute` に置いた場合）:

```
[1] workspace dep : workspace:*
[2] tailwind glob : /private/packages/ts/design-system/dist ABSENT
[3] tests ROOT    : /private ABSENT
```

`[2]` と `[3]` の解決先が **repo の外**（しかも clone 先に依存して動く）
ことに注意する。`[3]` の `ROOT` は
`70-tools/scripts/lint/karute-phi-plaintext-guard.mjs` と
`00-contracts/lexicons/com/etzhayyim/{apps/karute,karute,consent,encrypted,audit}`
を要求するが、どちらもこの repo には無い。

### 直す順序

**1 → 3 → 2。** install が通らない限り test も build も走らせて確かめられない
ので、依存解決が先。

1. `@etzhayyim/design-system` を解決可能にする。実体は
   `orgs/kotoba-lang/svelte-design-system`（package 名は一致）。ただし
   `dist/` は commit されておらず `files: ["dist"]` / `build: svelte-package`
   なので、**git URL に差し替えるだけでは dist が無いまま入る**
   （`prepublishOnly` は git 依存では走らない）。publish するか、
   `prepare` を持たせるか、plugin を vendor するかの判断が要る。
2. `tests/*.test.ts` の `ROOT` を repo root に付け替え、fixture
   （phi-guard スクリプトと lexicon）をこの repo に持ち込むか、
   `orgs/cloud-itonami/karute` を参照する形にする。
   なお `lexicon-shape.test.ts` は `lexicons.length > 20` を期待するが、
   `etzhayyim/root` 側の `com/etzhayyim/karute/` に在る lexicon は 11 本、
   `apps/karute/` は**存在しない** —— 移設先を決めるときに件数の前提も
   見直すこと。
3. `tailwind.config.js` の content glob を実在パスに変える。
   `etzhayyim/root` の `packages/ts/design-system` は既に無い（実測）。

**2026-08-18 時点でどれも未着手。** 着手したらこの節を書き換える
（この workspace の文書は最新状態のみを表し、履歴は git が持つ）。

---

## 関連

- backend / lexicon / アーキテクチャの正本: `orgs/cloud-itonami/karute`
- 抽出元: `etzhayyim/root` の `60-apps/etzhayyim-project-karute`
  （revision は `migration.edn` の `:source-revision`）
- design system: `orgs/kotoba-lang/svelte-design-system`（`@etzhayyim/design-system`）
