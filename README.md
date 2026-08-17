# app-karute — karute EMR の appview（Svelte SuperApp UI）

**この repo が持っているのは UI だけである。** 電子カルテ（EMR）の
ドメインモデル・lexicon・サーバ側実装は持っていない。ここに在るのは
`karute.etzhayyim.com` に配信される Svelte 5 の single-page bundle
一式（`appview/etzhayyim-wasm-karute-karu7t3e/svelte/`）と、
移行メタデータ 5 ファイルだけ。

| | |
|---|---|
| actor DID | `did:web:karute.etzhayyim.com`（nanoid `karu7t3e`） |
| UI | https://karute.etzhayyim.com |
| API | https://karu7t3e.etzhayyim.com/xrpc |
| tier | T1（`PROJECT.jsonld`） |
| 出自 | `etzhayyim/root` の `60-apps/etzhayyim-project-karute`（`migration.edn` の `:source-revision be0c17bb`） |

## 最近接 repo との境界

**`orgs/cloud-itonami/karute` が backend であり、契約の正本でもある。**
FHIR R5 互換のドメイン（Patient / Encounter / SOAP / Observation /
Condition / MedicationRequest / ServiceRequest）と 11 本の lexicon
（`lex/*.edn`）はそちらに在る。アーキテクチャの正本は
`orgs/cloud-itonami/karute/CLAUDE.md`。

⚠ **この repo の `CLAUDE.md` はその正本を `orgs/etzhayyim/com-etzhayyim-karute/CLAUDE.md`
という古いパスで指している。そのパスは west.yml に無く、checkout も存在しない**
（実測 2026-08-18）。repo は `cloud-itonami/karute` に改名済みで、GitHub
リダイレクトは効くがローカルのパス参照は解決しない。

## 何を呼んでいるか

`src/lib/api/karute-client.ts` が XRPC で叩く手続きは 16 本:

```
createPatient  createSoapNote  createObservation  createMedicationRequest
createServiceRequest  createDispense  grantConsent  requestIryoBilling
listPatients  listEncounters  listSoapNotes  listObservations
listMedications  listOrders  listDispenses  getChartSummary
```

暗号化と同意は `com.etzhayyim.encrypted.record` / `.keyWrap` /
`com.etzhayyim.consent.capability` を経由する。

## 画面

hash ベースの自前ルータ（`src/lib/router.svelte.ts`、SvelteKit は使わない）。
mobile-first、`SuperAppTabBar` 固定下部、sidebar 無し。

| hash | view |
|---|---|
| `#/` | Home |
| `#/patients` | 患者一覧 |
| `#/patients/:did` | 患者詳細 |
| `#/patients/:did/{soap,rx,vitals,order}` | SOAP / 処方 / バイタル / オーダ |
| `#/orders` `#/pharmacy` `#/portal` `#/zaitaku` `#/talk` | オーダ / 薬局 / 患者ポータル / 在宅 / Talk |

## PHI の不変条件（CRITICAL）

**plaintext の PHI を XRPC の body に直接載せてはいけない。**
`@etzhayyim/sdk` の `encryptedWrite()` を通す。実装上これは
「`fetch(` が `src/lib/api/karute-client.ts` の外に出てこない」という
形で守られている。install も build も要らずに確かめられる:

```bash
cd appview/etzhayyim-wasm-karute-karu7t3e/svelte
grep -rn "fetch(" src/ | awk -F: '{print $1}' | sort | uniq -c
#   2 src/lib/api/karute-client.ts   ← この 1 ファイル以外が出たら違反
```

実測 2026-08-18: 2 件、いずれも `karute-client.ts`。**不変条件は成立している。**

## この repo は今日 standalone では build できない

抽出時に monorepo への結合が 3 本残っており、`CLAUDE.md` に書かれた
`pnpm install` → `pnpm build` は**この repo 単体では通らない**。
再現手順と実測した失敗は `docs/operator-quickstart.md` に書いてある。
要約すると:

| # | 結合 | 症状（実測 2026-08-18） |
|---|---|---|
| 1 | `package.json` の `"@etzhayyim/design-system": "workspace:*"` | `ERR_PNPM_WORKSPACE_PKG_NOT_FOUND` で install が止まる。実体は `orgs/kotoba-lang/svelte-design-system` に在るが、`dist/` は commit されておらず `svelte-package` での build が要る |
| 2 | `tailwind.config.js` の content glob `../../../../../packages/ts/design-system/dist/**` | repo の外へ出る。`etzhayyim/root` 側にも `packages/ts/design-system` はもう無い |
| 3 | `tests/*.test.ts` の `ROOT = resolve(__dirname, '../../../../../..')` | repo の外へ出る（clone 先が `/tmp/x` なら `/private`）。`70-tools/scripts/lint/karute-phi-plaintext-guard.mjs` と `00-contracts/lexicons/...` を要求するが、どちらもこの repo に無い |

**これは「壊れている」のではなく「まだ切り離されていない」。** 3 本とも
`etzhayyim/root` の中では解決していた参照で、抽出がパスだけを運んだ結果
repo 境界を跨いだまま残っている。

直すなら順序は 1 → 3 → 2（install が通らないと test も build も走らせて
確かめられない）。1 は design-system を publish するか `dist` を持つ git 参照に
変えるか vendor する、3 は fixture をこの repo に持ち込むか `ROOT` を
repo root に付け替える。**まだどれも着手していない。**

## ライセンス

Apache-2.0 + etzhayyim Charter Compliance Rider v3.1（`NOTICE`）。
