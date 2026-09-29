import { amountToWords } from '../core/amountToWords';
import type { ChequeDraft } from '../core/chequeDraft';
import { db } from './db';
import type { ChequeRecord, ChequeStatus, ChequeTemplate, Direction, Lang } from '../core/types';

export interface SaveChequeArgs {
  draft: ChequeDraft;
  template: ChequeTemplate;
  companyId: number;
  direction: Direction;
  status: ChequeStatus;
  lang: Lang;
}

export function buildRecord({
  draft,
  template,
  companyId,
  direction,
  status,
  lang,
}: SaveChequeArgs): ChequeRecord {
  return {
    bankId: template.bankId,
    companyId,
    templateId: template.id!,
    direction,
    date: draft.date,
    beneficiary: draft.beneficiary,
    amount: draft.amount,
    currency: draft.currency,
    amountWords: amountToWords(draft.amount, draft.currency, lang),
    signatory: draft.signatory,
    chequeNumber: draft.chequeNumber || undefined,
    city: draft.city || undefined,
    notes: draft.notes || undefined,
    status,
    createdAt: new Date().toISOString(),
    layoutSnapshot: structuredClone(template.fields),
    widthMm: template.widthMm,
    heightMm: template.heightMm,
  };
}

export async function saveCheque(args: SaveChequeArgs): Promise<number> {
  return db.cheques.add(buildRecord(args));
}

export function recordToDraft(record: ChequeRecord): ChequeDraft {
  return {
    date: record.date,
    beneficiary: record.beneficiary,
    amount: record.amount,
    currency: record.currency,
    signatory: record.signatory,
    accountName: '',
    accountNumber: '',
    chequeNumber: record.chequeNumber ?? '',
    city: record.city ?? '',
    notes: record.notes ?? '',
  };
}
