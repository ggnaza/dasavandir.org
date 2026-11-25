/**
 * Attestation tests — pure logic (ADR-0010). No I/O, no framework imports, so it
 * runs under `node --test` and in both server and client code.
 *
 *  - answer types and their correct/response shapes
 *  - grading (all-or-nothing or partial, per question)
 *  - answer-key parsing from a key PDF's text layer, and normalisation of a raw key
 *    cell into a typed correct answer
 *
 * The key path is deliberately mechanical. An audit of the real keys found that
 * AI-transcribed keys were wrong 7 times in 872 questions and came with plausible
 * invented justifications; the PDF text layer was exact.
 */

export const ANSWER_TYPES = ["single", "multi", "order", "match", "numeric", "short_text"] as const;
export type AnswerType = (typeof ANSWER_TYPES)[number];

export const SCORING_MODES = ["all_or_nothing", "partial"] as const;
export type ScoringMode = (typeof SCORING_MODES)[number];

export interface Choice {
  /** Label as printed on the test: "1", "b", "ա", "A". */
  id: string;
  text: string;
}

/**
 * Correct answer / learner response, by type:
 *  single     → "3"
 *  multi      → ["2","5","7"]      (set)
 *  order      → ["3","2","5"]      (sequence of option ids)
 *  match      → { "A": "6", ... }  (slot id → option id)
 *  numeric    → ["240"]            (accepted values; response is a single string)
 *  short_text → ["Paris"]          (accepted values; response is a single string)
 */
export type Correct = string | string[] | Record<string, string>;
export type Response = string | string[] | Record<string, string> | null | undefined;

export interface GradableQuestion {
  answer_type: AnswerType;
  correct: Correct | null;
  points: number;
  scoring: ScoringMode;
}

export interface ItemResult {
  earned: number;
  max: number;
  /** Full marks. */
  correct: boolean;
  answered: boolean;
}

// ---------------------------------------------------------------------------
// Grading
// ---------------------------------------------------------------------------

const isArr = (v: unknown): v is string[] => Array.isArray(v) && v.every((x) => typeof x === "string");
const isMap = (v: unknown): v is Record<string, string> =>
  !!v && typeof v === "object" && !Array.isArray(v);

/** Comparable form of a typed value: trimmed, lowercase, single-spaced. */
export function normText(s: string): string {
  return s.normalize("NFC").trim().replace(/\s+/g, " ").toLowerCase();
}

/**
 * Numeric equality that tolerates "0,25" vs "0.25" and "1 250" vs "1250", but
 * keeps string semantics for values with a leading zero (base-n answers such as
 * "0101" must not match "101").
 */
export function numericEquals(given: string, accepted: string): boolean {
  // Spaces (incl. NBSP) are digit grouping; U+2212 is a minus sign. One comma is the
  // decimal separator — the Armenian convention used by the source tests ("0,25").
  const clean = (s: string) =>
    s.normalize("NFC").trim().replace(/[\s\u00a0\u202f]/g, "").replace(/\u2212/g, "-");
  const g = clean(given);
  const a = clean(accepted);
  if (g === "" || a === "") return false;
  if (g.toLowerCase() === a.toLowerCase()) return true;
  // Only plain decimals compare by value: no 0x / 0b / 1e3 literals, no second separator.
  const DECIMAL = /^[+-]?(\d+([.,]\d+)?|[.,]\d+)$/;
  if (!DECIMAL.test(g) || !DECIMAL.test(a)) return false;
  const leadingZero = (s: string) => /^[+-]?0\d/.test(s);
  if (leadingZero(a) || leadingZero(g)) return false;
  const gn = Number(g.replace(",", "."));
  const an = Number(a.replace(",", "."));
  return Number.isFinite(gn) && Number.isFinite(an) && Math.abs(gn - an) < 1e-9;
}

export function isAnswered(type: AnswerType, response: Response): boolean {
  if (response == null) return false;
  switch (type) {
    case "single":
    case "numeric":
    case "short_text":
      return typeof response === "string" && response.trim() !== "";
    case "multi":
    case "order":
      return isArr(response) && response.length > 0;
    case "match":
      return isMap(response) && Object.values(response).some((v) => v);
  }
}

/** Fraction of credit in [0, 1] before points are applied. */
function fraction(q: GradableQuestion, response: Response): number {
  const { correct } = q;
  if (correct == null) return 0;
  const partial = q.scoring === "partial";

  switch (q.answer_type) {
    case "single":
      return typeof response === "string" && typeof correct === "string" && response === correct ? 1 : 0;

    case "multi": {
      if (!isArr(correct) || !isArr(response)) return 0;
      const want = new Set(correct);
      const got = new Set(response);
      const hits = Array.from(got).filter((x) => want.has(x)).length;
      const wrong = got.size - hits;
      if (hits === want.size && wrong === 0) return 1;
      if (!partial || want.size === 0) return 0;
      // Each wrong pick cancels a right one, so ticking everything earns nothing.
      return Math.max(0, (hits - wrong) / want.size);
    }

    case "order": {
      if (!isArr(correct) || !isArr(response)) return 0;
      const same = correct.length === response.length && correct.every((x, i) => response[i] === x);
      if (same) return 1;
      if (!partial || correct.length === 0) return 0;
      return correct.filter((x, i) => response[i] === x).length / correct.length;
    }

    case "match": {
      if (!isMap(correct) || !isMap(response)) return 0;
      const slots = Object.keys(correct);
      if (slots.length === 0) return 0;
      const right = slots.filter((s) => response[s] && response[s] === correct[s]).length;
      if (right === slots.length) return 1;
      return partial ? right / slots.length : 0;
    }

    case "numeric": {
      if (typeof response !== "string" || !isArr(correct)) return 0;
      return correct.some((a) => numericEquals(response, a)) ? 1 : 0;
    }

    case "short_text": {
      if (typeof response !== "string" || !isArr(correct)) return 0;
      const r = normText(response);
      return correct.some((a) => normText(a) === r) ? 1 : 0;
    }
  }
}

export function gradeQuestion(q: GradableQuestion, response: Response): ItemResult {
  const max = Number(q.points) > 0 ? Number(q.points) : 1;
  const f = fraction(q, response);
  const earned = Math.round(f * max * 1000) / 1000;
  return { earned, max, correct: f === 1, answered: isAnswered(q.answer_type, response) };
}

export interface AttemptGrade {
  score: number;
  maxScore: number;
  /** 0–100, two decimals. */
  percent: number;
  items: Record<string, ItemResult>;
}

export function gradeAttempt(
  questions: (GradableQuestion & { id: string })[],
  answers: Record<string, Response>,
): AttemptGrade {
  const items: Record<string, ItemResult> = {};
  let score = 0;
  let maxScore = 0;
  for (const q of questions) {
    const r = gradeQuestion(q, answers[q.id]);
    items[q.id] = r;
    score += r.earned;
    maxScore += r.max;
  }
  score = Math.round(score * 1000) / 1000;
  const percent = maxScore > 0 ? Math.round((score / maxScore) * 10000) / 100 : 0;
  return { score, maxScore, percent, items };
}

// ---------------------------------------------------------------------------
// Validation of a stored correct answer
// ---------------------------------------------------------------------------

/** Problems that make a question ungradable, or [] when it is fine. */
export function validateCorrect(q: {
  answer_type: AnswerType;
  correct: unknown;
  options: Choice[];
  match_slots: Choice[];
}): string[] {
  const optionIds = new Set(q.options.map((o) => o.id));
  const errs: string[] = [];
  const c = q.correct;
  const unknownIds = (ids: string[]) => ids.filter((x) => !optionIds.has(x));

  switch (q.answer_type) {
    case "single":
      if (typeof c !== "string" || !c) errs.push("No correct option set");
      else if (!optionIds.has(c)) errs.push(`Correct option "${c}" is not one of the options`);
      break;
    case "multi":
    case "order":
      if (!isArr(c) || c.length === 0) errs.push("No correct options set");
      else {
        const bad = unknownIds(c);
        if (bad.length) errs.push(`Not an option: ${bad.join(", ")}`);
        if (new Set(c).size !== c.length) errs.push("An option appears twice");
      }
      break;
    case "match": {
      if (!isMap(c) || Object.keys(c).length === 0) {
        errs.push("No matches set");
        break;
      }
      const slotIds = new Set(q.match_slots.map((s) => s.id));
      const badSlots = Object.keys(c).filter((s) => !slotIds.has(s));
      if (badSlots.length) errs.push(`Not a slot: ${badSlots.join(", ")}`);
      const bad = unknownIds(Object.values(c));
      if (bad.length) errs.push(`Not an option: ${bad.join(", ")}`);
      break;
    }
    case "numeric":
    case "short_text":
      if (!isArr(c) || c.filter((x) => x.trim()).length === 0) errs.push("No accepted answer set");
      break;
  }
  if (q.answer_type !== "numeric" && q.answer_type !== "short_text" && q.options.length === 0) {
    errs.push("No options");
  }
  if (q.answer_type === "match" && q.match_slots.length === 0) errs.push("No match slots");
  return errs;
}

// ---------------------------------------------------------------------------
// Answer-key parsing (text layer of the key PDF, or pasted text)
// ---------------------------------------------------------------------------

export interface ParsedKey {
  /** question number → raw key cell as printed, e.g. "2,4,7" or "1; 3; 5". */
  raw: Record<string, string>;
  /** Expected numbers the parser could not find. */
  missing: string[];
  warnings: string[];
  strategy: "pairs" | "lines" | "glued";
}

/** A word of 3+ letters marks a heading line ("Թեստ 1", "Պատասխաններ", mojibake titles). */
// Latin, Latin-1 (mojibake titles), Greek, Cyrillic, Armenian. ES5 target: no \p{L}.
const HEADER_WORD = /[A-Za-z\u00C0-\u024F\u0370-\u03FF\u0400-\u04FF\u0531-\u0587]{3,}/;
const stripDot = (t: string) => t.replace(/\.$/, "");

function contentLines(text: string): string[] {
  return text
    .normalize("NFC")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !HEADER_WORD.test(l));
}

/** Tokens, with "1;" "3;" "5" / "1," "3" glued back into one answer cell. */
function tokens(line: string): string[] {
  const raw = line.split(/\s+/).filter(Boolean);
  const out: string[] = [];
  for (const t of raw) {
    const prev = out[out.length - 1];
    if (prev && /[,;]$/.test(prev)) out[out.length - 1] = `${prev} ${t}`;
    else if (prev && /^[,;]/.test(t)) out[out.length - 1] = `${prev}${t}`;
    else out.push(t);
  }
  return out;
}

/**
 * Strategy 1 — strict label/answer alternation over the whole document. Fits keys
 * whose cells are each on their own line (and answers that wrap to the next line).
 */
function parsePairs(text: string, expected: string[]): ParsedKey {
  const want = new Set(expected);
  const toks = contentLines(text).flatMap(tokens);
  const raw: Record<string, string> = {};
  const warnings: string[] = [];
  let i = toks.findIndex((t) => want.has(stripDot(t)));
  if (i < 0) i = toks.length;
  while (i < toks.length) {
    const label = stripDot(toks[i]);
    const answer = toks[i + 1];
    if (!want.has(label) || label in raw) {
      warnings.push(`Unexpected token "${toks[i]}"`);
      i += 1;
      continue;
    }
    if (answer === undefined) {
      warnings.push(`No answer after ${label}`);
      break;
    }
    raw[label] = answer;
    i += 2;
  }
  return { raw, missing: expected.filter((n) => !(n in raw)), warnings, strategy: "pairs" };
}

/**
 * Strategy 2 — row by row. A token starts a new cell when it is an expected,
 * not-yet-seen number greater than the previous label on the row (columns run in
 * increasing ranges left to right). Everything up to the next label is the answer,
 * which handles space-separated multi answers such as "3  6  7".
 */
function parseLines(text: string, expected: string[]): ParsedKey {
  const order = new Map(expected.map((n, idx) => [n, idx]));
  const raw: Record<string, string> = {};
  const warnings: string[] = [];
  for (const line of contentLines(text)) {
    const toks = tokens(line);
    let current: string | null = null;
    let lastIdx = -1;
    const cell: string[] = [];
    const flush = () => {
      if (current !== null) {
        if (cell.length) raw[current] = cell.join(" ");
        else warnings.push(`No answer after ${current}`);
      }
      cell.length = 0;
    };
    for (const t of toks) {
      const n = stripDot(t);
      const idx = order.get(n);
      const isLabel = idx !== undefined && !(n in raw) && n !== current && idx > lastIdx && (current === null || cell.length > 0);
      if (isLabel) {
        flush();
        current = n;
        lastIdx = idx!;
      } else if (current !== null) {
        cell.push(t);
      }
    }
    flush();
  }
  return { raw, missing: expected.filter((n) => !(n in raw)), warnings, strategy: "lines" };
}

/**
 * Strategy 3 — rows whose cells the PDF glued together with no spaces, e.g.
 * "12411120" = (1 → 2)(41 → 1120). The key is a two-column table, so each row is
 * <left label><answer><right label><answer>, labels running in order down each
 * column. A right-hand answer can spill onto the next line on its own. The column
 * split is unknown, so every split is tried and the one that places most wins.
 */
function parseGlued(text: string, expected: string[]): ParsedKey {
  const lines = contentLines(text).map((l) => l.replace(/\s+/g, ""));
  let best: ParsedKey = { raw: {}, missing: expected, warnings: [], strategy: "glued" };
  for (let split = 1; split < expected.length; split++) {
    const raw: Record<string, string> = {};
    const warnings: string[] = [];
    let li = 0;
    let ri = split;
    let pending: string | null = null;
    for (const line of lines) {
      const L = li < split ? expected[li] : undefined;
      const R = ri < expected.length ? expected[ri] : undefined;
      const isRow = L !== undefined && line.startsWith(L) && line.length > L.length;
      const rest = isRow ? line.slice(L!.length) : "";
      const rowHasRight = isRow && R !== undefined && rest.indexOf(R, 1) >= 1;
      if (pending !== null && !rowHasRight) {
        raw[pending] = line;
        pending = null;
        continue;
      }
      if (!isRow) {
        warnings.push(`Unexpected line "${line}"`);
        continue;
      }
      if (rowHasRight) {
        const at = rest.indexOf(R!, 1);
        raw[L!] = rest.slice(0, at);
        const right = rest.slice(at + R!.length);
        if (right) raw[R!] = right;
        else pending = R!;
        ri++;
      } else {
        raw[L!] = rest;
      }
      li++;
    }
    const cand: ParsedKey = { raw, missing: expected.filter((n) => !(n in raw)), warnings, strategy: "glued" };
    const better =
      Object.keys(cand.raw).length > Object.keys(best.raw).length ||
      (Object.keys(cand.raw).length === Object.keys(best.raw).length && cand.warnings.length < best.warnings.length);
    if (better) best = cand;
  }
  return best;
}

/**
 * Parse a key's text. Every strategy runs; the one that places the most expected
 * questions (then fewest warnings) wins. The admin always reviews the result.
 */
export function parseKeyText(text: string, expectedNumbers: string[]): ParsedKey {
  const candidates = [
    parsePairs(text, expectedNumbers),
    parseLines(text, expectedNumbers),
    parseGlued(text, expectedNumbers),
  ];
  const score = (p: ParsedKey) => Object.keys(p.raw).length * 1000 - p.warnings.length;
  return candidates.reduce((a, b) => (score(b) > score(a) ? b : a));
}

const ARMENIAN_ALPHABET = "աբգդեզէըթժիլխծկհձղճմյնշոչպջռսվտրցւփքօֆ";
const LATIN = "abcdefghijklmnopqrstuvwxyz";
const CYRILLIC = "абвгдежзиклмнопрстуфхцчшщэюя";

/** 1-based alphabet position of a letter label, or null. */
function letterIndex(ch: string): number | null {
  const c = ch.toLowerCase();
  for (const alpha of [ARMENIAN_ALPHABET, LATIN, CYRILLIC]) {
    const i = alpha.indexOf(c);
    if (i >= 0) return i + 1;
  }
  return null;
}

/** Split "2,4,7" / "2.4.7" / "1; 3; 5" / "2 4" / "257" into ids. */
export function splitKeyCell(cell: string): string[] {
  const s = cell.normalize("NFC").trim().replace(/\.$/, "");
  if (/[,;.\s]/.test(s)) return s.split(/[,;.\s]+/).filter(Boolean);
  // Run-together single characters: "257" → 2,5,7 (keys never use option 10+).
  return Array.from(s);
}

export interface NormalizedKey {
  correct: Correct | null;
  warnings: string[];
}

/**
 * Turn a raw key cell into the typed correct answer for one question. Ids that are
 * not option labels are mapped by alphabet position when the key uses letters for
 * numbered options (e.g. history "դ,գ,բ" → "4,3,2"), with a warning.
 */
export function normalizeKeyCell(
  cell: string,
  q: { answer_type: AnswerType; options: Choice[]; match_slots: Choice[] },
): NormalizedKey {
  const warnings: string[] = [];
  const optionIds = q.options.map((o) => o.id);
  const optSet = new Set(optionIds);
  const lowerMap = new Map(optionIds.map((id) => [id.toLowerCase(), id]));

  const mapId = (t: string): string => {
    if (optSet.has(t)) return t;
    const ci = lowerMap.get(t.toLowerCase());
    if (ci) return ci;
    const pos = letterIndex(t);
    if (pos !== null && optionIds[pos - 1] !== undefined) {
      warnings.push(`Key uses "${t}"; read as option ${optionIds[pos - 1]} by alphabet position`);
      return optionIds[pos - 1];
    }
    if (/^\d+$/.test(t)) {
      // Numeric key for letter-labelled options: 1 → first option.
      const byIndex = optionIds[Number(t) - 1];
      if (byIndex !== undefined && !optSet.has(t)) {
        warnings.push(`Key uses "${t}"; read as option ${byIndex} by position`);
        return byIndex;
      }
    }
    warnings.push(`"${t}" is not an option label`);
    return t;
  };

  const trimmed = cell.trim();
  if (!trimmed) return { correct: null, warnings: ["Empty key cell"] };

  switch (q.answer_type) {
    case "single": {
      const parts = splitKeyCell(trimmed);
      if (parts.length !== 1) warnings.push(`Expected one option, key has "${trimmed}"`);
      return { correct: mapId(parts.join("")), warnings };
    }
    case "multi":
    case "order":
      return { correct: splitKeyCell(trimmed).map(mapId), warnings };
    case "match": {
      const ids = splitKeyCell(trimmed).map(mapId);
      const slots = q.match_slots.map((s) => s.id);
      if (ids.length !== slots.length) {
        warnings.push(`Key has ${ids.length} matches for ${slots.length} slots — check the slot mapping`);
      }
      const out: Record<string, string> = {};
      slots.forEach((s, i) => {
        if (ids[i] !== undefined) out[s] = ids[i];
      });
      return { correct: out, warnings };
    }
    case "numeric":
    case "short_text":
      return { correct: [trimmed], warnings };
  }
}

/** Equality of two correct answers, for the import diff. */
export function sameCorrect(a: Correct | null | undefined, b: Correct | null | undefined): boolean {
  return JSON.stringify(canon(a)) === JSON.stringify(canon(b));
}

function canon(v: Correct | null | undefined): unknown {
  if (v == null) return null;
  if (isMap(v)) return Object.keys(v).sort().map((k) => [k, v[k]]);
  return v;
}

/** Short human form of a correct answer for tables: "2, 5, 7" / "A→6, B→2". */
export function formatCorrect(type: AnswerType, c: Correct | null | undefined): string {
  if (c == null) return "—";
  if (typeof c === "string") return c;
  if (Array.isArray(c)) return type === "order" ? c.join(" → ") : c.join(", ");
  return Object.entries(c)
    .map(([k, v]) => `${k}→${v}`)
    .join(", ");
}
