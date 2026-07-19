# etzhayyim-project-karute — 電子カルテ EMR

actor: `did:web:karute.etzhayyim.com` (nanoid `karu7t3e`).

See `orgs/etzhayyim/com-etzhayyim-karute/CLAUDE.md` for the authoritative architecture doc.
This file documents the Svelte SuperApp UI only.

## Build

```bash
cd appview/etzhayyim-wasm-karute-karu7t3e/svelte
pnpm install
pnpm dev      # local dev server
pnpm build    # production bundle → dist/
pnpm check    # svelte-check type errors
```

## UI shape

- **Mobile-first**, `max-w-[600px]` 内側
- **SuperAppTabBar** (固定下部): Home / Chart / Orders / Talk
- **Sidebar 禁止**
- Svelte 5 runes (`$state`, `$derived`, `$effect`) で state
- 簡易ルーター (`hashchange`-based) — SvelteKit を使わない

## PHI handling rule (CRITICAL)

App code は plaintext PHI を **絶対に** XRPC body に直書きしてはいけない。
`@etzhayyim/sdk` の `encryptedWrite()` を介してのみ書く。

Phase 1 では `lib/api/karute-client.ts` が encrypted-write 呼び出しを抽象化する。
PHI plaintext が `karute-client` の外で `fetch()` body に乗らないことを review で確認。
