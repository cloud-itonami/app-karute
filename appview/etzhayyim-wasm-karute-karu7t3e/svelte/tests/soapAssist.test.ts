import { describe, it, expect } from 'vitest';
import { runHeuristicAssist, runLlmAssist, mergeAssistResults } from '../src/lib/assist/soapAssist';

describe('runHeuristicAssist', () => {
  it('detects 急性虫垂炎 differential from RLQ pain wording', () => {
    const r = runHeuristicAssist({
      subjective: '2日前から右下腹部痛、嘔気あり。McBurney 圧痛 + 反跳痛',
    });
    const dxLabels = r.suggestions.filter((s) => s.field === 'assessment').map((s) => s.label);
    expect(dxLabels.some((l) => l.includes('急性虫垂炎'))).toBe(true);
    expect(dxLabels.some((l) => l.includes('K35.80'))).toBe(true);
  });

  it('flags 突然 + 頭痛 → くも膜下出血 with CT recommendation', () => {
    const r = runHeuristicAssist({ subjective: '突然の thunderclap 頭痛が30分前から' });
    const ddx = r.suggestions.filter((s) => s.field === 'assessment').map((s) => s.label);
    expect(ddx.some((l) => l.includes('くも膜下出血'))).toBe(true);
    const cc = r.suggestions.filter((s) => s.field === 'subjective').map((s) => s.label);
    expect(cc.some((l) => l.includes('頭痛'))).toBe(true);
  });

  it('detects BP/HR/SpO2 vital mentions and maps to LOINC', () => {
    const r = runHeuristicAssist({
      subjective: 'バイタル: BP 162/94, HR 88, SpO2 96%',
    });
    const loincs = r.vitalMentions.map((v) => v.loinc);
    expect(loincs).toContain('8480-6');
    expect(loincs).toContain('8867-4');
    expect(loincs).toContain('2708-6');
  });

  it('expands JP medical abbreviations', () => {
    const r = runHeuristicAssist({ subjective: 'HT, DM 既往. AF あり.' });
    const expansions = r.abbreviationsSpotted.map((a) => a.expanded);
    expect(expansions).toContain('高血圧');
    expect(expansions).toContain('糖尿病');
    expect(expansions).toContain('心房細動');
  });

  it('returns empty arrays for empty input', () => {
    const r = runHeuristicAssist({ subjective: '', objective: '' });
    expect(r.suggestions).toEqual([]);
    expect(r.vitalMentions).toEqual([]);
    expect(r.abbreviationsSpotted).toEqual([]);
  });
});

describe('runLlmAssist', () => {
  it('returns null when not opted in', async () => {
    const r = await runLlmAssist({ subjective: 'foo' });
    expect(r).toBeNull();
  });

  it('returns null when WebGPU absent (jsdom)', async () => {
    let progressMsg = '';
    const r = await runLlmAssist(
      { subjective: 'foo' },
      { enabled: true, onProgress: (m) => (progressMsg = m) },
    );
    expect(r).toBeNull();
    expect(progressMsg).toMatch(/WebGPU/);
  });
});

describe('mergeAssistResults', () => {
  const heuristic = runHeuristicAssist({ subjective: '右下腹部痛 + 反跳痛, HT 既往' });

  it('returns heuristic unchanged when llm is null', () => {
    const merged = mergeAssistResults(heuristic, null);
    expect(merged.suggestions.length).toBe(heuristic.suggestions.length);
  });

  it('dedupes overlapping differentials by ICD-10 + insert', () => {
    const llm = {
      suggestions: [
        {
          id: 'llm-dx-1',
          field: 'assessment' as const,
          label: '急性虫垂炎 (K35.80)',
          insert: '急性虫垂炎',
          icd10: 'K35.80',
          rationale: 'duplicate of heuristic',
          source: 'llm' as const,
        },
        {
          id: 'llm-dx-2',
          field: 'assessment' as const,
          label: 'リンパ性悪性腫瘍 (C85)',
          insert: 'リンパ性悪性腫瘍',
          icd10: 'C85',
          rationale: 'novel LLM-only suggestion',
          source: 'llm' as const,
        },
      ],
      vitalMentions: [],
      abbreviationsSpotted: [],
    };
    const merged = mergeAssistResults(heuristic, llm);
    const cKeys = merged.suggestions.filter((s) => s.field === 'assessment').map((s) => `${s.icd10}|${s.insert}`);
    // K35.80|急性虫垂炎 appears exactly once even though both sources offered it.
    expect(cKeys.filter((k) => k === 'K35.80|急性虫垂炎').length).toBe(1);
    // C85|リンパ性悪性腫瘍 is added (new).
    expect(cKeys).toContain('C85|リンパ性悪性腫瘍');
  });
});
