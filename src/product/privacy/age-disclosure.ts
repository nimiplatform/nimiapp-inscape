// @nimi-authority: rule.inscape.privacy.r003
// Text matches are candidates only. A user must confirm current age and
// attribution before quarantine. Clear quoted/historical forms are excluded.
const ENGLISH_AGES = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven',
  'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen',
  'sixteen', 'seventeen'];
const AGE = `(?:\\d{1,2}|${ENGLISH_AGES.join('|')}|[零一二三四五六七八九十]{1,3})`;

function ageNumber(value: string): number {
  if (/^\d+$/.test(value)) return Number(value);
  const english = ENGLISH_AGES.indexOf(value.toLowerCase());
  if (english >= 0) return english;
  const digits = '零一二三四五六七八九';
  if (value === '十') return 10;
  if (value.startsWith('十')) return 10 + digits.indexOf(value[1]);
  return value.length === 1 ? digits.indexOf(value) : 99;
}

function withoutQuotes(text: string): string {
  const closing: Record<string, string> = { '"': '"', '“': '”', '「': '」', '『': '』', '‘': '’' };
  let quote = '';
  let result = '';
  for (let index = 0; index < text.length; index++) {
    const character = text[index];
    const apostrophe = character === "'" && /[\p{L}\p{N}]/u.test(text[index - 1] ?? '') && /[\p{L}\p{N}]/u.test(text[index + 1] ?? '');
    if (quote) { if (character === quote && !apostrophe) { quote = ''; result += ' '; } }
    else if (closing[character] || (character === "'" && !apostrophe)) { quote = closing[character] ?? "'"; result += ' '; }
    else result += character;
  }
  return result;
}

function hasMinorAge(text: string, zhSubject: string, enSubject: string): boolean {
  const zh = new RegExp(`${zhSubject}(?:今年|现在|目前|已经|刚满)?(?:才|只有|是)?\\s*(${AGE})\\s*(?:周岁|岁)(?!的时候|时|那年|以前|以后)`, 'giu');
  const en = new RegExp(`${enSubject}\\s+(?:currently\\s+|only\\s+|now\\s+)?(${AGE})(?:\\s+years?\\s+(?:old|of\\s+age)\\b|(?=\\s*(?:[.!?;,，。！；]|$|and\\b|but\\b)))`, 'giu');
  return [zh, en].some((pattern) => [...text.matchAll(pattern)].some((match) => {
    const age = ageNumber(match[1]);
    return age >= 0 && age < 18;
  })) || new RegExp(`${zhSubject}(?:还)?(?:未满|不满)\\s*18\\s*(?:周岁|岁)(?!时)|${zhSubject}(?:还)?(?:是)?未成年(?!时)`, 'u').test(text)
    || new RegExp(`${enSubject}\\s+(?:still\\s+)?(?:under\\s+(?:18|eighteen)|a\\s+minor)\\b`, 'iu').test(text);
}

export function findUnder18Candidate(
  text: string,
  otherName?: string,
  allowOtherPronouns = false,
): 'self' | 'other' | null {
  const statement = withoutQuotes(text);
  if (hasMinorAge(statement, '(?:我|本人)', "\\bI(?:\\s+am|['’]m)")) return 'self';
  if (otherName) {
    const name = otherName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const zh = allowOtherPronouns ? `(?:${name}|对方|他|她)` : `(?:${name})`;
    const namedEnglish = `(?<![\\p{L}\\p{N}])${name}(?![\\p{L}\\p{N}])\\s+is`;
    const en = allowOtherPronouns
      ? `(?:\\b(?:he|she|the other person)\\s+is|\\bthey\\s+are|${namedEnglish})`
      : `(?:${namedEnglish})`;
    if (hasMinorAge(statement, zh, en)) return 'other';
  }
  return null;
}
