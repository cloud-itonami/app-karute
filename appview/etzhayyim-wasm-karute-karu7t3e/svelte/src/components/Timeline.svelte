<script lang="ts">
  import { fmtDateTime } from '../lib/util/format';

  interface TimelineItem {
    innerType: string;
    rkey: string;
    encryptedCid: string;
    occurredAt: string;
  }
  interface Props { items: TimelineItem[]; }
  const { items }: Props = $props();

  const KIND_LABEL: Record<string, { label: string; icon: string; color: string }> = {
    'com.etzhayyim.karute.encounter': { label: '受診', icon: '🏥', color: '#0ea5e9' },
    'com.etzhayyim.karute.soapNote': { label: 'SOAP', icon: '📝', color: '#10b981' },
    'com.etzhayyim.karute.observation': { label: 'バイタル/検査', icon: '📊', color: '#8b5cf6' },
    'com.etzhayyim.karute.condition': { label: '病名', icon: '🩺', color: '#f59e0b' },
    'com.etzhayyim.karute.medicationRequest': { label: '処方', icon: '💊', color: '#ec4899' },
    'com.etzhayyim.karute.serviceRequest': { label: 'オーダー', icon: '📋', color: '#06b6d4' },
  };

  function kindFor(t: string) {
    return KIND_LABEL[t] ?? { label: t.split('.').pop() ?? t, icon: '•', color: '#94a3b8' };
  }
</script>

<ol class="timeline">
  {#each items as item (item.rkey)}
    {@const k = kindFor(item.innerType)}
    <li class="row">
      <div class="dot" style="background:{k.color}">{k.icon}</div>
      <div class="body">
        <div class="kind">{k.label}</div>
        <div class="time">{fmtDateTime(item.occurredAt)}</div>
        <div class="cid" title={item.encryptedCid}>cid: {item.encryptedCid.slice(0, 20)}…</div>
      </div>
    </li>
  {:else}
    <li class="empty">タイムラインなし</li>
  {/each}
</ol>

<style>
  .timeline { list-style: none; margin: 0; padding: 0; position: relative; }
  .timeline::before {
    content: '';
    position: absolute;
    left: 17px;
    top: 12px;
    bottom: 12px;
    width: 2px;
    background: var(--gv2-border);
  }
  .row { display: flex; gap: 12px; padding: 8px 0; align-items: flex-start; position: relative; }
  .dot {
    width: 32px; height: 32px; border-radius: 50%;
    display: grid; place-items: center;
    color: white; font-size: 14px;
    flex-shrink: 0;
    box-shadow: 0 0 0 4px var(--gv2-bg-primary);
    z-index: 1;
  }
  .body { flex: 1; min-width: 0; }
  .kind { font-weight: 600; font-size: 13px; }
  .time { font-size: 12px; color: var(--gv2-text-secondary); }
  .cid { font-family: ui-monospace, monospace; font-size: 10px; color: var(--gv2-text-muted); margin-top: 2px; }
  .empty { padding: 24px 12px; text-align: center; color: var(--gv2-text-muted); font-size: 13px; }
</style>
