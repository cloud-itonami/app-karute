// Vital sign LOINC codes + reference ranges + interpretation rules.
// All values use AT-Lexicon scaled-integer convention {valueScaled, scale}.

import { CodeSystem } from './codeSystems';

export type VitalKey =
  | 'bpSystolic'
  | 'bpDiastolic'
  | 'heartRate'
  | 'respiratoryRate'
  | 'temperature'
  | 'spo2'
  | 'weight'
  | 'height';

export interface VitalSpec {
  key: VitalKey;
  loincCode: string;
  system: string;
  display: string;
  displayJa: string;
  unit: string;
  scale: 1 | 10 | 100;
  defaultRefRange?: { low?: number; high?: number };
  criticalRange?: { low?: number; high?: number };
}

export const VITALS: Record<VitalKey, VitalSpec> = {
  bpSystolic: {
    key: 'bpSystolic',
    loincCode: '8480-6',
    system: CodeSystem.LOINC,
    display: 'Systolic blood pressure',
    displayJa: '収縮期血圧',
    unit: 'mm[Hg]',
    scale: 1,
    defaultRefRange: { low: 90, high: 140 },
    criticalRange: { low: 70, high: 180 },
  },
  bpDiastolic: {
    key: 'bpDiastolic',
    loincCode: '8462-4',
    system: CodeSystem.LOINC,
    display: 'Diastolic blood pressure',
    displayJa: '拡張期血圧',
    unit: 'mm[Hg]',
    scale: 1,
    defaultRefRange: { low: 60, high: 90 },
    criticalRange: { low: 40, high: 110 },
  },
  heartRate: {
    key: 'heartRate',
    loincCode: '8867-4',
    system: CodeSystem.LOINC,
    display: 'Heart rate',
    displayJa: '心拍数',
    unit: '/min',
    scale: 1,
    defaultRefRange: { low: 60, high: 100 },
    criticalRange: { low: 40, high: 130 },
  },
  respiratoryRate: {
    key: 'respiratoryRate',
    loincCode: '9279-1',
    system: CodeSystem.LOINC,
    display: 'Respiratory rate',
    displayJa: '呼吸数',
    unit: '/min',
    scale: 1,
    defaultRefRange: { low: 12, high: 20 },
    criticalRange: { low: 8, high: 30 },
  },
  temperature: {
    key: 'temperature',
    loincCode: '8310-5',
    system: CodeSystem.LOINC,
    display: 'Body temperature',
    displayJa: '体温',
    unit: 'Cel',
    scale: 10, // 367 = 36.7°C
    defaultRefRange: { low: 360, high: 374 },
    criticalRange: { low: 350, high: 390 },
  },
  spo2: {
    key: 'spo2',
    loincCode: '2708-6',
    system: CodeSystem.LOINC,
    display: 'Oxygen saturation in Arterial blood',
    displayJa: 'SpO₂',
    unit: '%',
    scale: 1,
    defaultRefRange: { low: 95, high: 100 },
    criticalRange: { low: 88, high: 100 },
  },
  weight: {
    key: 'weight',
    loincCode: '29463-7',
    system: CodeSystem.LOINC,
    display: 'Body weight',
    displayJa: '体重',
    unit: 'kg',
    scale: 10,
  },
  height: {
    key: 'height',
    loincCode: '8302-2',
    system: CodeSystem.LOINC,
    display: 'Body height',
    displayJa: '身長',
    unit: 'cm',
    scale: 1,
  },
};

export type Interpretation = 'normal' | 'low' | 'high' | 'critical-low' | 'critical-high';

export function interpretVital(spec: VitalSpec, valueScaled: number): Interpretation {
  if (spec.criticalRange) {
    if (spec.criticalRange.low !== undefined && valueScaled <= spec.criticalRange.low) return 'critical-low';
    if (spec.criticalRange.high !== undefined && valueScaled >= spec.criticalRange.high) return 'critical-high';
  }
  if (spec.defaultRefRange) {
    if (spec.defaultRefRange.low !== undefined && valueScaled < spec.defaultRefRange.low) return 'low';
    if (spec.defaultRefRange.high !== undefined && valueScaled > spec.defaultRefRange.high) return 'high';
  }
  return 'normal';
}

export function formatScaled(valueScaled: number, scale: 1 | 10 | 100 | 1000): string {
  if (scale === 1) return String(valueScaled);
  const d = String(scale).length - 1;
  return (valueScaled / scale).toFixed(d);
}
