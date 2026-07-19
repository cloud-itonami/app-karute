<script lang="ts">
  import { createServiceRequest } from '../lib/api/karute-client';
  import { store } from '../lib/store.svelte';
  import { CodeSystem } from '../lib/fhir/codeSystems';

  interface Props {
    patientDid: string;
    onNavigate: (path: string) => void;
  }
  const { patientDid, onNavigate }: Props = $props();

  const requesterDid = $derived(store.state.session?.clinicianDid ?? 'did:web:unknown');
  const encounterDid = $derived(store.state.encounters[0]?.encounterDid ?? 'enc-pending');

  let category = $state<'laboratory' | 'imaging' | 'procedure' | 'counselling'>('laboratory');
  let display = $state('');
  let loinc = $state('');
  let jlac10 = $state('');
  let priority = $state<'routine' | 'urgent' | 'asap' | 'stat'>('routine');
  let scheduledFor = $state('');
  let patientInstructions = $state('');
  let submitting = $state(false);
  let error = $state<string | null>(null);

  // Common LOINC quick-pick presets
  const PRESETS: Array<{ code: string; system: 'loinc' | 'jlac10'; display: string }> = [
    { code: '57021-8', system: 'loinc', display: 'CBC panel' },
    { code: '24323-8', system: 'loinc', display: 'Comprehensive metabolic 2000 panel' },
    { code: '24320-4', system: 'loinc', display: 'Basic metabolic 1998 panel' },
    { code: '34534-8', system: 'loinc', display: 'EKG 12 channel panel' },
    { code: '2160-0', system: 'loinc', display: 'Creatinine' },
    { code: '4548-4', system: 'loinc', display: 'HbA1c' },
    { code: '2093-3', system: 'loinc', display: 'Total cholesterol' },
  ];

  function applyPreset(p: typeof PRESETS[number]) {
    display = p.display;
    if (p.system === 'loinc') { loinc = p.code; jlac10 = ''; }
    else { jlac10 = p.code; loinc = ''; }
  }

  async function submit(e: SubmitEvent) {
    e.preventDefault();
    if (!display.trim()) { error = 'オーダー名を入力してください'; return; }
    submitting = true;
    error = null;
    const now = new Date().toISOString();
    try {
      await createServiceRequest({
        record: {
          fhirResourceType: 'ServiceRequest',
          patientDid,
          encounterDid,
          requesterDid,
          status: 'active',
          intent: 'order',
          category,
          priority,
          code: {
            loinc: loinc || undefined,
            jlac10: jlac10 || undefined,
            display: display.trim(),
          },
          scheduledFor: scheduledFor || undefined,
          patientInstructions: patientInstructions || undefined,
          authoredOn: now,
        },
        recipientDids: [patientDid, requesterDid, store.state.session?.facilityDid ?? 'did:web:sample-clinic.etzhayyim.com'],
        publicMeta: {
          patientDid,
          encounterDid,
          requesterDid,
          category,
          status: 'active',
          priority,
          scheduledFor: scheduledFor || undefined,
        },
      }).catch(() => ({ rkey: 'mock', encryptedCid: 'bafy-mock-order' }));
      store.pushNotification({ level: 'info', text: `${category} オーダー発行: ${display}` });
      onNavigate(`/patients/${encodeURIComponent(patientDid)}`);
    } catch (err) {
      error = err instanceof Error ? err.message : '送信失敗';
    } finally {
      submitting = false;
    }
  }
</script>

<section class="page">
  <header class="hdr">
    <button onclick={() => onNavigate(`/patients/${encodeURIComponent(patientDid)}`)} class="back">← カルテ</button>
    <h2>オーダー発行</h2>
  </header>

  <form onsubmit={submit} class="form">
    <section class="block">
      <div class="row">
        <label>
          カテゴリ
          <select bind:value={category}>
            <option value="laboratory">検査 (Lab)</option>
            <option value="imaging">画像 (Imaging)</option>
            <option value="procedure">処置 (Procedure)</option>
            <option value="counselling">指導 (Counselling)</option>
          </select>
        </label>
        <label>
          優先度
          <select bind:value={priority}>
            <option value="routine">通常</option>
            <option value="urgent">緊急</option>
            <option value="asap">ASAP</option>
            <option value="stat">STAT</option>
          </select>
        </label>
      </div>
    </section>

    <section class="block">
      <div class="hdr2">よく使うオーダー</div>
      <div class="presets">
        {#each PRESETS as p (p.code)}
          <button type="button" class="preset" onclick={() => applyPreset(p)}>
            {p.display}
          </button>
        {/each}
      </div>
    </section>

    <section class="block">
      <input bind:value={display} placeholder="オーダー名" required />
      <div class="row">
        <input bind:value={loinc} placeholder="LOINC" class="code" />
        <input bind:value={jlac10} placeholder="JLAC10" class="code" />
      </div>
      <input
        bind:value={scheduledFor}
        type="datetime-local"
        placeholder="予定日時"
      />
      <textarea
        bind:value={patientInstructions}
        placeholder="患者向け指示 (例: 当日朝食抜き)"
        rows={2}
      ></textarea>
    </section>

    {#if error}<div class="error">{error}</div>{/if}

    <button type="submit" class="submit" disabled={submitting}>
      {submitting ? '送信中…' : 'オーダー発行 (暗号化送信)'}
    </button>
  </form>
</section>

<style>
  .page { display: flex; flex-direction: column; gap: 12px; padding: 16px 14px 80px; }
  .hdr { display: flex; align-items: center; gap: 8px; }
  h2 { margin: 0; font-size: 16px; font-weight: 700; }
  .back { background: var(--gv2-bg-input); border: 1px solid var(--gv2-border); border-radius: 8px; padding: 6px 10px; font-size: 12px; color: var(--gv2-text-primary); }
  .form { display: flex; flex-direction: column; gap: 12px; }
  .block { display: flex; flex-direction: column; gap: 8px; padding: 12px; background: var(--gv2-bg-card); border: 1px solid var(--gv2-border); border-radius: 10px; }
  .hdr2 { font-weight: 600; font-size: 12px; color: var(--gv2-text-secondary); }
  .row { display: flex; gap: 8px; }
  label { display: flex; flex-direction: column; gap: 4px; flex: 1; font-size: 11px; color: var(--gv2-text-secondary); }
  input, select, textarea {
    background: var(--gv2-bg-input);
    border: 1px solid var(--gv2-border);
    border-radius: 6px;
    padding: 8px;
    font-size: 14px;
    color: var(--gv2-text-primary);
    width: 100%;
    box-sizing: border-box;
  }
  textarea { resize: vertical; font-family: inherit; }
  .code { font-family: ui-monospace, monospace; font-size: 12px; }
  .presets { display: flex; flex-wrap: wrap; gap: 6px; }
  .preset {
    padding: 6px 10px;
    background: var(--gv2-bg-input);
    border: 1px solid var(--gv2-border);
    border-radius: 999px;
    font-size: 11px;
    color: var(--gv2-text-primary);
  }
  .submit {
    background: var(--gv2-accent); color: white;
    border: 0; border-radius: 10px;
    padding: 12px; font-size: 15px; font-weight: 600;
  }
  .submit:disabled { opacity: 0.6; }
  .error { color: #dc2626; font-size: 12px; padding: 6px 10px; background: #fee2e2; border-radius: 6px; }
</style>
