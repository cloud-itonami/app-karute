// On-device SOAP assist.
//
// PHI EXFILTRATION RULE (CRITICAL):
//   Every function in this module runs synchronously in the browser, no
//   network calls, no clipboard, no IndexedDB persistence. Input text never
//   leaves the device. This is the constitutional invariant that lets us
//   run "AI assist" on un-encrypted clinical notes.
//
// PHASE 1 SHAPE:
//   - Pure heuristic engine (regex + dictionary).
//   - Extracts: chief complaint candidate, recognized vital mentions,
//     symptom→differential hints, common JP medical abbreviations.
//   - Returns suggestion objects the clinician one-click accepts into the
//     right SOAP field.
//
// PHASE 2 (deferred):
//   - WebLLM / wllama hook. Same on-device constraint: weights download
//     once, inference is local. The current shape is API-compatible —
//     `runLlmAssist()` is a stub that returns `null` and Phase 2 will
//     implement it.

export interface AssistSuggestion {
  id: string;
  field: 'subjective' | 'assessment' | 'plan';
  label: string;
  insert: string;
  icd10?: string;
  rationale: string;
  source: 'heuristic' | 'llm';
}

// --- Chief complaint extraction ---

const CHIEF_COMPLAINT_HEURISTICS: Array<{ pattern: RegExp; label: string }> = [
  { pattern: /(\d+)日前から/, label: '発症期間あり (acute/subacute pattern)' },
  { pattern: /(\d+)時間前から/, label: '急性発症 (acute < 24h)' },
  { pattern: /(\d+)(週間|か月|ヶ月|年)前から/, label: '慢性 (chronic)' },
  { pattern: /(発熱|熱)/, label: '発熱の言及あり' },
  { pattern: /(嘔気|嘔吐|吐き気)/, label: '消化器症状 (悪心・嘔吐)' },
  { pattern: /(腹痛|右下腹部痛|心窩部痛|上腹部痛|下腹部痛)/, label: '腹痛 — 部位特定推奨' },
  { pattern: /(咳|咳嗽|喀痰)/, label: '気道症状' },
  { pattern: /(頭痛)/, label: '頭痛 — 突然発症/慢性を確認' },
  { pattern: /(胸痛|胸部痛|胸の(痛|苦))/, label: '胸痛 — ACS rule-out 推奨' },
  { pattern: /(動悸)/, label: '動悸 — VS と心電図検討' },
  { pattern: /(息切れ|呼吸困難)/, label: '呼吸困難 — SpO₂ 必須' },
  { pattern: /(めまい|眩暈)/, label: 'めまい — 中枢/末梢の鑑別' },
];

// --- Symptom → differential / ICD-10 candidate map ---

const SYMPTOM_DIFFERENTIAL: Array<{ keywords: string[]; differentials: Array<{ dx: string; icd10: string; rationale: string }> }> = [
  {
    keywords: ['右下腹部痛', 'マックバーニー', 'McBurney', 'rebound', '反跳痛'],
    differentials: [
      { dx: '急性虫垂炎', icd10: 'K35.80', rationale: '右下腹部痛 + 圧痛/反跳痛で第一鑑別' },
      { dx: '腸間膜リンパ節炎', icd10: 'I88.0', rationale: '小児で多い差別診断' },
      { dx: '卵巣捻転', icd10: 'N83.5', rationale: '女性の場合に考慮' },
    ],
  },
  {
    keywords: ['胸痛', '胸部圧迫感', 'ACS', '冠動脈'],
    differentials: [
      { dx: '急性冠症候群 (ACS)', icd10: 'I24.9', rationale: '12誘導心電図 + トロポニン必須' },
      { dx: '大動脈解離', icd10: 'I71.0', rationale: '突然発症の引き裂かれる痛み — CT 推奨' },
      { dx: '肺塞栓症', icd10: 'I26.9', rationale: 'D-dimer + SpO₂ で screen' },
    ],
  },
  {
    keywords: ['発熱', '咳', '喀痰', '38度'],
    differentials: [
      { dx: '市中肺炎', icd10: 'J18.9', rationale: '発熱 + 咳嗽 + 喀痰 → 胸部 X-ray' },
      { dx: 'インフルエンザ', icd10: 'J11.1', rationale: '流行期は迅速検査' },
      { dx: '気管支炎', icd10: 'J20.9', rationale: '所見軽度なら経過観察' },
    ],
  },
  {
    keywords: ['頭痛', '突然', 'thunderclap'],
    differentials: [
      { dx: 'くも膜下出血', icd10: 'I60.9', rationale: '突然発症最強の頭痛 — CT 即時' },
      { dx: '片頭痛', icd10: 'G43.909', rationale: '繰り返す拍動性 + 光過敏' },
      { dx: '緊張型頭痛', icd10: 'G44.209', rationale: '締め付け感 + 頸肩こり' },
    ],
  },
  {
    keywords: ['動悸', '心房細動', 'AF', 'palpitation'],
    differentials: [
      { dx: '心房細動', icd10: 'I48.91', rationale: '不規則な脈 → 12誘導心電図 + CHADS₂' },
      { dx: '上室性頻拍 (PSVT)', icd10: 'I47.1', rationale: '突然発症と消失を伴う' },
      { dx: '甲状腺機能亢進症', icd10: 'E05.90', rationale: 'TSH/fT4 で screen' },
    ],
  },
];

// --- Vital sign mention scanner (used to suggest moving values to VitalsForm) ---

const VITAL_PATTERNS: Array<{ pattern: RegExp; label: string; loinc: string; key: string }> = [
  { pattern: /BP\s*[:：]?\s*(\d{2,3})\s*\/\s*(\d{2,3})/i, label: '血圧', loinc: '8480-6', key: 'bp' },
  { pattern: /血圧\s*[:：]?\s*(\d{2,3})\s*\/\s*(\d{2,3})/, label: '血圧', loinc: '8480-6', key: 'bp' },
  { pattern: /(?:HR|心拍|脈拍)\s*[:：]?\s*(\d{2,3})/i, label: '心拍数', loinc: '8867-4', key: 'hr' },
  { pattern: /(?:RR|呼吸数)\s*[:：]?\s*(\d{1,2})/i, label: '呼吸数', loinc: '9279-1', key: 'rr' },
  { pattern: /(?:T|体温|BT)\s*[:：]?\s*(\d{2}(?:\.\d)?)/, label: '体温', loinc: '8310-5', key: 'temp' },
  { pattern: /SpO\s*[₂2]\s*[:：]?\s*(\d{2,3})/i, label: 'SpO₂', loinc: '2708-6', key: 'spo2' },
];

// --- JP medical abbreviation expansions (display-only hints) ---

const ABBREVIATIONS: Record<string, string> = {
  HT: '高血圧',
  HTN: '高血圧',
  DM: '糖尿病',
  IHD: '虚血性心疾患',
  AF: '心房細動',
  CHF: '心不全',
  COPD: '慢性閉塞性肺疾患',
  CKD: '慢性腎臓病',
  CVA: '脳卒中',
  TIA: '一過性脳虚血発作',
  CAP: '市中肺炎',
  UTI: '尿路感染症',
  GERD: '胃食道逆流症',
  RA: '関節リウマチ',
  SLE: '全身性エリテマトーデス',
};

// --- Main entrypoint ---

export interface AssistInput {
  subjective: string;
  objective?: string;
}

export interface AssistResult {
  suggestions: AssistSuggestion[];
  vitalMentions: Array<{ label: string; loinc: string; raw: string; matchIndex: number }>;
  abbreviationsSpotted: Array<{ short: string; expanded: string }>;
}

export function runHeuristicAssist(input: AssistInput): AssistResult {
  const text = `${input.subjective}\n${input.objective ?? ''}`;
  const suggestions: AssistSuggestion[] = [];

  // 1. Chief complaint flags
  for (const h of CHIEF_COMPLAINT_HEURISTICS) {
    const m = text.match(h.pattern);
    if (m) {
      suggestions.push({
        id: `cc-${h.label}`,
        field: 'subjective',
        label: h.label,
        insert: '',
        rationale: `主訴に「${m[0]}」を検出`,
        source: 'heuristic',
      });
    }
  }

  // 2. Differential candidates
  for (const sd of SYMPTOM_DIFFERENTIAL) {
    if (sd.keywords.some((k) => text.includes(k))) {
      for (const d of sd.differentials) {
        suggestions.push({
          id: `dx-${d.icd10}`,
          field: 'assessment',
          label: `${d.dx} (${d.icd10})`,
          insert: d.dx,
          icd10: d.icd10,
          rationale: d.rationale,
          source: 'heuristic',
        });
      }
    }
  }

  // 3. Vital sign mentions
  const vitalMentions: AssistResult['vitalMentions'] = [];
  for (const v of VITAL_PATTERNS) {
    const m = text.match(v.pattern);
    if (m) {
      vitalMentions.push({
        label: v.label,
        loinc: v.loinc,
        raw: m[0],
        matchIndex: m.index ?? -1,
      });
    }
  }

  // 4. Abbreviation expansion
  const abbreviationsSpotted: AssistResult['abbreviationsSpotted'] = [];
  const tokens = text.split(/[\s,.;:、。()（）]+/);
  const seen = new Set<string>();
  for (const tk of tokens) {
    const up = tk.toUpperCase();
    if (ABBREVIATIONS[up] && !seen.has(up)) {
      abbreviationsSpotted.push({ short: up, expanded: ABBREVIATIONS[up] });
      seen.add(up);
    }
  }

  return { suggestions, vitalMentions, abbreviationsSpotted };
}

// --- On-device LLM hook (WebLLM lazy-loader) ---

/**
 * Lazily loads a small WebLLM model in the browser and runs an on-device SOAP
 * enrichment pass. Constraint: weights download once (~250-700 MB depending on
 * the selected model), cached in OPFS via WebLLM's built-in cache; inference
 * runs entirely client-side. No PHI exfiltration.
 *
 * The function is opt-in (caller passes `enabled: true`) so the bundle does
 * not pay the weights-download cost unless the clinician explicitly enables it.
 *
 * The output is API-compatible with `runHeuristicAssist` so callers can merge
 * the two result streams.
 *
 * MODEL SELECTION:
 *   - Default: `Qwen2.5-0.5B-Instruct-q4f16_1-MLC` (~340 MB; instruction-tuned)
 *   - Fallback: `Llama-3.2-1B-Instruct-q4f16_1-MLC` (~880 MB; better JP)
 *   - Heuristic-only: if WebLLM fails to load (no WebGPU / network gate),
 *     the function resolves to `null` and callers fall back to the heuristic
 *     assist alone.
 */

const WEBLLM_MODEL_DEFAULT = 'Qwen2.5-0.5B-Instruct-q4f16_1-MLC';
const WEBLLM_PROMPT_PREFIX = `あなたは医師の SOAP 記録を補助する on-device の臨床アシスタントです。
入力テキストから「鑑別候補」「主訴フラグ」「バイタル記述」「略語」を抽出し、
以下の JSON スキーマで返してください。PHI は端末外に出ません。

スキーマ:
{
  "differentials": [{"diagnosis": "...", "icd10": "...", "rationale": "..."}],
  "subjectiveFlags": [{"label": "...", "rationale": "..."}],
  "vitals": [{"label": "...", "loinc": "...", "raw": "..."}],
  "abbreviations": [{"short": "...", "expanded": "..."}]
}

入力テキスト:
`;

interface WebLlmEnginePromise {
  engine: unknown;  // Avoid hard import of @mlc-ai/web-llm types
  modelId: string;
}

let enginePromise: Promise<WebLlmEnginePromise | null> | null = null;

interface RunLlmOpts {
  enabled?: boolean;
  modelId?: string;
  onProgress?: (msg: string) => void;
}

export async function runLlmAssist(
  input: AssistInput,
  opts: RunLlmOpts = {},
): Promise<AssistResult | null> {
  if (!opts.enabled) return null;
  if (typeof window === 'undefined') return null;

  // Capability gate: WebGPU is the cheapest signal.
  // The user's browser must have navigator.gpu; otherwise WebLLM cannot run.
  const navAny = navigator as unknown as { gpu?: unknown };
  if (!navAny.gpu) {
    opts.onProgress?.('WebGPU 非対応 — heuristic のみ使用します');
    return null;
  }

  try {
    if (!enginePromise) {
      enginePromise = loadEngine(opts.modelId ?? WEBLLM_MODEL_DEFAULT, opts.onProgress);
    }
    const eng = await enginePromise;
    if (!eng) return null;

    const prompt = WEBLLM_PROMPT_PREFIX + `${input.subjective}\n${input.objective ?? ''}`;
    const engineAny = eng.engine as { chat: { completions: { create: (req: unknown) => Promise<{ choices: Array<{ message: { content: string } }> }> } } };
    const completion = await engineAny.chat.completions.create({
      messages: [
        { role: 'system', content: 'You are an on-device clinical SOAP assistant. PHI stays on this device.' },
        { role: 'user', content: prompt },
      ],
      temperature: 0.2,
      max_tokens: 600,
      response_format: { type: 'json_object' },
    });

    const text = completion.choices?.[0]?.message?.content ?? '{}';
    return parseLlmResult(text);
  } catch (err) {
    opts.onProgress?.(`LLM 失敗 — heuristic にフォールバック: ${err instanceof Error ? err.message : String(err)}`);
    return null;
  }
}

async function loadEngine(modelId: string, onProgress?: (msg: string) => void): Promise<WebLlmEnginePromise | null> {
  try {
    // Dynamic import keeps the heavy WebLLM bundle out of the initial app payload.
    // The actual package is `@mlc-ai/web-llm`; downstream apps add it as an opt-in
    // dependency. The runtime catches the missing-import error and degrades gracefully.
    const mod = await import(/* @vite-ignore */ '@mlc-ai/web-llm').catch(() => null as null);
    if (!mod) {
      onProgress?.('@mlc-ai/web-llm 未インストール — `pnpm add @mlc-ai/web-llm` で有効化');
      return null;
    }
    const modAny = mod as unknown as { CreateMLCEngine: (id: string, cfg: { initProgressCallback?: (r: { text: string }) => void }) => Promise<unknown> };
    const engine = await modAny.CreateMLCEngine(modelId, {
      initProgressCallback: (r) => onProgress?.(r.text),
    });
    return { engine, modelId };
  } catch (err) {
    onProgress?.(`LLM load 失敗: ${err instanceof Error ? err.message : String(err)}`);
    return null;
  }
}

function parseLlmResult(jsonText: string): AssistResult | null {
  try {
    const data = JSON.parse(jsonText) as {
      differentials?: Array<{ diagnosis?: string; icd10?: string; rationale?: string }>;
      subjectiveFlags?: Array<{ label?: string; rationale?: string }>;
      vitals?: Array<{ label?: string; loinc?: string; raw?: string }>;
      abbreviations?: Array<{ short?: string; expanded?: string }>;
    };
    const suggestions: AssistSuggestion[] = [
      ...(data.differentials ?? []).map((d, i) => ({
        id: `llm-dx-${d.icd10 ?? i}`,
        field: 'assessment' as const,
        label: `${d.diagnosis ?? '(unnamed)'}${d.icd10 ? ` (${d.icd10})` : ''}`,
        insert: d.diagnosis ?? '',
        icd10: d.icd10,
        rationale: d.rationale ?? '',
        source: 'llm' as const,
      })),
      ...(data.subjectiveFlags ?? []).map((s, i) => ({
        id: `llm-cc-${i}`,
        field: 'subjective' as const,
        label: s.label ?? '',
        insert: '',
        rationale: s.rationale ?? '',
        source: 'llm' as const,
      })),
    ];
    return {
      suggestions,
      vitalMentions: (data.vitals ?? []).map((v) => ({
        label: v.label ?? '',
        loinc: v.loinc ?? '',
        raw: v.raw ?? '',
        matchIndex: -1,
      })),
      abbreviationsSpotted: (data.abbreviations ?? []).map((a) => ({
        short: a.short ?? '',
        expanded: a.expanded ?? '',
      })),
    };
  } catch {
    return null;
  }
}

/**
 * Merge heuristic + LLM results, preferring heuristic for vitals (regex is more
 * precise than free-form text) and union for differentials / abbreviations.
 */
export function mergeAssistResults(heuristic: AssistResult, llm: AssistResult | null): AssistResult {
  if (!llm) return heuristic;
  const seenDx = new Set(heuristic.suggestions.filter((s) => s.field === 'assessment').map((s) => `${s.icd10 ?? ''}|${s.insert}`));
  const dedupedLlmSuggestions = llm.suggestions.filter((s) => {
    if (s.field !== 'assessment') return true;
    const key = `${s.icd10 ?? ''}|${s.insert}`;
    if (seenDx.has(key)) return false;
    seenDx.add(key);
    return true;
  });
  const seenAbbr = new Set(heuristic.abbreviationsSpotted.map((a) => a.short));
  return {
    suggestions: [...heuristic.suggestions, ...dedupedLlmSuggestions],
    vitalMentions: heuristic.vitalMentions,
    abbreviationsSpotted: [
      ...heuristic.abbreviationsSpotted,
      ...llm.abbreviationsSpotted.filter((a) => !seenAbbr.has(a.short)),
    ],
  };
}
