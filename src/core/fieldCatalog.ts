import type { ChequeField, FieldKey } from './types';

export const FIELD_LABELS: Record<FieldKey, string> = {
  date: 'التاريخ',
  beneficiary: 'اسم المستفيد',
  amountNumber: 'المبلغ بالأرقام',
  amountWords: 'المبلغ كتابةً (سطر ١)',
  amountWordsLine2: 'المبلغ كتابةً (سطر ٢)',
  signatory: 'اسم موقّع الشيك',
  accountName: 'اسم صاحب الحساب',
  accountNumber: 'رقم الحساب',
  chequeNumber: 'رقم الشيك',
  currencyCode: 'رمز العملة',
  city: 'المدينة',
  notes: 'ملاحظات',
  static: 'نص ثابت',
};

export const FIELD_KEYS = Object.keys(FIELD_LABELS) as FieldKey[];

export const FONT_FAMILIES = [
  'Arial',
  'Tahoma',
  'Segoe UI',
  'Times New Roman',
  'Courier New',
  'Calibri',
  'Simplified Arabic',
];

let seq = 0;
export function newFieldId(): string {
  seq += 1;
  return `f${Date.now().toString(36)}${seq.toString(36)}`;
}

export function makeField(key: FieldKey, patch: Partial<ChequeField> = {}): ChequeField {
  return {
    id: newFieldId(),
    key,
    label: FIELD_LABELS[key],
    x: 20,
    y: 20,
    w: 60,
    h: 7,
    fontFamily: 'Arial',
    fontSize: 11,
    bold: false,
    align: 'right',
    rtl: true,
    letterSpacing: 0,
    multiline: false,
    visible: true,
    ...(key === 'date' ? { dateFormat: 'dd/mm/yyyy' as const } : {}),
    ...patch,
  };
}
