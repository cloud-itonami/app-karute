<script lang="ts">
  import { fmtDateTime } from '../lib/util/format';

  const rooms = $state([
    { id: 'karute-encounters', label: '受診通知 (院内)', unread: 3, latest: '15:42 — 新規 SOAP (PHI redacted)' },
    { id: 'karute-orders', label: 'オーダー進行 (院内)', unread: 1, latest: '15:30 — Lab 完了通知' },
    { id: 'karute-alerts', label: '相互作用・禁忌アラート', unread: 0, latest: '14:08 — moderate flag override 記録' },
    { id: 'karute-referrals', label: '紹介状 inbox', unread: 2, latest: '13:45 — 連携先からの ack' },
    { id: 'karute-patient', label: '患者-医師 (E2E)', unread: 0, latest: '12:00 — フォローアップ確認' },
  ]);

  const messages = $state([
    { at: '2026-05-23T15:42:00Z', from: 'system', text: '🩺 SOAP 記録: 田中 (anon) — encounter cid bafy-mock-soap-a1 (PHI 内容は read-cap 保有者のみ閲覧可能)' },
    { at: '2026-05-23T15:30:00Z', from: 'system', text: '🧪 CBC panel 完了: 鈴木 (anon) — LOINC 57021-8 result Observation cid bafy-mock-obs-b1' },
    { at: '2026-05-23T14:08:00Z', from: 'system', text: '⚠ Rx interaction flag MODERATE override 記録: 監査ログ #aud-2026-05-23-014' },
  ]);
  let activeRoom = $state('karute-encounters');
  let draft = $state('');

  function send() {
    if (!draft.trim()) return;
    messages.unshift({ at: new Date().toISOString(), from: 'me', text: draft.trim() });
    draft = '';
  }
</script>

<section class="talk">
  <header class="hdr">
    <h2>Talk</h2>
    <div class="sub">Matrix protocol · E2E encrypted</div>
  </header>

  <div class="rooms">
    {#each rooms as r (r.id)}
      <button class="room" class:active={activeRoom === r.id} onclick={() => (activeRoom = r.id)}>
        <div class="label">{r.label}</div>
        <div class="latest">{r.latest}</div>
        {#if r.unread > 0}<span class="badge">{r.unread}</span>{/if}
      </button>
    {/each}
  </div>

  <div class="messages">
    {#each messages as m, i (i)}
      <div class="msg" class:mine={m.from === 'me'}>
        <div class="from">{m.from}</div>
        <div class="text">{m.text}</div>
        <div class="at">{fmtDateTime(m.at)}</div>
      </div>
    {/each}
  </div>

  <form class="composer" onsubmit={(e) => { e.preventDefault(); send(); }}>
    <input bind:value={draft} placeholder="メッセージ (PHI 記述禁止 — patient ref は cid pointer で)" />
    <button type="submit">送信</button>
  </form>
</section>

<style>
  .talk { display: flex; flex-direction: column; gap: 10px; padding: 16px 14px 80px; }
  .hdr h2 { margin: 0; font-size: 18px; font-weight: 700; }
  .sub { font-size: 11px; color: var(--gv2-text-muted); }
  .rooms { display: flex; flex-direction: column; gap: 6px; }
  .room {
    text-align: left;
    background: var(--gv2-bg-card);
    border: 1px solid var(--gv2-border);
    border-radius: 8px;
    padding: 10px;
    color: var(--gv2-text-primary);
    position: relative;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .room.active { border-color: var(--gv2-accent); background: rgba(14, 165, 233, 0.04); }
  .label { font-size: 13px; font-weight: 600; }
  .latest { font-size: 11px; color: var(--gv2-text-muted); }
  .badge {
    position: absolute; top: 10px; right: 10px;
    background: var(--gv2-accent); color: white;
    font-size: 10px; padding: 1px 6px; border-radius: 999px;
    font-weight: 600;
  }
  .messages { display: flex; flex-direction: column; gap: 8px; max-height: 280px; overflow-y: auto; padding: 8px; background: var(--gv2-bg-card); border: 1px solid var(--gv2-border); border-radius: 10px; }
  .msg { padding: 6px 8px; background: var(--gv2-bg-input); border-radius: 6px; font-size: 12px; }
  .msg.mine { background: rgba(14, 165, 233, 0.1); align-self: flex-end; max-width: 80%; }
  .from { font-size: 10px; color: var(--gv2-text-muted); font-weight: 600; }
  .text { margin: 2px 0; }
  .at { font-size: 9px; color: var(--gv2-text-muted); text-align: right; }
  .composer { display: flex; gap: 6px; }
  .composer input { flex: 1; background: var(--gv2-bg-input); border: 1px solid var(--gv2-border); border-radius: 8px; padding: 10px; font-size: 14px; color: var(--gv2-text-primary); }
  .composer button { background: var(--gv2-accent); color: white; border: 0; border-radius: 8px; padding: 0 16px; font-weight: 600; }
</style>
