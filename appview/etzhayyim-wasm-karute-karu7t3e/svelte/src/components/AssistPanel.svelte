<script lang="ts">
  import { runHeuristicAssist, runLlmAssist, mergeAssistResults, type AssistSuggestion, type AssistResult } from '../lib/assist/soapAssist';

  interface Props {
    subjective: string;
    objective?: string;
    onApplyAssessment: (item: { diagnosis: string; icd10?: string; rationale?: string }) => void;
  }
  const { subjective, objective, onApplyAssessment }: Props = $props();

  const heuristicResult = $derived(runHeuristicAssist({ subjective, objective }));

  let llmEnabled = $state(false);
  let llmResult = $state<AssistResult | null>(null);
  let llmStatus = $state<string>('');
  let llmLoading = $state(false);

  const result = $derived(mergeAssistResults(heuristicResult, llmResult));

  async function toggleLlm() {
    llmEnabled = !llmEnabled;
    if (!llmEnabled) {
      llmResult = null;
      llmStatus = '';
      return;
    }
    llmLoading = true;
    llmStatus = 'モデル読み込み中…';
    try {
      llmResult = await runLlmAssist(
        { subjective, objective },
        {
          enabled: true,
          onProgress: (msg) => (llmStatus = msg),
        },
      );
      if (!llmResult) {
        llmStatus = llmStatus || '利用不可 — heuristic のみ';
      } else {
        llmStatus = `WebLLM ${llmResult.suggestions.length}件 提案`;
      }
    } finally {
      llmLoading = false;
    }
  }

  const grouped = $derived.by(() => {
    const byField: Record<AssistSuggestion['field'], AssistSuggestion[]> = {
      subjective: [], assessment: [], plan: [],
    };
    for (const s of result.suggestions) byField[s.field].push(s);
    return byField;
  });

  let expanded = $state(false);

  const empty = $derived(
    result.suggestions.length === 0 &&
    result.vitalMentions.length === 0 &&
    result.abbreviationsSpotted.length === 0,
  );
</script>

{#if !empty}
  <div class="assist" class:expanded>
    <button class="head" onclick={() => (expanded = !expanded)} type="button">
      <span class="icon">🧠</span>
      <span class="title">
        On-device assist · {result.suggestions.length}件のヒント
        {#if result.vitalMentions.length > 0}· 🩺 {result.vitalMentions.length}{/if}
        {#if result.abbreviationsSpotted.length > 0}· 📝 {result.abbreviationsSpotted.length}{/if}
      </span>
      <span class="chev">{expanded ? '▾' : '▸'}</span>
    </button>
    {#if expanded}
      <div class="body">
        {#if grouped.assessment.length > 0}
          <section>
            <div class="lbl">鑑別候補</div>
            <ul class="suggestions">
              {#each grouped.assessment as s (s.id)}
                <li>
                  <button
                    class="apply"
                    onclick={() => onApplyAssessment({ diagnosis: s.insert, icd10: s.icd10, rationale: s.rationale })}
                    type="button"
                  >
                    + {s.label}
                  </button>
                  <span class="rationale">{s.rationale}</span>
                </li>
              {/each}
            </ul>
          </section>
        {/if}

        {#if grouped.subjective.length > 0}
          <section>
            <div class="lbl">主訴フラグ</div>
            <ul class="flags">
              {#each grouped.subjective as s (s.id)}
                <li class="flag">{s.label}<span class="why">{s.rationale}</span></li>
              {/each}
            </ul>
          </section>
        {/if}

        {#if result.vitalMentions.length > 0}
          <section>
            <div class="lbl">バイタル記述検出</div>
            <ul class="vitals">
              {#each result.vitalMentions as v (v.raw + v.matchIndex)}
                <li>
                  <span class="mono">{v.raw}</span>
                  <span class="loinc">{v.label} / LOINC {v.loinc}</span>
                </li>
              {/each}
            </ul>
            <div class="vital-hint">VitalsForm から個別 Observation として記録すると検査タイムラインに乗ります。</div>
          </section>
        {/if}

        {#if result.abbreviationsSpotted.length > 0}
          <section>
            <div class="lbl">略語展開</div>
            <ul class="abbr">
              {#each result.abbreviationsSpotted as a (a.short)}
                <li><b>{a.short}</b> = {a.expanded}</li>
              {/each}
            </ul>
          </section>
        {/if}

        <section class="llm-toggle">
          <label class="toggle">
            <input type="checkbox" checked={llmEnabled} onchange={toggleLlm} disabled={llmLoading} />
            <span>WebLLM (Qwen 0.5B, on-device)</span>
          </label>
          {#if llmStatus}<div class="llm-status">{llmStatus}</div>{/if}
        </section>

        <div class="footer">
          🔒 すべての解析はブラウザ上で完結。テキスト・モデル重み・推論ともネットワークに送信されません。
        </div>
      </div>
    {/if}
  </div>
{/if}

<style>
  .assist {
    background: linear-gradient(135deg, rgba(14, 165, 233, 0.06) 0%, rgba(139, 92, 246, 0.06) 100%);
    border: 1px solid var(--gv2-border);
    border-radius: 10px;
    overflow: hidden;
  }
  .assist.expanded { border-color: var(--gv2-accent); }
  .head {
    width: 100%;
    display: flex; gap: 8px; align-items: center;
    padding: 8px 12px;
    background: transparent; border: 0;
    color: var(--gv2-text-primary);
    text-align: left;
    cursor: pointer;
  }
  .icon { font-size: 16px; }
  .title { flex: 1; font-size: 12px; font-weight: 600; }
  .chev { font-size: 14px; color: var(--gv2-text-muted); }
  .body { padding: 4px 12px 12px; display: flex; flex-direction: column; gap: 10px; }
  section { display: flex; flex-direction: column; gap: 4px; }
  .lbl { font-size: 11px; font-weight: 600; color: var(--gv2-text-secondary); text-transform: uppercase; letter-spacing: 0.05em; }
  ul { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 4px; }
  .suggestions li { display: flex; gap: 6px; align-items: baseline; flex-wrap: wrap; }
  .apply {
    background: var(--gv2-accent); color: white;
    border: 0; border-radius: 6px;
    padding: 4px 8px;
    font-size: 11px; font-weight: 600;
    cursor: pointer;
  }
  .apply:hover { background: var(--gv2-accent-hover); }
  .rationale { font-size: 11px; color: var(--gv2-text-muted); flex: 1; min-width: 0; }
  .flag {
    padding: 4px 8px;
    background: var(--gv2-bg-input);
    border-radius: 6px;
    font-size: 11px;
    color: var(--gv2-text-primary);
    display: flex; gap: 6px; align-items: baseline; flex-wrap: wrap;
  }
  .why { font-size: 10px; color: var(--gv2-text-muted); }
  .vitals li { display: flex; gap: 8px; align-items: baseline; font-size: 11px; }
  .mono { font-family: ui-monospace, monospace; padding: 1px 6px; background: var(--gv2-bg-input); border-radius: 4px; }
  .loinc { color: var(--gv2-text-muted); }
  .vital-hint { font-size: 10px; color: var(--gv2-text-muted); margin-top: 4px; }
  .abbr li { font-size: 11px; color: var(--gv2-text-secondary); }
  .llm-toggle { display: flex; flex-direction: column; gap: 4px; padding-top: 6px; border-top: 1px dashed var(--gv2-border); }
  .toggle { display: flex; gap: 8px; align-items: center; font-size: 11px; color: var(--gv2-text-secondary); cursor: pointer; }
  .toggle input { cursor: pointer; }
  .llm-status { font-size: 10px; color: var(--gv2-text-muted); padding-left: 22px; }
  .footer { font-size: 10px; color: var(--gv2-text-muted); padding-top: 6px; border-top: 1px dashed var(--gv2-border); }
</style>
