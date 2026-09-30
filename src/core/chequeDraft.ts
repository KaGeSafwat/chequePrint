import { amountToWords, formatAmountNumber, getCurrency } from './amountToWords';
import type { ChequeField, DateFormat, Lang } from './types';

export interface ChequeDraft {
  date: string; // yyyy-mm-dd
  beneficiary: string;
  amount: number;
  currency: string;
  signatory: string;
  accountName: string;
  accountNumber: string;
  chequeNumber: string;
  city: string;
  notes: string;
}

export const EMPTY_DRAFT: ChequeDraft = {
  date: new Date().toISOString().slice(0, 10),
  beneficiary: '',
  amount: 0,
  currency: 'EGP',
  signatory: '',
  accountName: '',
  accountNumber: '',
  chequeNumber: '',
  city: '',
  notes: '',
};

export function formatDate(iso: string, format: DateFormat = 'dd/mm/yyyy'): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) return '';
  const [, yyyy, mm, dd] = match;
  switch (format) {
    case 'dd-mm-yyyy':
      return `${dd}-${mm}-${yyyy}`;
    case 'yyyy/mm/dd':
      return `${yyyy}/${mm}/${dd}`;
    case 'ddmmyyyy':
      return `${dd}${mm}${yyyy}`;
    case 'yyyymmdd':
      return `${yyyy}${mm}${dd}`;
    default:
      return `${dd}/${mm}/${yyyy}`;
  }
}

/** Longest word-boundary prefix that fits `limit` characters, plus the remainder. */
function splitWords(text: string, limit: number): [string, string] {
  if (text.length <= limit) return [text, ''];
  const cut = text.lastIndexOf(' ', limit);
  const at = cut > 0 ? cut : limit;
  return [text.slice(0, at).trim(), text.slice(at).trim()];
}

/** Rough characters-per-line estimate for a box of `w` mm at `fontSize` pt. */
function charCapacity(field: ChequeField): number {
  const mmPerChar = (field.fontSize * 25.4) / 72 / 2.1;
  return Math.max(8, Math.floor(field.w / mmPerChar));
}

export function resolveFieldValue(field: ChequeField, draft: ChequeDraft, lang: Lang): string {
  switch (field.key) {
    case 'date':
      return formatDate(draft.date, field.dateFormat);
    case 'beneficiary':
      return draft.beneficiary;
    case 'amountNumber':
      return formatAmountNumber(draft.amount);
    case 'amountWords':
      return amountToWords(draft.amount, draft.currency, lang);
    case 'amountWordsLine2':
      return '';
    case 'signatory':
      return draft.signatory;
    case 'accountName':
      return draft.accountName;
    case 'accountNumber':
      return draft.accountNumber;
    case 'chequeNumber':
      return draft.chequeNumber;
    case 'currencyCode':
      return getCurrency(draft.currency).symbol;
    case 'city':
      return draft.city;
    case 'notes':
      return draft.notes;
    case 'static':
      return field.staticText ?? '';
    default:
      return '';
  }
}

/**
 * Resolves every field at once so the amount-in-words can overflow from its first
 * line into the second one when the template provides both.
 */
export function resolveValues(
  fields: ChequeField[],
  draft: ChequeDraft,
  lang: Lang,
): Record<string, string> {
  const values: Record<string, string> = {};
  for (const field of fields) values[field.id] = resolveFieldValue(field, draft, lang);

  const line1 = fields.find((f) => f.key === 'amountWords' && f.visible);
  const line2 = fields.find((f) => f.key === 'amountWordsLine2' && f.visible);
  if (line1 && !line1.multiline) {
    const [head, tail] = splitWords(values[line1.id], charCapacity(line1));
    values[line1.id] = head;
    if (line2) values[line2.id] = tail;
  }
  return values;
}

/**
 * True when the amount-in-words text would not fully fit in the template's field(s),
 * meaning the printed cheque would show a shortened, legally incorrect amount.
 */
export function isAmountWordsTruncated(fields: ChequeField[], draft: ChequeDraft, lang: Lang): boolean {
  const line1 = fields.find((f) => f.key === 'amountWords' && f.visible);
  if (!line1 || line1.multiline) return false;

  const full = resolveFieldValue(line1, draft, lang);
  const [, tail] = splitWords(full, charCapacity(line1));
  if (!tail) return false;

  const line2 = fields.find((f) => f.key === 'amountWordsLine2' && f.visible);
  if (!line2) return true;

  const [, tail2] = splitWords(tail, charCapacity(line2));
  return tail2.length > 0;
}
