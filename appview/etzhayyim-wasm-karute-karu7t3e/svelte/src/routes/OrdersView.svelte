<script lang="ts">
  import { store } from '../lib/store.svelte';
  import { fmtDateTime, shortDid } from '../lib/util/format';

  interface Props {
    onNavigate: (path: string) => void;
  }
  const { onNavigate }: Props = $props();

  // Mock unified queue for Phase 1 — production would aggregate across patients via a server-side query.
  const queue = $state([
    { id: 'o1', kind: 'laboratory', display: 'CBC panel', loinc: '57021-8', status: 'pending', priority: 'urgent', scheduled: '2026-05-23T11:00:00Z', patientAlias: '田中 (anon)' },
    { id: 'o2', kind: 'imaging', display: 'Chest X-ray PA', loinc: '36572-6', status: 'pending', priority: 'routine', scheduled: '2026-05-23T14:00:00Z', patientAlias: '佐藤 (anon)' },
    { id: 'o3', kind: 'procedure', display: '創傷処置', status: 'in-progress', priority: 'routine', scheduled: '2026-05-23T09:30:00Z', patientAlias: '鈴木 (anon)' },
    { id: 'o4', kind: 'laboratory', display: 'HbA1c', loinc: '4548-4', status: 'pending', priority: 'routine', scheduled: '2026-05-23T15:00:00Z', patientAlias: '高橋 (anon)' },
    { id: 'o5', kind: 'rx-cosign', display: 'ワルファリン 1mg 増量 (NP発行→MD共同署名)', status: 'pending', priority: 'urgent', scheduled: '', patientAlias: '田中 (anon)' },
  ]);

  let activeTab = $state<'all' | 'lab' | 'imaging' | 'procedure' | 'rx'>('all');

  const filtered = $derived(queue.filter((o) => {
    if (activeTab === 'all') return true;
    if (activeTab === 'rx') return o.kind === 'rx-cosign';
    if (activeTab === 'lab') return o.kind === 'laboratory';
    if (activeTab === 'imaging') return o.kind === 'imaging';
    if (activeTab === 'procedure') return o.kind === 'procedure';
    return true;
  }));
</script>

<section class="page">
  <header class="hdr">
    <h2>オーダー追跡</h2>
    <div class="counter">{filtered.length} 件</div>
  </header>

  <nav class="tabs">
    {#each ['all', 'lab', 'imaging', 'procedure', 'rx'] as t (t)}
      <button class:active={activeTab === t} onclick={() => (activeTab = t as typeof activeTab)} type="button">
        {t === 'all' ? '全て' : t === 'lab' ? '検査' : t === 'imaging' ? '画像' : t === 'procedure' ? '処置' : 'Rx共同署名'}
      </button>
    {/each}
  </nav>

  <ul class="orders">
    {#each filtered as o (o.id)}
      <li class="order prio-{o.priority} status-{o.status}">
        <div class="row top">
          <span class="kind">{o.kind}</span>
          <span class="prio">{o.priority}</span>
          <span class="status">{o.status}</span>
        </div>
        <div class="title">{o.display}</div>
        {#if o.loinc}<div class="code">LOINC {o.loinc}</div>{/if}
        <div class="row meta">
          <span>{o.patientAlias}</span>
          {#if o.scheduled}<span>{fmtDateTime(o.scheduled)}</span>{/if}
        </div>
      </li>
    {:else}
      <li class="empty">該当オーダーなし</li>
    {/each}
  </ul>
</section>

<style>
  .page { display: flex; flex-direction: column; gap: 12px; padding: 16px 14px 80px; }
  .hdr { display: flex; justify-content: space-between; align-items: center; }
  h2 { margin: 0; font-size: 18px; font-weight: 700; }
  .counter { font-size: 11px; color: var(--gv2-text-muted); }
  .tabs { display: flex; gap: 6px; overflow-x: auto; padding-bottom: 4px; }
  .tabs button {
    flex-shrink: 0;
    background: var(--gv2-bg-input);
    border: 1px solid var(--gv2-border);
    border-radius: 999px;
    padding: 6px 12px;
    font-size: 12px;
    color: var(--gv2-text-primary);
  }
  .tabs button.active { background: var(--gv2-accent); color: white; border-color: var(--gv2-accent); }
  .orders { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 8px; }
  .order {
    padding: 10px 12px;
    background: var(--gv2-bg-card);
    border: 1px solid var(--gv2-border);
    border-radius: 10px;
    border-left: 4px solid var(--gv2-border);
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .order.prio-urgent { border-left-color: #f59e0b; }
  .order.prio-stat { border-left-color: #dc2626; }
  .order.status-in-progress { background: rgba(14, 165, 233, 0.04); }
  .row { display: flex; gap: 8px; align-items: center; font-size: 11px; color: var(--gv2-text-muted); }
  .row.top { justify-content: flex-start; }
  .row.meta { justify-content: space-between; margin-top: 2px; }
  .kind, .prio, .status {
    padding: 1px 6px;
    border-radius: 4px;
    background: var(--gv2-bg-input);
    color: var(--gv2-text-secondary);
    font-weight: 500;
    font-size: 10px;
    text-transform: capitalize;
  }
  .title { font-size: 14px; font-weight: 600; }
  .code { font-family: ui-monospace, monospace; font-size: 10px; color: var(--gv2-text-muted); }
  .empty { padding: 32px; text-align: center; color: var(--gv2-text-muted); font-size: 13px; }
</style>
