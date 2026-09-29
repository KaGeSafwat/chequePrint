export type FieldKey =
  | 'date'
  | 'beneficiary'
  | 'amountNumber'
  | 'amountWords'
  | 'amountWordsLine2'
  | 'signatory'
  | 'accountName'
  | 'accountNumber'
  | 'chequeNumber'
  | 'currencyCode'
  | 'city'
  | 'notes'
  | 'static';

export type TextAlign = 'right' | 'center' | 'left';
export type Direction = 'issued' | 'received';
export type ChequeStatus = 'draft' | 'printed' | 'cancelled';
export type Lang = 'ar' | 'en';

/** All geometry is in millimetres, measured from the top-left corner of the cheque. */
export interface ChequeField {
  id: string;
  key: FieldKey;
  label: string;
  x: number;
  y: number;
  w: number;
  h: number;
  fontFamily: string;
  fontSize: number; // points
  bold: boolean;
  align: TextAlign;
  rtl: boolean;
  letterSpacing: number; // mm — used to line digits up with pre-printed boxes
  multiline: boolean;
  visible: boolean;
  staticText?: string;
  dateFormat?: DateFormat;
}

export const DATE_FORMATS = ['dd/mm/yyyy', 'dd-mm-yyyy', 'yyyy/mm/dd', 'ddmmyyyy', 'yyyymmdd'] as const;
export type DateFormat = (typeof DATE_FORMATS)[number];

export interface Bank {
  id?: number;
  name: string;
  builtIn: boolean;
}

export interface Company {
  id?: number;
  name: string;
  accountNumber?: string;
}

export interface ChequeTemplate {
  id?: number;
  bankId: number;
  name: string;
  widthMm: number;
  heightMm: number;
  backgroundImage?: string; // data URL of a scanned cheque, preview only
  fields: ChequeField[];
  needsCalibration: boolean;
  offsetX: number; // print calibration nudge, mm
  offsetY: number;
}

export interface ChequeRecord {
  id?: number;
  bankId: number;
  companyId: number;
  templateId: number;
  direction: Direction;
  date: string; // yyyy-mm-dd
  beneficiary: string;
  amount: number;
  currency: string;
  amountWords: string;
  signatory: string;
  chequeNumber?: string;
  city?: string;
  notes?: string;
  status: ChequeStatus;
  createdAt: string;
  /** Layout frozen at print time so later template edits never break a reprint. */
  layoutSnapshot: ChequeField[];
  widthMm: number;
  heightMm: number;
}

export interface AppSettings {
  key: 'app';
  activeCompanyId?: number;
  activeBankId?: number;
  activeTemplateId?: number;
  printBackground: boolean;
  wordsLang: Lang;
  defaultCurrency: string;
}
