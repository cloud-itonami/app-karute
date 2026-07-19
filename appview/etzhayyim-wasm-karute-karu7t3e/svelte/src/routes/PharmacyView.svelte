<script lang="ts">
  import { listMedications, listDispenses } from '../lib/api/karute-client';
  import { store } from '../lib/store.svelte';
  import { fmtDateTime, shortDid } from '../lib/util/format';
  import type { MedicationMeta, DispenseMeta } from '../lib/api/types';
  import DispenseComposer from '../components/DispenseComposer.svelte';

  // PharmacyView is the role=PHARM landing page. Lists pending MedicationRequests
  // (status=active) across all patients the pharmacy has read-cap for, and the
  // running dispense log.

  interface Props {
    onNavigate: (path: string) => void;
  }
  const { onNavigate }: Props = $props();

  let activeTab = $state<'queue' | 'recent'>('queue');
  let queue = $state<MedicationMeta[]>([]);
  let recent = $state<DispenseMeta[]>([]);
  let loading = $state(true);
  let composing = $state<MedicationMeta | null>(null);

  $effect(() => { void load(); });

  async function load() {
    loading = true;
    try {
      const [meds, disp] = await Promise.allSettled([
        listMedications('', { status: 'active', limit: 50 }),
        listDispenses({ pharmacyDid: store.state.session?.facilityDid, limit: 50 }),
      ]);
      if (meds.status === 'fulfilled') queue = meds.value.items;
      if (disp.status === 'fulfilled') recent = disp.value.items;
    } finally {
      // Phase 1 mock fallback
      if (queue.length === 0) {
        queue = [
          { rkey: 'rx1', encryptedCid: 'bafy-mock-rx-a1', prescriberDid: 'did:web:dr-yamada.etzhayyim.com', status: 'active', rxnormSummary: '197361', yjCodeSummary: '2149011F1099', interactionSeverityMax: '', authoredOn: '2026-05-22T09:30:00Z' },
          { rkey: 'rx2', encryptedCid: 'bafy-mock-rx-a2', prescriberDid: 'did:web:dr-tanaka.etzhayyim.com', status: 'active', rxnormSummary: '617314', yjCodeSummary: '6132403F2049', interactionSeverityMax: 'minor', authoredOn: '2026-05-23T10:15:00Z' },
          { rkey: 'rx3', encryptedCid: 'bafy-mock-rx-a3', prescriberDid: 'did:web:dr-yamada.etzhayyim.com', status: 'active', rxnormSummary: '11289', yjCodeSummary: '3399100F1027', interactionSeverityMax: '', authoredOn: '2026-05-23T11:00:00Z' },
        ];
      }
      if (recent.length === 0) {
        recent = [
          { rkey: 'd1', encryptedCid: 'bafy-mock-d-a1', patientDid: 'did:plc:abc1tanaka', medicationRequestUri: 'rx0', pharmacyDid: 'did:web:pharmacy.etzhayyim.com', pharmacistDid: 'did:web:ph-suzuki.etzhayyim.com', status: 'completed', whenHandedOver: '2026-05-23T08:45:00Z' },
        ];
      }
      loading = false;
    }
  }
</script>

<section class="pharm">
  <header class="hdr">
    <h2>調剤キュー</h2>
    <div class="sub">{store.state.session?.facilityDid?.replace('did:web:', '') ?? '—'}</div>
  </header>

  <nav class="tabs">
    <button class:active={activeTab === 'queue'} onclick={() => (activeTab = 'queue')}>
      未調剤 <span class="cnt">{queue.length}</span>
    </button>
    <button class:active={activeTab === 'recent'} onclick={() => (activeTab = 'recent')}>
      交付済 <span class="cnt">{recent.length}</span>
    </button>
  </nav>

  {#if loading}
    <div class="loading">読込中…</div>
  {:else if activeTab === 'queue'}
    <ul class="rxlist">
      {#each queue as rx (rx.rkey)}
        <li class="rxrow">
          <div class="meta">
            <div class="med">{rx.rxnormSummary ?? rx.yjCodeSummary ?? rx.rkey}</div>
            <div class="mini">
              prescriber {shortDid(rx.prescriberDid, 8)} · {fmtDateTime(rx.authoredOn)}
              {#if rx.interactionSeverityMax}
                <span class="iflag sev-{rx.interactionSeverityMax}">⚠ {rx.interactionSeverityMax}</span>
              {/if}
            </div>
          </div>
          <button class="dispense" onclick={() => (composing = rx)} type="button">調剤</button>
        </li>
      {:else}
        <li class="empty">調剤待ちなし</li>
      {/each}
    </ul>

    {#if composing}
      <div
        class="overlay"
        role="dialog"
        aria-modal="true"
        aria-label="調剤記録"
        onclick={(e) => { if (e.target === e.currentTarget) composing = null; }}
        onkeydown={(e) => { if (e.key === 'Escape') composing = null; }}
        tabindex="-1"
      >
        <DispenseComposer
          rxMeta={composing}
          onSubmit={() => { composing = null; void load(); }}
          onCancel={() => (composing = null)}
        />
      </div>
    {/if}
  {:else}
    <ul class="rxlist">
      {#each recent as d (d.rkey)}
        <li class="rxrow">
          <div class="meta">
            <div class="med">Dispense {d.rkey}</div>
            <div class="mini">
              source Rx {d.medicationRequestUri} · status <span class="badge st-{d.status}">{d.status}</span>
              · {fmtDateTime(d.whenHandedOver)}
            </div>
          </div>
        </li>
      {:else}
        <li class="empty">最近の交付なし</li>
      {/each}
    </ul>
  {/if}
</section>

<style>
  .pharm { display: flex; flex-direction: column; gap: 12px; padding: 16px 14px 80px; }
  .hdr h2 { margin: 0; font-size: 18px; font-weight: 700; }
  .sub { font-size: 11px; color: var(--gv2-text-muted); margin-top: 2px; }
  .tabs { display: flex; gap: 6px; }
  .tabs button {
    flex: 1; padding: 10px;
    background: var(--gv2-bg-input);
    border: 1px solid var(--gv2-border);
    border-radius: 8px;
    color: var(--gv2-text-primary);
    font-size: 13px;
    font-weight: 600;
  }
  .tabs button.active { background: var(--gv2-accent); color: white; border-color: var(--gv2-accent); }
  .cnt { font-size: 11px; padding: 1px 6px; border-radius: 999px; background: rgba(255,255,255,0.15); margin-left: 4px; }
  .loading { padding: 32px; text-align: center; color: var(--gv2-text-muted); }
  .rxlist { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 8px; }
  .rxrow {
    display: flex; gap: 10px; align-items: center; justify-content: space-between;
    padding: 10px 12px;
    background: var(--gv2-bg-card);
    border: 1px solid var(--gv2-border);
    border-radius: 10px;
  }
  .meta { flex: 1; min-width: 0; }
  .med { font-weight: 600; font-size: 13px; font-family: ui-monospace, monospace; }
  .mini { font-size: 11px; color: var(--gv2-text-muted); margin-top: 2px; display: flex; gap: 6px; align-items: center; flex-wrap: wrap; }
  .iflag { font-size: 10px; padding: 1px 6px; border-radius: 4px; color: white; font-weight: 600; }
  .iflag.sev-minor { background: #0ea5e9; }
  .iflag.sev-moderate { background: #f59e0b; }
  .iflag.sev-major { background: #dc2626; }
  .iflag.sev-contraindicated { background: #7f1d1d; }
  .badge { padding: 1px 6px; border-radius: 4px; font-size: 10px; }
  .badge.st-completed { background: #d1fae5; color: #065f46; }
  .badge.st-on-hold { background: #fef3c7; color: #92400e; }
  .badge.st-cancelled { background: #fee2e2; color: #991b1b; }
  .dispense {
    background: var(--gv2-accent); color: white;
    border: 0; border-radius: 8px;
    padding: 8px 12px; font-size: 12px; font-weight: 600;
  }
  .empty { padding: 32px; text-align: center; color: var(--gv2-text-muted); font-size: 13px; }
  .overlay {
    position: fixed; inset: 0;
    background: rgba(15, 23, 42, 0.5);
    z-index: 50;
    display: flex; align-items: flex-end; justify-content: center;
    padding: 16px;
  }
</style>
