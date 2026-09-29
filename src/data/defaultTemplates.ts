import { makeField } from '../core/fieldCatalog';
import type { ChequeField, ChequeTemplate } from '../core/types';

export const BANK_NAMES = ['بنك مصر', 'بنك QNB الأهلي', 'البنك الأهلي المصري'] as const;

/**
 * Starting coordinates traced from a 21.7 × 8.3 cm Banque Misr cheque scan.
 * They are close but not exact — every template must be verified in the designer
 * against the user's own printer before production use.
 */
function banqueMisrFields(): ChequeField[] {
  return [
    makeField('date', {
      x: 143, y: 11, w: 24, h: 7, align: 'left', rtl: false,
      letterSpacing: 0.9, fontSize: 10, dateFormat: 'ddmmyyyy',
    }),
    makeField('beneficiary', { x: 50, y: 28.5, w: 90, h: 8, fontSize: 12 }),
    makeField('amountWords', { x: 50, y: 40, w: 90, h: 7 }),
    makeField('amountWordsLine2', { x: 50, y: 47, w: 90, h: 7 }),
    makeField('amountNumber', {
      x: 145, y: 41, w: 22, h: 7, align: 'center', rtl: false, fontSize: 12, bold: true,
    }),
    makeField('accountName', { x: 148, y: 58, w: 56, h: 7, fontSize: 10 }),
    makeField('signatory', { x: 148, y: 66, w: 56, h: 7, fontSize: 10 }),
  ];
}

/** Generic starting layout for banks with no reference scan yet. */
function placeholderFields(): ChequeField[] {
  return [
    makeField('date', { x: 140, y: 12, w: 28, h: 7, align: 'left', rtl: false, fontSize: 12 }),
    makeField('beneficiary', { x: 45, y: 30, w: 90, h: 8, fontSize: 12 }),
    makeField('amountWords', { x: 45, y: 42, w: 90, h: 7 }),
    makeField('amountWordsLine2', { x: 45, y: 49, w: 90, h: 7 }),
    makeField('amountNumber', { x: 142, y: 42, w: 25, h: 7, align: 'center', rtl: false, fontSize: 12, bold: true }),
    makeField('signatory', { x: 145, y: 64, w: 55, h: 7, fontSize: 10 }),
  ];
}

export function defaultTemplateFor(bankId: number, bankName: string): ChequeTemplate {
  const isBanqueMisr = bankName === BANK_NAMES[0];
  return {
    bankId,
    name: 'نموذج 1',
    widthMm: 217,
    heightMm: 83,
    fields: isBanqueMisr ? banqueMisrFields() : placeholderFields(),
    needsCalibration: true,
    offsetX: 0,
    offsetY: 0,
  };
}
