import {
  isCognitiveFunction,
  isFourLetterType,
  DICHOTOMIES,
  type CognitiveFunction,
  type Dichotomy,
  type FourLetterType,
} from './typology.ts';

export type ReflectionCalibration = {
  accepted_at: string;
  reason: string;
  functions: readonly { function: CognitiveFunction; strength: number; confidence: number }[];
  dichotomies: readonly { dichotomy: Dichotomy; value: number; confidence: number }[];
};

export type ExplorationMode = 'resonance' | 'roundtable';
export type ExplorationVoice = {
  function: CognitiveFunction;
  perspective: string;
  question: string;
};
export type ExplorationRead = {
  title: string;
  reflection: string;
  voices: readonly ExplorationVoice[];
  alternative: string;
  experiment: string;
};
export type SavedExploration = {
  mode: ExplorationMode;
  mood: string;
  read?: ExplorationRead;
  feedback?: 'accepted' | 'rejected' | null;
  experiment_done?: boolean;
  reference_type?: FourLetterType | null;
  calibration?: ReflectionCalibration;
};

const isText = (v: unknown, max: number): v is string =>
  typeof v === 'string' && v.trim().length > 0 && v.length <= max;
const object = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === 'object' && !Array.isArray(v);

export function isExplorationRead(value: unknown): value is ExplorationRead {
  if (
    !object(value) ||
    Object.keys(value).some(
      (key) => !['title', 'reflection', 'voices', 'alternative', 'experiment'].includes(key),
    ) ||
    !isText(value.title, 120) ||
    !isText(value.reflection, 2400) ||
    !isText(value.alternative, 1200) ||
    !isText(value.experiment, 1200) ||
    !Array.isArray(value.voices) ||
    value.voices.length < 2 ||
    value.voices.length > 8
  )
    return false;
  const functions = new Set<string>();
  for (const voice of value.voices) {
    if (
      !object(voice) ||
      Object.keys(voice).some((key) => !['function', 'perspective', 'question'].includes(key)) ||
      !isCognitiveFunction(voice.function) ||
      functions.has(voice.function) ||
      !isText(voice.perspective, 1000) ||
      !isText(voice.question, 500)
    )
      return false;
    functions.add(voice.function);
  }
  return true;
}

export function isSavedExploration(value: unknown): value is SavedExploration {
  return (
    object(value) &&
    (value.mode === 'resonance' || value.mode === 'roundtable') &&
    Object.keys(value).every((key) =>
      [
        'mode',
        'mood',
        'read',
        'feedback',
        'experiment_done',
        'reference_type',
        'calibration',
      ].includes(key),
    ) &&
    typeof value.mood === 'string' &&
    value.mood.length <= 100 &&
    (value.read === undefined ||
      (isExplorationRead(value.read) &&
        (value.mode === 'roundtable'
          ? value.read.voices.length === 8
          : value.read.voices.length <= 3))) &&
    (value.feedback === undefined ||
      value.feedback === null ||
      value.feedback === 'accepted' ||
      value.feedback === 'rejected') &&
    (value.experiment_done === undefined || typeof value.experiment_done === 'boolean') &&
    (value.reference_type === undefined ||
      value.reference_type === null ||
      isFourLetterType(value.reference_type)) &&
    (value.calibration === undefined || isReflectionCalibration(value.calibration)) &&
    (!(value.feedback || value.experiment_done) || value.read !== undefined)
  );
}

export function isReflectionCalibration(value: unknown): value is ReflectionCalibration {
  if (
    !object(value) ||
    !isText(value.reason, 4000) ||
    typeof value.accepted_at !== 'string' ||
    !/^\d{4}-\d\d-\d\dT.*Z$/.test(value.accepted_at) ||
    !Array.isArray(value.functions) ||
    !Array.isArray(value.dichotomies)
  )
    return false;
  const bounded = (v: unknown) =>
    typeof v === 'number' && Number.isFinite(v) && Math.abs(v) <= 0.1 + 1e-9;
  return (
    value.functions.length + value.dichotomies.length > 0 &&
    new Set(value.functions.map((item) => (object(item) ? item.function : null))).size ===
      value.functions.length &&
    new Set(value.dichotomies.map((item) => (object(item) ? item.dichotomy : null))).size ===
      value.dichotomies.length &&
    value.functions.every(
      (item) =>
        object(item) &&
        isCognitiveFunction(item.function) &&
        bounded(item.strength) &&
        bounded(item.confidence),
    ) &&
    value.dichotomies.every(
      (item) =>
        object(item) &&
        (DICHOTOMIES as readonly unknown[]).includes(item.dichotomy) &&
        bounded(item.value) &&
        bounded(item.confidence),
    )
  );
}

// An invalid structured response is visible as an error; it is never filled in.
export function parseExplorationRead(text: string, mode: ExplorationMode): ExplorationRead | null {
  try {
    const parsed: unknown = JSON.parse(
      text.trim().replace(/^```(?:json)?\s*\n?([\s\S]*?)\n?```$/, '$1'),
    );
    if (
      !isExplorationRead(parsed) ||
      (mode === 'roundtable' ? parsed.voices.length !== 8 : parsed.voices.length > 3)
    )
      return null;
    return parsed;
  } catch {
    return null;
  }
}
