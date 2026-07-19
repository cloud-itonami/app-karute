<script lang="ts">
  import { VITALS, interpretVital, formatScaled, type VitalKey, type Interpretation } from '../lib/fhir/vitals';

  interface Props {
    onSubmit: (records: Array<{
      key: VitalKey;
      loincCode: string;
      system: string;
      display: string;
      valueScaled: number;
      scale: 1 | 10 | 100;
      unit: string;
      interpretation: Interpretation;
    }>) => Promise<void> | void;
  }
  const { onSubmit }: Props = $props();

  let inputs = $state<Partial<Record<VitalKey, string>>>({});
  let submitting = $state(false);
  let error = $state<string | null>(null);

  const ORDER: VitalKey[] = ['bpSystolic', 'bpDiastolic', 'heartRate', 'respiratoryRate', 'temperature', 'spo2', 'weight', 'height'];

  function parseScaled(raw: string | undefined, scale: 1 | 10 | 100): number | null {
    if (!raw) return null;
    const f = parseFloat(raw);
    if (Number.isNaN(f)) return null;
    return Math.round(f * scale);
  }

  function interpretFor(key: VitalKey): Interpretation | null {
    const spec = VITALS[key];
    const v = parseScaled(inputs[key], spec.scale);
    return v === null ? null : interpretVital(spec, v);
  }

  async function submit(e: SubmitEvent) {
    e.preventDefault();
    error = null;
    const records: Array<Parameters<typeof onSubmit>[0][number]> = [];
    for (const key of ORDER) {
      const spec = VITALS[key];
      const valueScaled = parseScaled(inputs[key], spec.scale);
      if (valueScaled === null) continue;
      records.push({
        key,
        loincCode: spec.loincCode,
        system: spec.system,
        display: spec.display,
        valueScaled,
        scale: spec.scale,
        unit: spec.unit,
        interpretation: interpretVital(spec, valueScaled),
      });
    }
    if (records.length === 0) {
      error = '少なくとも1つのバイタルを入力してください';
      return;
    }
    submitting = true;
    try {
      await onSubmit(records);
      inputs = {};
    } catch (err) {
      error = err instanceof Error ? err.message : '送信失敗';
    } finally {
      submitting = false;
    }
  }
</script>

<form onsubmit={submit} class="form">
  <div class="grid">
    {#each ORDER as key (key)}
      {@const spec = VITALS[key]}
      {@const i = interpretFor(key)}
      <label class="field" class:critical={i === 'critical-low' || i === 'critical-high'} class:abnormal={i === 'low' || i === 'high'}>
        <div class="hdr">
          <span class="name">{spec.displayJa}</span>
          {#if i}<span class="badge {i}">{i}</span>{/if}
        </div>
        <div class="inputrow">
          <input
            type="number"
            step={spec.scale === 1 ? '1' : spec.scale === 10 ? '0.1' : '0.01'}
            placeholder="—"
            bind:value={inputs[key]}
            aria-label={spec.displayJa}
          />
          <span class="unit">{spec.unit}</span>
        </div>
        {#if spec.defaultRefRange}
          <div class="ref">基準: {formatScaled(spec.defaultRefRange.low ?? 0, spec.scale)}–{formatScaled(spec.defaultRefRange.high ?? 0, spec.scale)} {spec.unit}</div>
        {/if}
      </label>
    {/each}
  </div>

  {#if error}<div class="error">{error}</div>{/if}

  <button type="submit" class="submit" disabled={submitting}>
    {submitting ? '送信中…' : '記録 (暗号化送信)'}
  </button>
  <div class="footnote">送信時に各バイタルが個別 Observation record として `com.etzhayyim.encrypted.record` envelope に保存されます。</div>
</form>

<style>
  .form { display: flex; flex-direction: column; gap: 12px; }
  .grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
  }
  .field {
    display: flex; flex-direction: column; gap: 4px;
    padding: 10px;
    background: var(--gv2-bg-card);
    border: 1px solid var(--gv2-border);
    border-radius: 8px;
    transition: border-color 120ms;
  }
  .field.abnormal { border-color: #f59e0b; }
  .field.critical { border-color: #dc2626; background: rgba(220, 38, 38, 0.04); }
  .hdr { display: flex; justify-content: space-between; align-items: center; }
  .name { font-size: 12px; font-weight: 600; color: var(--gv2-text-secondary); }
  .badge {
    font-size: 9px; text-transform: uppercase; letter-spacing: 0.05em;
    padding: 1px 6px; border-radius: 999px;
    font-weight: 600;
  }
  .badge.normal { background: #d1fae5; color: #065f46; }
  .badge.low, .badge.high { background: #fef3c7; color: #92400e; }
  .badge.critical-low, .badge.critical-high { background: #fecaca; color: #7f1d1d; }
  .inputrow { display: flex; align-items: baseline; gap: 6px; }
  .inputrow input {
    flex: 1; min-width: 0;
    background: var(--gv2-bg-input);
    border: 1px solid var(--gv2-border);
    border-radius: 6px;
    padding: 6px 8px;
    font-size: 16px;
    color: var(--gv2-text-primary);
  }
  .unit { font-size: 11px; color: var(--gv2-text-muted); }
  .ref { font-size: 10px; color: var(--gv2-text-muted); }
  .submit {
    background: var(--gv2-accent);
    color: white;
    border: 0;
    border-radius: 10px;
    padding: 12px 16px;
    font-size: 15px;
    font-weight: 600;
  }
  .submit:disabled { opacity: 0.6; }
  .footnote { font-size: 11px; color: var(--gv2-text-muted); text-align: center; }
  .error { color: #dc2626; font-size: 12px; padding: 6px 10px; background: #fee2e2; border-radius: 6px; }
</style>
