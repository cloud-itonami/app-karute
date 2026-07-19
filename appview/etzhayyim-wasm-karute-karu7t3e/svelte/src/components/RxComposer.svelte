<script lang="ts">
  import type { MedicationRequestRecord } from '../lib/api/types';
  import InteractionAlert from './InteractionAlert.svelte';

  interface Props {
    patientDid: string;
    encounterDid: string;
    prescriberDid: string;
    onSubmit: (record: MedicationRequestRecord, override?: { reason: string }) => Promise<{
      blocked?: boolean;
      interactionFlags?: Array<{ severity?: 'minor' | 'moderate' | 'major' | 'contraindicated'; mechanism?: string; recommendation?: string; withMedicationRxnorm?: string }>;
    }>;
  }
  const { patientDid, encounterDid, prescriberDid, onSubmit }: Props = $props();

  let display = $state('');
  let rxnorm = $state('');
  let yjCode = $state('');
  let strengthValue = $state('');
  let strengthUnit = $state('mg');
  let form = $state<'tablet' | 'capsule' | 'syrup' | 'injection' | 'ointment'>('tablet');

  let doseValue = $state('');
  let doseUnit = $state('mg');
  let frequency = $state('3');
  let periodUnit = $state<'h' | 'd' | 'wk'>('d');
  let route = $state('PO');
  let asNeeded = $state(false);

  let supplyDays = $state('7');
  let substitutionAllowed = $state(true);

  let pendingFlags = $state<Array<{ severity?: 'minor' | 'moderate' | 'major' | 'contraindicated'; mechanism?: string; recommendation?: string; withMedicationRxnorm?: string }>>([]);
  let blocked = $state(false);
  let pendingRecord = $state<MedicationRequestRecord | null>(null);
  let submitting = $state(false);
  let error = $state<string | null>(null);
  let successId = $state<string | null>(null);

  function buildRecord(): MedicationRequestRecord {
    const now = new Date().toISOString();
    const sv = parseFloat(strengthValue);
    const dv = parseFloat(doseValue);
    return {
      fhirResourceType: 'MedicationRequest',
      patientDid,
      encounterDid,
      prescriberDid,
      status: 'active',
      intent: 'order',
      medication: {
        display: display.trim(),
        rxnorm: rxnorm.trim() || undefined,
        yjCode: yjCode.trim() || undefined,
        form,
        strength: !Number.isNaN(sv) ? { valueScaled: Math.round(sv * 10), scale: 10, unit: strengthUnit } : undefined,
      },
      dosageInstruction: [
        {
          text: `${doseValue}${doseUnit} ${frequency}回/${periodUnit === 'h' ? '時間' : periodUnit === 'd' ? '日' : '週'}${asNeeded ? ' 頓服' : ''}`,
          timing: { frequency: parseInt(frequency, 10), periodScaled: 1, periodScale: 1, periodUnit },
          route,
          doseQuantity: !Number.isNaN(dv) ? { valueScaled: Math.round(dv * 10), scale: 10, unit: doseUnit } : undefined,
          asNeeded,
        },
      ],
      dispenseRequest: supplyDays ? { supplyDurationDays: parseInt(supplyDays, 10) } : undefined,
      substitutionAllowed,
      authoredOn: now,
    };
  }

  async function submitRx(override?: { reason: string }) {
    error = null;
    successId = null;
    if (!display.trim()) {
      error = '医薬品名を入力してください';
      return;
    }
    const rec = override ? pendingRecord ?? buildRecord() : buildRecord();
    pendingRecord = rec;
    submitting = true;
    try {
      const result = await onSubmit(rec, override);
      if (result.blocked) {
        pendingFlags = result.interactionFlags ?? [];
        blocked = true;
      } else {
        pendingFlags = [];
        blocked = false;
        pendingRecord = null;
        successId = 'ok';
        resetForm();
      }
    } catch (e) {
      error = e instanceof Error ? e.message : '送信失敗';
    } finally {
      submitting = false;
    }
  }

  function resetForm() {
    display = ''; rxnorm = ''; yjCode = '';
    strengthValue = ''; doseValue = '';
    supplyDays = '7';
  }
</script>

<form class="rx" onsubmit={(e) => { e.preventDefault(); submitRx(); }}>
  <section class="block">
    <div class="hdr">💊 医薬品</div>
    <input bind:value={display} placeholder="医薬品名 (例: アムロジピン錠 5mg)" required class="med" />
    <div class="codes">
      <input bind:value={rxnorm} placeholder="RxNorm" class="code" />
      <input bind:value={yjCode} placeholder="YJ Code" class="code" />
    </div>
    <div class="strength">
      <input bind:value={strengthValue} type="number" step="0.1" placeholder="規格" class="num" />
      <select bind:value={strengthUnit} class="unit">
        <option>mg</option><option>mcg</option><option>g</option><option>mL</option><option>IU</option>
      </select>
      <select bind:value={form} class="form">
        <option value="tablet">錠</option>
        <option value="capsule">カプセル</option>
        <option value="syrup">シロップ</option>
        <option value="injection">注射</option>
        <option value="ointment">軟膏</option>
      </select>
    </div>
  </section>

  <section class="block">
    <div class="hdr">用法用量</div>
    <div class="dose">
      <span>1回</span>
      <input bind:value={doseValue} type="number" step="0.1" class="num" />
      <select bind:value={doseUnit} class="unit">
        <option>mg</option><option>mcg</option><option>g</option><option>mL</option>
      </select>
    </div>
    <div class="freq">
      <select bind:value={frequency} class="freq-n">
        {#each ['1', '2', '3', '4', '6'] as n}<option>{n}</option>{/each}
      </select>
      <span>回 /</span>
      <select bind:value={periodUnit} class="period">
        <option value="h">時間</option>
        <option value="d">日</option>
        <option value="wk">週</option>
      </select>
      <select bind:value={route} class="route">
        <option>PO</option><option>IV</option><option>IM</option><option>SC</option><option>topical</option><option>inhaled</option>
      </select>
    </div>
    <label class="check">
      <input type="checkbox" bind:checked={asNeeded} />
      頓服
    </label>
  </section>

  <section class="block">
    <div class="hdr">調剤指示</div>
    <div class="dispense">
      <label>
        日数
        <input bind:value={supplyDays} type="number" min="1" class="num" />
      </label>
      <label class="check">
        <input type="checkbox" bind:checked={substitutionAllowed} />
        後発品変更可
      </label>
    </div>
  </section>

  <InteractionAlert
    flags={pendingFlags}
    onOverride={blocked ? (reason) => submitRx({ reason }) : undefined}
    onCancel={blocked ? () => { pendingFlags = []; blocked = false; pendingRecord = null; } : undefined}
  />

  {#if error}<div class="error">{error}</div>{/if}
  {#if successId}<div class="ok">処方を暗号化送信しました</div>{/if}

  <button type="submit" class="submit" disabled={submitting || blocked}>
    {submitting ? '送信中…' : blocked ? '相互作用の確認待ち' : '処方発行 (暗号化送信)'}
  </button>
</form>

<style>
  .rx { display: flex; flex-direction: column; gap: 12px; }
  .block { display: flex; flex-direction: column; gap: 8px; padding: 12px; background: var(--gv2-bg-card); border: 1px solid var(--gv2-border); border-radius: 10px; }
  .hdr { font-weight: 600; font-size: 13px; color: var(--gv2-text-secondary); }
  input, select { background: var(--gv2-bg-input); border: 1px solid var(--gv2-border); border-radius: 6px; padding: 6px 8px; font-size: 14px; color: var(--gv2-text-primary); }
  .med { width: 100%; box-sizing: border-box; }
  .codes { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
  .code { font-family: ui-monospace, monospace; font-size: 12px; }
  .strength, .dose, .freq, .dispense { display: flex; gap: 6px; align-items: center; flex-wrap: wrap; }
  .num { width: 90px; }
  .unit, .form, .freq-n, .period, .route { width: auto; min-width: 70px; }
  .check { display: flex; gap: 6px; align-items: center; font-size: 13px; }
  .submit {
    background: var(--gv2-accent); color: white;
    border: 0; border-radius: 10px;
    padding: 12px; font-size: 15px; font-weight: 600;
  }
  .submit:disabled { opacity: 0.5; }
  .error { color: #dc2626; font-size: 12px; padding: 6px 10px; background: #fee2e2; border-radius: 6px; }
  .ok { color: #065f46; font-size: 12px; padding: 6px 10px; background: #d1fae5; border-radius: 6px; }
</style>
