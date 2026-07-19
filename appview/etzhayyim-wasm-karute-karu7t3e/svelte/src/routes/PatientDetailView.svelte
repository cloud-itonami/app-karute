<script lang="ts">
  import { listEncounters, listObservations, listMedications, listOrders, getChartSummary } from '../lib/api/karute-client';
  import { store } from '../lib/store.svelte';
  import { fmtDateTime, shortDid, severityRank } from '../lib/util/format';
  import Timeline from '../components/Timeline.svelte';

  interface Props {
    patientDid: string;
    onNavigate: (path: string) => void;
  }
  const { patientDid, onNavigate }: Props = $props();

  let loading = $state(true);
  let summary = $state<Awaited<ReturnType<typeof getChartSummary>> | null>(null);

  $effect(() => {
    store.selectPatient(patientDid);
    void loadAll();
  });

  async function loadAll() {
    loading = true;
    try {
      const [enc, obs, meds, ords, sum] = await Promise.allSettled([
        listEncounters(patientDid, { limit: 20 }),
        listObservations(patientDid, { limit: 30 }),
        listMedications(patientDid, { limit: 30 }),
        listOrders(patientDid, { limit: 30 }),
        getChartSummary(patientDid, 100),
      ]);
      if (enc.status === 'fulfilled') store.setEncounters(enc.value.items);
      if (obs.status === 'fulfilled') store.setObservations(obs.value.items);
      if (meds.status === 'fulfilled') store.setMedications(meds.value.items);
      if (ords.status === 'fulfilled') store.setOrders(ords.value.items);
      if (sum.status === 'fulfilled') {
        summary = sum.value;
        store.setChartSummary(sum.value);
      } else {
        // Mock fallback
        const mockSummary = {
          summary: 'バックエンド未接続 — モック表示。本番では public meta から PHI を含まない 200 字以内のサマリが返ります。',
          stats: { encountersTotal: 3, activeConditions: 2, activeMedications: 4, pendingOrders: 1, interactionFlagsMaxSeverity: 'minor' as const },
          timeline: [
            { innerType: 'com.etzhayyim.karute.encounter', rkey: 'enc1', encryptedCid: 'bafy-mock-enc-a1', occurredAt: '2026-05-22T09:00:00Z' },
            { innerType: 'com.etzhayyim.karute.soapNote', rkey: 'soap1', encryptedCid: 'bafy-mock-soap-a1', occurredAt: '2026-05-22T09:15:00Z' },
            { innerType: 'com.etzhayyim.karute.observation', rkey: 'obs1', encryptedCid: 'bafy-mock-obs-a1', occurredAt: '2026-05-22T09:05:00Z' },
            { innerType: 'com.etzhayyim.karute.medicationRequest', rkey: 'rx1', encryptedCid: 'bafy-mock-rx-a1', occurredAt: '2026-05-22T09:30:00Z' },
            { innerType: 'com.etzhayyim.karute.condition', rkey: 'cond1', encryptedCid: 'bafy-mock-cond-a1', occurredAt: '2026-05-22T09:20:00Z' },
          ],
        };
        summary = mockSummary;
        store.setChartSummary(mockSummary);
        store.setEncounters([
          { rkey: 'enc1', encounterDid: 'enc1', encryptedCid: 'bafy-mock-enc-a1', occurredAt: '2026-05-22T09:00:00Z', encounterClass: 'ambulatory', department: '内科', facilityDid: 'did:web:sample-clinic.etzhayyim.com' },
        ]);
        store.setMedications([
          { rkey: 'rx1', encryptedCid: 'bafy-mock-rx-a1', prescriberDid: 'did:web:dr-yamada.etzhayyim.com', status: 'active', rxnormSummary: '197361', yjCodeSummary: '2149011F1099', interactionSeverityMax: '', authoredOn: '2026-05-22T09:30:00Z' },
        ]);
      }
    } finally {
      loading = false;
    }
  }

  function exportFhir() {
    alert('FHIR R5 Bundle export: encrypted.read で全 inner record を復号後、fhirBundle.ts で組み立て、application/fhir+json でダウンロード。Phase 1 では SDK 完成待ち。');
  }
</script>

<section class="detail">
  <header class="hdr">
    <button class="back" onclick={() => onNavigate('/patients')} aria-label="戻る">← 一覧</button>
    <div class="who">
      <div class="alias">患者カルテ</div>
      <div class="did">{shortDid(patientDid, 14)}</div>
    </div>
    <button class="export" onclick={exportFhir} title="FHIR R5 Bundle">📤 FHIR</button>
  </header>

  {#if loading}
    <div class="loading">読込中…</div>
  {:else}
    {#if summary}
      <section class="card summary">
        <div class="card-hdr">AI サマリ <span class="redact">PHI redacted</span></div>
        <p class="ai">{summary.summary}</p>
        <div class="stat-row">
          <div class="stat"><span>受診</span><strong>{summary.stats.encountersTotal}</strong></div>
          <div class="stat"><span>活動病名</span><strong>{summary.stats.activeConditions}</strong></div>
          <div class="stat"><span>処方</span><strong>{summary.stats.activeMedications}</strong></div>
          <div class="stat"><span>未処理</span><strong>{summary.stats.pendingOrders}</strong></div>
        </div>
        {#if summary.stats.interactionFlagsMaxSeverity}
          <div class="alert sev-{summary.stats.interactionFlagsMaxSeverity}">
            相互作用フラグ最大重要度: {summary.stats.interactionFlagsMaxSeverity}
          </div>
        {/if}
      </section>
    {/if}

    <nav class="actbar">
      <button onclick={() => onNavigate(`/patients/${encodeURIComponent(patientDid)}/soap`)}>📝 SOAP</button>
      <button onclick={() => onNavigate(`/patients/${encodeURIComponent(patientDid)}/vitals`)}>📊 バイタル</button>
      <button onclick={() => onNavigate(`/patients/${encodeURIComponent(patientDid)}/rx`)}>💊 処方</button>
      <button onclick={() => onNavigate(`/patients/${encodeURIComponent(patientDid)}/order`)}>📋 オーダー</button>
    </nav>

    <section class="card">
      <div class="card-hdr">タイムライン</div>
      <Timeline items={summary?.timeline ?? []} />
    </section>

    <section class="card">
      <div class="card-hdr">活動処方</div>
      <ul class="meds">
        {#each store.state.medications as m (m.rkey)}
          <li>
            <div class="med-line">
              <span class="display">{m.rxnormSummary || m.yjCodeSummary || 'RxNorm/YJ encoded'}</span>
              {#if m.interactionSeverityMax}
                <span class="sev sev-{m.interactionSeverityMax}">⚠ {m.interactionSeverityMax}</span>
              {/if}
            </div>
            <div class="mini">prescriber {shortDid(m.prescriberDid, 8)} · {fmtDateTime(m.authoredOn)}</div>
          </li>
        {:else}
          <li class="empty-li">処方なし</li>
        {/each}
      </ul>
    </section>
  {/if}
</section>

<style>
  .detail { display: flex; flex-direction: column; gap: 12px; padding: 16px 14px 80px; }
  .hdr { display: flex; gap: 8px; align-items: center; }
  .back { background: var(--gv2-bg-input); border: 1px solid var(--gv2-border); border-radius: 8px; padding: 6px 10px; font-size: 12px; color: var(--gv2-text-primary); }
  .who { flex: 1; }
  .alias { font-weight: 700; font-size: 16px; }
  .did { font-family: ui-monospace, monospace; font-size: 11px; color: var(--gv2-text-muted); }
  .export { background: var(--gv2-bg-input); border: 1px solid var(--gv2-border); border-radius: 8px; padding: 6px 10px; font-size: 12px; }
  .loading { padding: 32px; text-align: center; color: var(--gv2-text-muted); }
  .card { background: var(--gv2-bg-card); border: 1px solid var(--gv2-border); border-radius: 12px; padding: 12px; display: flex; flex-direction: column; gap: 10px; }
  .card-hdr { display: flex; justify-content: space-between; align-items: center; font-weight: 600; font-size: 13px; }
  .summary .ai { font-size: 13px; line-height: 1.5; margin: 0; color: var(--gv2-text-secondary); }
  .redact { font-size: 10px; padding: 2px 6px; border-radius: 4px; background: #fef3c7; color: #92400e; font-weight: 500; }
  .stat-row { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; }
  .stat { display: flex; flex-direction: column; align-items: center; padding: 6px; background: var(--gv2-bg-input); border-radius: 8px; }
  .stat span { font-size: 10px; color: var(--gv2-text-muted); }
  .stat strong { font-size: 18px; font-weight: 700; }
  .alert { padding: 6px 10px; border-radius: 6px; font-size: 12px; font-weight: 500; }
  .alert.sev-minor { background: #e0f2fe; color: #075985; }
  .alert.sev-moderate { background: #fef3c7; color: #92400e; }
  .alert.sev-major { background: #fee2e2; color: #991b1b; }
  .alert.sev-contraindicated { background: #fecaca; color: #7f1d1d; }
  .actbar { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; }
  .actbar button {
    padding: 14px 4px;
    background: var(--gv2-bg-card);
    border: 1px solid var(--gv2-border);
    border-radius: 10px;
    font-size: 12px;
    font-weight: 500;
    color: var(--gv2-text-primary);
  }
  .meds { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 8px; }
  .meds li { padding: 8px; background: var(--gv2-bg-input); border-radius: 6px; }
  .med-line { display: flex; justify-content: space-between; align-items: center; }
  .display { font-weight: 500; font-size: 13px; font-family: ui-monospace, monospace; }
  .sev { font-size: 10px; padding: 1px 6px; border-radius: 4px; }
  .sev.sev-minor { background: #e0f2fe; color: #075985; }
  .sev.sev-moderate { background: #fef3c7; color: #92400e; }
  .sev.sev-major { background: #fee2e2; color: #991b1b; }
  .sev.sev-contraindicated { background: #fecaca; color: #7f1d1d; }
  .mini { font-size: 10px; color: var(--gv2-text-muted); margin-top: 2px; }
  .empty-li { padding: 12px; text-align: center; color: var(--gv2-text-muted); font-size: 12px; }
</style>
