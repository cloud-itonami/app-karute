<script lang="ts">
  import type { SoapNoteRecord } from '../lib/api/types';
  import AssistPanel from './AssistPanel.svelte';

  interface Props {
    patientDid: string;
    encounterDid: string;
    authorDid: string;
    onSubmit: (record: SoapNoteRecord, signed: boolean) => Promise<void> | void;
  }

  const { patientDid, encounterDid, authorDid, onSubmit }: Props = $props();

  let subjective = $state('');
  let physicalExam = $state('');
  let assessmentItems = $state<Array<{ diagnosis: string; icd10: string; probabilityPercent: string; rationale: string }>>([
    { diagnosis: '', icd10: '', probabilityPercent: '', rationale: '' },
  ]);

  function applyAssessmentFromAssist(item: { diagnosis: string; icd10?: string; rationale?: string }) {
    // Replace first empty row or append a new one.
    const idx = assessmentItems.findIndex((a) => !a.diagnosis.trim());
    const row = {
      diagnosis: item.diagnosis,
      icd10: item.icd10 ?? '',
      probabilityPercent: '',
      rationale: item.rationale ?? '',
    };
    if (idx >= 0) {
      assessmentItems[idx] = row;
      assessmentItems = [...assessmentItems];
    } else {
      assessmentItems = [...assessmentItems, row];
    }
  }
  let patientEducation = $state('');
  let followUpDays = $state('');
  let followUpModality = $state<'in-person' | 'video' | 'phone' | 'home-visit' | 'asynchronous'>('in-person');
  let submitting = $state(false);
  let error = $state<string | null>(null);

  function addAssessment() {
    assessmentItems = [...assessmentItems, { diagnosis: '', icd10: '', probabilityPercent: '', rationale: '' }];
  }

  function removeAssessment(idx: number) {
    assessmentItems = assessmentItems.filter((_, i) => i !== idx);
  }

  async function save(signed: boolean) {
    error = null;
    if (!subjective.trim() && !physicalExam.trim() && assessmentItems.every(a => !a.diagnosis.trim())) {
      error = 'SOAP 4要素のうち最低1つは記入してください';
      return;
    }
    submitting = true;
    try {
      const now = new Date().toISOString();
      const rec: SoapNoteRecord = {
        fhirResourceType: 'Composition',
        compositionType: 'SOAP',
        patientDid,
        encounterDid,
        authorDid,
        subjective: subjective.trim(),
        objective: {
          physicalExam: physicalExam.trim(),
        },
        assessment: assessmentItems
          .filter(a => a.diagnosis.trim())
          .map((a) => ({
            diagnosis: a.diagnosis.trim(),
            icd10: a.icd10.trim() || undefined,
            probabilityPercent: a.probabilityPercent ? parseInt(a.probabilityPercent, 10) : undefined,
            rationale: a.rationale.trim() || undefined,
          })),
        plan: {
          patientEducation: patientEducation.trim() || undefined,
          followUp: followUpDays
            ? { intervalDays: parseInt(followUpDays, 10), modality: followUpModality }
            : undefined,
        },
        occurredAt: now,
        signedAt: signed ? now : undefined,
        createdAt: now,
      };
      await onSubmit(rec, signed);
    } catch (e) {
      error = e instanceof Error ? e.message : '送信失敗';
    } finally {
      submitting = false;
    }
  }
</script>

<form class="soap" onsubmit={(e) => { e.preventDefault(); save(false); }}>
  <section class="block s">
    <div class="hdr">
      <span class="letter">S</span>
      <span class="title">Subjective · 主観的訴え</span>
    </div>
    <textarea
      bind:value={subjective}
      placeholder="主訴・現病歴・既往歴・社会歴 (例: 「2日前から右下腹部痛、嘔気あり…」)"
      rows={5}
    ></textarea>
  </section>

  <section class="block o">
    <div class="hdr">
      <span class="letter">O</span>
      <span class="title">Objective · 身体所見</span>
    </div>
    <textarea
      bind:value={physicalExam}
      placeholder="身体所見 (バイタルは別途バイタルフォームで記録)"
      rows={4}
    ></textarea>
  </section>

  <AssistPanel
    {subjective}
    objective={physicalExam}
    onApplyAssessment={applyAssessmentFromAssist}
  />

  <section class="block a">
    <div class="hdr">
      <span class="letter">A</span>
      <span class="title">Assessment · 評価/鑑別</span>
      <button type="button" class="add" onclick={addAssessment}>+ 鑑別追加</button>
    </div>
    <div class="assessments">
      {#each assessmentItems as item, idx (idx)}
        <div class="ax">
          <div class="ax-row">
            <input
              type="text"
              placeholder="診断名 (例: 急性虫垂炎)"
              bind:value={item.diagnosis}
              class="flex"
            />
            <input
              type="text"
              placeholder="ICD-10 (K35.80)"
              bind:value={item.icd10}
              class="icd"
            />
            <input
              type="number"
              placeholder="%"
              bind:value={item.probabilityPercent}
              min="0"
              max="100"
              class="prob"
            />
            {#if assessmentItems.length > 1}
              <button type="button" class="rm" onclick={() => removeAssessment(idx)} aria-label="削除">×</button>
            {/if}
          </div>
          <input
            type="text"
            placeholder="rationale (なぜこの診断か)"
            bind:value={item.rationale}
            class="rationale"
          />
        </div>
      {/each}
    </div>
  </section>

  <section class="block p">
    <div class="hdr">
      <span class="letter">P</span>
      <span class="title">Plan · 治療計画</span>
    </div>
    <textarea
      bind:value={patientEducation}
      placeholder="患者指導内容"
      rows={3}
    ></textarea>
    <div class="followup">
      <label class="fu">
        <span>フォローアップ</span>
        <input type="number" bind:value={followUpDays} placeholder="日後" min="0" class="fu-days" />
        <select bind:value={followUpModality} class="fu-mod">
          <option value="in-person">対面</option>
          <option value="video">ビデオ</option>
          <option value="phone">電話</option>
          <option value="home-visit">往診</option>
          <option value="asynchronous">非同期</option>
        </select>
      </label>
      <div class="hint">処方・オーダーは Rx/Order タブから個別作成。Plan ブロックには自動的に AT URI が参照される。</div>
    </div>
  </section>

  {#if error}<div class="error">{error}</div>{/if}

  <div class="actions">
    <button type="button" class="draft" onclick={() => save(false)} disabled={submitting}>
      下書き保存
    </button>
    <button type="button" class="sign" onclick={() => save(true)} disabled={submitting}>
      署名して確定 (暗号化送信)
    </button>
  </div>
</form>

<style>
  .soap { display: flex; flex-direction: column; gap: 14px; }
  .block { display: flex; flex-direction: column; gap: 8px; padding: 12px; background: var(--gv2-bg-card); border: 1px solid var(--gv2-border); border-radius: 10px; }
  .hdr { display: flex; align-items: center; gap: 10px; }
  .letter {
    width: 28px; height: 28px;
    display: grid; place-items: center;
    border-radius: 6px;
    font-weight: 700; font-size: 14px;
    color: white;
  }
  .s .letter { background: #0ea5e9; }
  .o .letter { background: #8b5cf6; }
  .a .letter { background: #f59e0b; }
  .p .letter { background: #10b981; }
  .title { font-weight: 600; font-size: 13px; }
  .add {
    margin-left: auto;
    background: transparent;
    border: 1px dashed var(--gv2-border);
    border-radius: 6px;
    padding: 4px 8px;
    font-size: 11px;
    color: var(--gv2-text-secondary);
  }
  textarea, input, select {
    background: var(--gv2-bg-input);
    border: 1px solid var(--gv2-border);
    border-radius: 6px;
    padding: 8px 10px;
    color: var(--gv2-text-primary);
    font-size: 14px;
    width: 100%;
    box-sizing: border-box;
  }
  textarea { resize: vertical; font-family: inherit; }
  .assessments { display: flex; flex-direction: column; gap: 8px; }
  .ax { display: flex; flex-direction: column; gap: 4px; padding: 8px; background: var(--gv2-bg-input); border-radius: 6px; }
  .ax-row { display: flex; gap: 6px; align-items: center; }
  .flex { flex: 1; }
  .icd { width: 100px; }
  .prob { width: 60px; }
  .rationale { font-size: 12px; }
  .rm {
    background: transparent;
    border: 0;
    color: var(--gv2-text-muted);
    font-size: 18px;
    padding: 0 6px;
    cursor: pointer;
  }
  .followup { display: flex; flex-direction: column; gap: 6px; padding-top: 8px; border-top: 1px dashed var(--gv2-border); }
  .fu { display: flex; align-items: center; gap: 8px; font-size: 12px; color: var(--gv2-text-secondary); }
  .fu-days { width: 80px; }
  .fu-mod { width: 110px; }
  .hint { font-size: 11px; color: var(--gv2-text-muted); }
  .actions { display: flex; gap: 8px; padding-top: 4px; }
  .draft, .sign {
    flex: 1;
    padding: 12px;
    font-size: 14px;
    font-weight: 600;
    border: 0;
    border-radius: 10px;
  }
  .draft { background: var(--gv2-bg-input); color: var(--gv2-text-primary); border: 1px solid var(--gv2-border); }
  .sign { background: var(--gv2-accent); color: white; }
  .draft:disabled, .sign:disabled { opacity: 0.6; }
  .error { color: #dc2626; font-size: 12px; padding: 6px 10px; background: #fee2e2; border-radius: 6px; }
</style>
