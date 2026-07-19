<script lang="ts">
  import type { Severity } from '../lib/api/types';

  interface Flag {
    withMedicationRxnorm?: string;
    severity?: Severity;
    mechanism?: string;
    recommendation?: string;
  }

  interface Props {
    flags: Flag[];
    onOverride?: (reason: string) => void;
    onCancel?: () => void;
  }
  const { flags, onOverride, onCancel }: Props = $props();

  let overrideReason = $state('');

  const SEV_LABEL: Record<Severity, { label: string; color: string }> = {
    minor: { label: '軽度', color: '#0ea5e9' },
    moderate: { label: '中等度', color: '#f59e0b' },
    major: { label: '重度', color: '#dc2626' },
    contraindicated: { label: '禁忌', color: '#7f1d1d' },
  };

  const maxSeverity = $derived.by(() => {
    const ranks: Record<Severity, number> = { minor: 1, moderate: 2, major: 3, contraindicated: 4 };
    let m: Severity = 'minor';
    let mr = 0;
    for (const f of flags) {
      if (f.severity) {
        const r = ranks[f.severity];
        if (r > mr) { mr = r; m = f.severity; }
      }
    }
    return m;
  });

  const isBlocking = $derived(maxSeverity === 'contraindicated');
</script>

{#if flags.length > 0}
  <div class="alert sev-{maxSeverity}" role="alert" aria-live="assertive">
    <div class="hdr">
      <span class="icon">⚠</span>
      <span class="title">相互作用 / 禁忌 {flags.length} 件 検出 — 最大: {SEV_LABEL[maxSeverity].label}</span>
    </div>
    <ul class="list">
      {#each flags as f, i (i)}
        <li>
          {#if f.severity}<span class="sev sev-{f.severity}">{SEV_LABEL[f.severity].label}</span>{/if}
          {#if f.withMedicationRxnorm}<span class="with">vs RxNorm {f.withMedicationRxnorm}</span>{/if}
          {#if f.mechanism}<div class="mech">{f.mechanism}</div>{/if}
          {#if f.recommendation}<div class="rec">推奨: {f.recommendation}</div>{/if}
        </li>
      {/each}
    </ul>
    {#if isBlocking && onOverride}
      <div class="override">
        <div class="warn">禁忌 — 処方発行は処方医の判断で override が必要</div>
        <textarea
          bind:value={overrideReason}
          placeholder="override 理由 (監査記録に残ります)"
          rows={2}
        ></textarea>
        <div class="row">
          {#if onCancel}<button type="button" class="cancel" onclick={onCancel}>キャンセル</button>{/if}
          <button
            type="button"
            class="ovbtn"
            disabled={!overrideReason.trim()}
            onclick={() => onOverride?.(overrideReason.trim())}
          >
            理由を記録して処方
          </button>
        </div>
      </div>
    {:else if onCancel}
      <div class="row">
        <button type="button" class="cancel" onclick={onCancel}>確認した</button>
      </div>
    {/if}
  </div>
{/if}

<style>
  .alert {
    display: flex; flex-direction: column; gap: 8px;
    padding: 12px;
    border: 2px solid;
    border-radius: 10px;
    background: var(--gv2-bg-card);
  }
  .sev-minor { border-color: #0ea5e9; }
  .sev-moderate { border-color: #f59e0b; background: #fffbeb; }
  .sev-major { border-color: #dc2626; background: #fef2f2; }
  .sev-contraindicated { border-color: #7f1d1d; background: #fecaca; }
  .hdr { display: flex; gap: 8px; align-items: center; font-weight: 600; }
  .icon { font-size: 18px; }
  .title { font-size: 13px; }
  .list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 6px; }
  .list li { padding: 6px 8px; background: rgba(255,255,255,0.6); border-radius: 6px; font-size: 12px; }
  .sev { display: inline-block; padding: 1px 6px; border-radius: 4px; font-size: 10px; font-weight: 600; color: white; margin-right: 6px; }
  .sev.sev-minor { background: #0ea5e9; }
  .sev.sev-moderate { background: #f59e0b; }
  .sev.sev-major { background: #dc2626; }
  .sev.sev-contraindicated { background: #7f1d1d; }
  .with { font-family: ui-monospace, monospace; font-size: 10px; color: var(--gv2-text-muted); }
  .mech { margin-top: 4px; color: var(--gv2-text-secondary); }
  .rec { margin-top: 2px; font-weight: 500; }
  .override { display: flex; flex-direction: column; gap: 6px; padding-top: 6px; border-top: 1px dashed currentColor; }
  .warn { font-size: 11px; font-weight: 600; }
  .override textarea {
    width: 100%; box-sizing: border-box; padding: 6px 8px; font-size: 12px;
    border: 1px solid var(--gv2-border); border-radius: 6px;
    background: var(--gv2-bg-input);
  }
  .row { display: flex; gap: 8px; justify-content: flex-end; }
  .cancel, .ovbtn {
    border: 0; border-radius: 6px;
    padding: 6px 10px; font-size: 12px; font-weight: 600;
  }
  .cancel { background: var(--gv2-bg-input); color: var(--gv2-text-primary); border: 1px solid var(--gv2-border); }
  .ovbtn { background: #7f1d1d; color: white; }
  .ovbtn:disabled { opacity: 0.5; }
</style>
