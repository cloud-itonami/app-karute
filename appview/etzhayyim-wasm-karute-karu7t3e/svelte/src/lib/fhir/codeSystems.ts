// Canonical code-system URIs used across the karute lexicon and FHIR R5 export.

export const CodeSystem = {
  LOINC: 'http://loinc.org',
  ICD10_CM: 'http://hl7.org/fhir/sid/icd-10-cm',
  ICD10_JP: 'urn:oid:1.2.392.200119.4.504.4',
  SNOMED_CT: 'http://snomed.info/sct',
  RXNORM: 'http://www.nlm.nih.gov/research/umls/rxnorm',
  JLAC10: 'urn:oid:1.2.392.200119.4.504.7',
  YJ_CODE: 'urn:oid:1.2.392.100495.20.3.21',
  JP_SHINRYO: 'urn:oid:1.2.392.100495.20.3.51',
  UCUM: 'http://unitsofmeasure.org',
} as const;

export type CodeSystemUri = (typeof CodeSystem)[keyof typeof CodeSystem];

export interface CodeableConcept {
  system: CodeSystemUri | string;
  code: string;
  display?: string;
  displayJa?: string;
}
