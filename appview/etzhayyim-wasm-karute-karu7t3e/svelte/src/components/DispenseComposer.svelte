<script lang="ts">
  import { createDispense } from '../lib/api/karute-client';
  import { store } from '../lib/store.svelte';
  import { fmtDateTime, shortDid } from '../lib/util/format';
  import type { MedicationMeta } from '../lib/api/types';

  interface Props {
    rxMeta: MedicationMeta;
    onSubmit: () => void;
    onCancel: () => void;
  }
  const { rxMeta, onSubmit, onCancel }: Props = $props();

  const pharmacistDid = $derived(store.state.session?.clinicianDid ?? 'did:web:unknown');
  const pharmacyDid = $derived(store.state.session?.facilityDid ?? 'did:web:pharmacy.etzhayyim.com');

  let status = $state<'in-progress' | 'completed' | 'on-hold' | 'cancelled'>('completed');
  let quantityScaled = $state('');
  let quantityScale = $state<'1' | '10' | '100'>('1');
  let quantityUnit = $state('tablet');
  let daysSupply = $state('7');
  let substitutionPerformed = $state(false);
  let substitutionReason = $state('');
  let patientCounselling = $state('');
  let submitting = $state(false);
  let error = $state<string | null>(null);

  async function submit(e: SubmitEvent) {
    e.preventDefault();
    error = null;
    submitting = true;
    try {
      const now = new Date().toISOString();
      const qScale = parseInt(quantityScale, 10) as 1 | 10 | 100;
      const qScaled = quantityScaled ? Math.round(parseFloat(quantityScaled) * qScale) : undefined;
      await createDispense({
        record: {
          fhirResourceType: 'MedicationDispense',
          patientDid: '',  // Filled by server from rxMeta lookup
          medicationRequestUri: rxMeta.rkey,
          pharmacyDid,
          pharmacistDid,
          status,
          quantityDispensed: qScaled !== undefined ? { valueScaled: qScaled, scale: qScale, unit: quantityUnit } : undefined,
          daysSupply: daysSupply ? parseInt(daysSupply, 10) : undefined,
          whenPrepared: now,
          whenHandedOver: now,
          substitutionPerformed,
          substitutionReason: substitutionReason.trim() || undefined,
          patientCounselling: patientCounselling.trim() || undefined,
          createdAt: now,
        },
        recipientDids: [
          rxMeta.prescriberDid,
          pharmacistDid,
          pharmacyDid,
        ],
        publicMeta: {
          patientDid: '',  // Server resolves from rxMeta
          medicationRequestUri: rxMeta.rkey,
          pharmacyDid,
          pharmacistDid,
          status,
          whenHandedOver: now,
        },
      });
      store.pushNotification({ level: 'info', text: `調剤記録: ${rxMeta.rxnormSummary ?? rxMeta.yjCodeSummary ?? rxMeta.rkey}` });
      onSubmit();
    } catch (err) {
      error = err instanceof Error ? err.message : '送信失敗';
    } finally {
      submitting = false;
    }
  }
</script>

<form class="dc" onsubmit={submit}>
  <header class="hdr">
    <div class="title">調剤記録</div>
    <button type="button" class="close" onclick={onCancel} aria-label="閉じる">×</button>
  </header>

  <section class="block">
    <div class="rx-ctx">
      <div class="rx-line">処方元 Rx: <span class="mono">{rxMeta.rkey}</span></div>
      <div class="rx-line">処方医: {shortDid(rxMeta.prescriberDid, 8)}</div>
      <div class="rx-line">RxNorm/YJ: {rxMeta.rxnormSummary ?? rxMeta.yjCodeSummary ?? '—'}</div>
      <div class="rx-line">処方日: {fmtDateTime(rxMeta.authoredOn)}</div>
    </div>
  </section>

  <section class="block">
    <label>
      ステータス
      <select bind:value={status}>
        <option value="in-progress">準備中</option>
        <option value="completed">交付完了</option>
        <option value="on-hold">保留</option>
        <option value="cancelled">キャンセル</option>
      </select>
    </label>

    <div class="row">
      <label class="flex">
        交付数量
        <div class="qrow">
          <input bind:value={quantityScaled} type="number" step="0.1" class="num" />
          <select bind:value={quantityScale} class="scl">
            <option value="1">×1</option>
            <option value="10">×0.1</option>
            <option value="100">×0.01</option>
          </select>
          <select bind:value={quantityUnit} class="un">
            <option>tablet</option><option>capsule</option><option>mL</option>
            <option>g</option><option>vial</option><option>blister</option>
          </select>
        </div>
      </label>
      <label class="flex">
        日数
        <input bind:value={daysSupply} type="number" min="1" />
      </label>
    </div>
  </section>

  <section class="block">
    <label class="check">
      <input type="checkbox" bind:checked={substitutionPerformed} />
      後発品への変更を実施
    </label>
    {#if substitutionPerformed}
      <input
        bind:value={substitutionReason}
        placeholder="変更理由 (例: 在庫切れ / 後発品希望 / 価格)"
      />
    {/if}
  </section>

  <section class="block">
    <textarea
      bind:value={patientCounselling}
      placeholder="服薬指導 (患者に伝えた注意点 — 服用法・副作用・相互作用)"
      rows={3}
    ></textarea>
  </section>

  {#if error}<div class="error">{error}</div>{/if}

  <div class="actions">
    <button type="button" class="cancel" onclick={onCancel}>キャンセル</button>
    <button type="submit" class="submit" disabled={submitting}>
      {submitting ? '送信中…' : '交付を暗号化記録'}
    </button>
  </div>
</form>

<style>
  .dc { display: flex; flex-direction: column; gap: 12px; padding: 14px; background: var(--gv2-bg-card); border: 1px solid var(--gv2-border); border-radius: 12px; }
  .hdr { display: flex; justify-content: space-between; align-items: center; }
  .title { font-weight: 700; font-size: 15px; }
  .close { background: transparent; border: 0; font-size: 20px; color: var(--gv2-text-muted); cursor: pointer; }
  .block { display: flex; flex-direction: column; gap: 8px; }
  .rx-ctx { padding: 10px; background: var(--gv2-bg-input); border-radius: 8px; display: flex; flex-direction: column; gap: 4px; }
  .rx-line { font-size: 12px; color: var(--gv2-text-secondary); }
  .mono { font-family: ui-monospace, monospace; font-size: 11px; }
  label { display: flex; flex-direction: column; gap: 4px; font-size: 11px; color: var(--gv2-text-secondary); }
  .row { display: flex; gap: 8px; }
  .flex { flex: 1; }
  .qrow { display: flex; gap: 4px; }
  .num { width: 80px; }
  .scl, .un { flex: 1; min-width: 0; }
  input, select, textarea {
    background: var(--gv2-bg-input); border: 1px solid var(--gv2-border);
    border-radius: 6px; padding: 8px;
    font-size: 14px; color: var(--gv2-text-primary);
    width: 100%; box-sizing: border-box;
  }
  textarea { resize: vertical; font-family: inherit; }
  .check { flex-direction: row; align-items: center; gap: 8px; font-size: 13px; }
  .check input { width: auto; }
  .actions { display: flex; gap: 8px; padding-top: 4px; }
  .cancel, .submit { flex: 1; padding: 10px; font-size: 14px; font-weight: 600; border: 0; border-radius: 8px; }
  .cancel { background: var(--gv2-bg-input); border: 1px solid var(--gv2-border); color: var(--gv2-text-primary); }
  .submit { background: var(--gv2-accent); color: white; }
  .submit:disabled { opacity: 0.6; }
  .error { color: #dc2626; font-size: 12px; padding: 6px 10px; background: #fee2e2; border-radius: 6px; }
</style>
