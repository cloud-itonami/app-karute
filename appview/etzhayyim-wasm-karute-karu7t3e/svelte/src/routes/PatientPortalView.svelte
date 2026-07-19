<script lang="ts">
  import { onMount } from 'svelte';
  import { listEncounters, listMedications, listObservations, listOrders, listDispenses, getChartSummary, grantConsent } from '../lib/api/karute-client';
  import { store } from '../lib/store.svelte';
  import { fmtDateTime, shortDid } from '../lib/util/format';
  import Timeline from '../components/Timeline.svelte';
  import { assembleBundle } from '../lib/fhir/exportBundle';
  import type { ConsentCapabilityMeta } from '../lib/api/types';

  // PatientPortalView is the role=PATIENT landing. The patient DID is the
  // logged-in actor; everything below is "self-view" — encrypted timeline,
  // FHIR Bundle export to an external EHR, consent capability management.

  interface Props {
    onNavigate: (path: string) => void;
  }
  const { onNavigate }: Props = $props();

  const selfDid = $derived(store.state.session?.clinicianDid ?? '');

  let loading = $state(true);
  let summary = $state<Awaited<ReturnType<typeof getChartSummary>> | null>(null);
  let exporting = $state(false);
  let downloadUrl = $state<string | null>(null);
  let grantingConsent = $state(false);
  let consentTarget = $state('did:web:cardiology-clinic-example.etzhayyim.com');
  let consentPurpose = $state<ConsentCapabilityMeta['purpose']>('second-opinion');
  let consentScope = $state(['com.etzhayyim.karute.condition', 'com.etzhayyim.karute.medicationRequest']);
  let consentDays = $state('30');

  // Mock fixture data — Phase 1 fallback.
  const granted = $state<ConsentCapabilityMeta[]>([
    {
      capabilityUri: 'at://did:plc:self/com.etzhayyim.consent.capability/abc123',
      granterDid: 'did:plc:self',
      granteeDid: 'did:web:dr-yamada.etzhayyim.com',
      scope: ['com.etzhayyim.karute.*'],
      purpose: 'second-opinion',
      status: 'active',
      issuedAt: '2026-04-01T00:00:00Z',
      expiresAt: '2026-10-01T00:00:00Z',
    },
    {
      capabilityUri: 'at://did:plc:self/com.etzhayyim.consent.capability/def456',
      granterDid: 'did:plc:self',
      granteeDid: 'did:web:iryo.etzhayyim.com',
      scope: ['com.etzhayyim.karute.encounter', 'com.etzhayyim.karute.serviceRequest'],
      purpose: 'insurance-billing',
      status: 'active',
      issuedAt: '2026-05-22T00:00:00Z',
      expiresAt: '2026-08-22T00:00:00Z',
    },
  ]);

  onMount(() => { void load(); });

  async function load() {
    loading = true;
    try {
      const sum = await getChartSummary(selfDid).catch(() => null);
      if (sum) {
        summary = sum;
      } else {
        summary = {
          summary: '自分のカルテ・タイムライン (mock データ — 本番接続時は public meta から自動生成).',
          stats: { encountersTotal: 5, activeConditions: 2, activeMedications: 3, pendingOrders: 1, interactionFlagsMaxSeverity: 'minor' as const },
          timeline: [
            { innerType: 'com.etzhayyim.karute.encounter', rkey: 'enc1', encryptedCid: 'bafy-mock-enc-x1', occurredAt: '2026-05-20T10:00:00Z' },
            { innerType: 'com.etzhayyim.karute.condition', rkey: 'cond1', encryptedCid: 'bafy-mock-cond-x1', occurredAt: '2026-05-20T10:15:00Z' },
            { innerType: 'com.etzhayyim.karute.medicationRequest', rkey: 'rx1', encryptedCid: 'bafy-mock-rx-x1', occurredAt: '2026-05-20T10:30:00Z' },
            { innerType: 'com.etzhayyim.karute.observation', rkey: 'obs1', encryptedCid: 'bafy-mock-obs-x1', occurredAt: '2026-05-20T10:05:00Z' },
            { innerType: 'com.etzhayyim.karute.encounter', rkey: 'enc2', encryptedCid: 'bafy-mock-enc-x2', occurredAt: '2026-04-12T14:00:00Z' },
          ],
        };
      }
    } finally {
      loading = false;
    }
  }

  async function exportBundle() {
    exporting = true;
    try {
      // PHASE 1 STUB: real flow calls /xrpc/.../exportFhirBundle which returns
      // envelopes for the patient to decrypt locally via @etzhayyim/sdk.encryptedRead.
      // After decrypt, the Bundle assembler turns each inner record into FHIR R5.
      // Here we synthesize a minimal Bundle from the public-meta timeline so the
      // download/preview UX is exercisable.
      const bundle = assembleBundle(
        (summary?.timeline ?? []).map((t) => ({
          fullUrl: `urn:uuid:${t.rkey}`,
          resource: {
            resourceType: t.innerType.split('.').pop(),
            id: t.rkey,
            meta: {
              source: t.encryptedCid,
              extension: [
                { url: 'https://etzhayyim.com/fhir/extension/encrypted', valueBoolean: true },
                { url: 'https://etzhayyim.com/fhir/extension/innerType', valueUri: t.innerType },
                { url: 'https://etzhayyim.com/fhir/extension/occurredAt', valueDateTime: t.occurredAt },
              ],
            },
          },
        })),
      );
      const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/fhir+json' });
      if (downloadUrl) URL.revokeObjectURL(downloadUrl);
      downloadUrl = URL.createObjectURL(blob);
    } finally {
      exporting = false;
    }
  }

  async function grant() {
    grantingConsent = true;
    try {
      const expiresAt = new Date(Date.now() + parseInt(consentDays, 10) * 86400 * 1000).toISOString();
      await grantConsent({
        granterDid: selfDid,
        granteeDid: consentTarget,
        scope: consentScope,
        expiresAt,
        purpose: consentPurpose,
      }).catch(() => ({ capabilityUri: 'at://mock', capabilityCid: 'bafy-mock' }));
      granted.push({
        capabilityUri: `at://did:plc:self/com.etzhayyim.consent.capability/${crypto.randomUUID().slice(0, 13)}`,
        granterDid: selfDid,
        granteeDid: consentTarget,
        scope: consentScope,
        purpose: consentPurpose,
        status: 'active',
        issuedAt: new Date().toISOString(),
        expiresAt,
      });
      store.pushNotification({ level: 'info', text: `${consentPurpose} の同意 capability を発行しました` });
    } finally {
      grantingConsent = false;
    }
  }

  function revoke(uri: string) {
    const idx = granted.findIndex((c) => c.capabilityUri === uri);
    if (idx >= 0) {
      granted[idx] = { ...granted[idx], status: 'revoked' };
      store.pushNotification({ level: 'warning', text: '同意 capability を取り消しました' });
    }
  }
</script>

<section class="portal">
  <header class="hdr">
    <div>
      <h2>マイカルテ</h2>
      <div class="sub">{shortDid(selfDid, 14)} · Patient</div>
    </div>
  </header>

  {#if loading || !summary}
    <div class="loading">読込中…</div>
  {:else}
    <section class="card summary">
      <div class="card-hdr">概要 <span class="redact">PHI redacted</span></div>
      <p class="ai">{summary.summary}</p>
      <div class="stat-row">
        <div class="stat"><span>受診</span><strong>{summary.stats.encountersTotal}</strong></div>
        <div class="stat"><span>活動病名</span><strong>{summary.stats.activeConditions}</strong></div>
        <div class="stat"><span>処方</span><strong>{summary.stats.activeMedications}</strong></div>
        <div class="stat"><span>未処理</span><strong>{summary.stats.pendingOrders}</strong></div>
      </div>
    </section>

    <section class="card">
      <div class="card-hdr">タイムライン</div>
      <Timeline items={summary.timeline} />
    </section>

    <section class="card">
      <div class="card-hdr">FHIR R5 エクスポート</div>
      <p class="hint">
        他の医療機関に転送できる FHIR R5 Bundle を生成します。
        ファイルは <span class="mono">application/fhir+json</span> 形式。
        プライバシー: Bundle は本人の端末上で復号・組み立てされます (PHI はサーバを経由しません)。
      </p>
      <div class="row">
        <button class="export" onclick={exportBundle} disabled={exporting} type="button">
          {exporting ? '生成中…' : '📤 Bundle 生成'}
        </button>
        {#if downloadUrl}
          <a href={downloadUrl} download={`karute-bundle-${new Date().toISOString().slice(0,10)}.json`} class="dl">↓ Download</a>
        {/if}
      </div>
    </section>

    <section class="card">
      <div class="card-hdr">同意 capability 発行</div>
      <p class="hint">
        特定の医療機関・連携サービスに、自分のカルテへの read-cap (期限付き) を渡します。
        いつでも取り消し可能。
      </p>
      <div class="form">
        <label>
          発行先 DID
          <input bind:value={consentTarget} placeholder="did:web:..." />
        </label>
        <label>
          目的
          <select bind:value={consentPurpose}>
            <option value="second-opinion">セカンドオピニオン</option>
            <option value="insurance-billing">保険請求 (iryo.etzhayyim.com)</option>
            <option value="data-portability">データ可搬性 (他 EHR への移行)</option>
            <option value="research-deidentified">研究 (de-identified データのみ)</option>
          </select>
        </label>
        <label>
          有効日数
          <input type="number" min="1" max="365" bind:value={consentDays} />
        </label>
        <button class="grant" onclick={grant} disabled={grantingConsent} type="button">
          {grantingConsent ? '発行中…' : '同意 capability を発行'}
        </button>
      </div>
    </section>

    <section class="card">
      <div class="card-hdr">発行済み capability</div>
      <ul class="caps">
        {#each granted as c (c.capabilityUri)}
          <li class="cap" class:revoked={c.status === 'revoked'}>
            <div class="cap-row">
              <span class="grantee">{shortDid(c.granteeDid, 12)}</span>
              <span class="purpose">{c.purpose}</span>
              <span class="status st-{c.status}">{c.status}</span>
            </div>
            <div class="cap-meta">
              <span>有効: {fmtDateTime(c.issuedAt)} → {fmtDateTime(c.expiresAt)}</span>
            </div>
            <div class="cap-scope">scope: {c.scope.join(', ')}</div>
            {#if c.status === 'active'}
              <button class="revoke" onclick={() => revoke(c.capabilityUri)} type="button">取消</button>
            {/if}
          </li>
        {:else}
          <li class="empty">発行済みなし</li>
        {/each}
      </ul>
    </section>
  {/if}
</section>

<style>
  .portal { display: flex; flex-direction: column; gap: 12px; padding: 16px 14px 80px; }
  .hdr h2 { margin: 0; font-size: 18px; font-weight: 700; }
  .sub { font-size: 11px; color: var(--gv2-text-muted); margin-top: 2px; font-family: ui-monospace, monospace; }
  .loading { padding: 32px; text-align: center; color: var(--gv2-text-muted); }
  .card { background: var(--gv2-bg-card); border: 1px solid var(--gv2-border); border-radius: 12px; padding: 12px; display: flex; flex-direction: column; gap: 10px; }
  .card-hdr { display: flex; justify-content: space-between; align-items: center; font-weight: 600; font-size: 13px; }
  .summary .ai { font-size: 13px; line-height: 1.5; margin: 0; color: var(--gv2-text-secondary); }
  .redact { font-size: 10px; padding: 2px 6px; border-radius: 4px; background: #fef3c7; color: #92400e; font-weight: 500; }
  .stat-row { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; }
  .stat { display: flex; flex-direction: column; align-items: center; padding: 6px; background: var(--gv2-bg-input); border-radius: 8px; }
  .stat span { font-size: 10px; color: var(--gv2-text-muted); }
  .stat strong { font-size: 18px; font-weight: 700; }
  .hint { font-size: 11px; color: var(--gv2-text-muted); margin: 0; line-height: 1.5; }
  .mono { font-family: ui-monospace, monospace; padding: 1px 4px; background: var(--gv2-bg-input); border-radius: 3px; font-size: 10px; }
  .row { display: flex; gap: 8px; align-items: center; }
  .export, .grant {
    background: var(--gv2-accent); color: white;
    border: 0; border-radius: 8px;
    padding: 10px 14px; font-size: 13px; font-weight: 600;
  }
  .export:disabled, .grant:disabled { opacity: 0.6; }
  .dl {
    color: var(--gv2-accent);
    text-decoration: none;
    font-size: 13px; font-weight: 600;
    padding: 10px 14px;
    border: 1px solid var(--gv2-accent);
    border-radius: 8px;
  }
  .form { display: flex; flex-direction: column; gap: 8px; }
  label { display: flex; flex-direction: column; gap: 4px; font-size: 11px; color: var(--gv2-text-secondary); }
  input, select {
    background: var(--gv2-bg-input);
    border: 1px solid var(--gv2-border);
    border-radius: 6px;
    padding: 8px;
    font-size: 13px;
    color: var(--gv2-text-primary);
  }
  .caps { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 8px; }
  .cap {
    padding: 10px;
    background: var(--gv2-bg-input);
    border-radius: 8px;
    border-left: 3px solid var(--gv2-accent);
    display: flex; flex-direction: column; gap: 4px;
    position: relative;
  }
  .cap.revoked { opacity: 0.5; border-left-color: var(--gv2-text-muted); }
  .cap-row { display: flex; gap: 6px; align-items: center; flex-wrap: wrap; }
  .grantee { font-family: ui-monospace, monospace; font-size: 11px; font-weight: 600; }
  .purpose { font-size: 11px; padding: 1px 6px; background: var(--gv2-bg-card); border-radius: 4px; color: var(--gv2-text-secondary); }
  .status { font-size: 10px; padding: 1px 6px; border-radius: 4px; font-weight: 600; margin-left: auto; }
  .status.st-active { background: #d1fae5; color: #065f46; }
  .status.st-revoked { background: #fee2e2; color: #991b1b; }
  .status.st-expired { background: #f1f5f9; color: #475569; }
  .cap-meta, .cap-scope { font-size: 10px; color: var(--gv2-text-muted); }
  .revoke {
    margin-top: 4px;
    background: transparent;
    border: 1px solid var(--gv2-border);
    border-radius: 6px;
    padding: 4px 10px;
    font-size: 11px;
    color: var(--gv2-text-secondary);
    align-self: flex-end;
  }
  .empty { padding: 16px; text-align: center; color: var(--gv2-text-muted); font-size: 12px; }
</style>
