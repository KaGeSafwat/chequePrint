import type { Lang } from './types';

export interface Currency {
  code: string;
  symbol: string;
  arMain: string;
  arSub: string;
  enMain: string;
  enSub: string;
}

export const CURRENCIES: Currency[] = [
  { code: 'EGP', symbol: 'EGP', arMain: 'جنيه مصري', arSub: 'قرش', enMain: 'Egyptian Pounds', enSub: 'Piastres' },
  { code: 'USD', symbol: 'USD', arMain: 'دولار أمريكي', arSub: 'سنت', enMain: 'US Dollars', enSub: 'Cents' },
  { code: 'EUR', symbol: 'EUR', arMain: 'يورو', arSub: 'سنت', enMain: 'Euros', enSub: 'Cents' },
  { code: 'GBP', symbol: 'GBP', arMain: 'جنيه إسترليني', arSub: 'بنس', enMain: 'Pounds Sterling', enSub: 'Pence' },
  { code: 'SAR', symbol: 'SAR', arMain: 'ريال سعودي', arSub: 'هللة', enMain: 'Saudi Riyals', enSub: 'Halalas' },
  { code: 'AED', symbol: 'AED', arMain: 'درهم إماراتي', arSub: 'فلس', enMain: 'UAE Dirhams', enSub: 'Fils' },
];

export function getCurrency(code: string): Currency {
  return CURRENCIES.find((c) => c.code === code) ?? CURRENCIES[0];
}

const AR_ONES = ['', 'واحد', 'اثنان', 'ثلاثة', 'أربعة', 'خمسة', 'ستة', 'سبعة', 'ثمانية', 'تسعة'];
const AR_TEENS = [
  'عشرة', 'أحد عشر', 'اثنا عشر', 'ثلاثة عشر', 'أربعة عشر',
  'خمسة عشر', 'ستة عشر', 'سبعة عشر', 'ثمانية عشر', 'تسعة عشر',
];
const AR_TENS = ['', '', 'عشرون', 'ثلاثون', 'أربعون', 'خمسون', 'ستون', 'سبعون', 'ثمانون', 'تسعون'];
const AR_HUNDREDS = [
  '', 'مائة', 'مائتان', 'ثلاثمائة', 'أربعمائة',
  'خمسمائة', 'ستمائة', 'سبعمائة', 'ثمانمائة', 'تسعمائة',
];

/** [singular, dual, plural] for each 1000^n scale. */
const AR_SCALES: [string, string, string][] = [
  ['', '', ''],
  ['ألف', 'ألفان', 'آلاف'],
  ['مليون', 'مليونان', 'ملايين'],
  ['مليار', 'ملياران', 'مليارات'],
  ['تريليون', 'تريليونان', 'تريليونات'],
];

function arUnder100(n: number): string {
  if (n < 10) return AR_ONES[n];
  if (n < 20) return AR_TEENS[n - 10];
  const unit = n % 10;
  const ten = Math.floor(n / 10);
  return unit ? `${AR_ONES[unit]} و${AR_TENS[ten]}` : AR_TENS[ten];
}

function arUnder1000(n: number): string {
  const hundreds = Math.floor(n / 100);
  const rest = n % 100;
  const parts: string[] = [];
  if (hundreds) parts.push(AR_HUNDREDS[hundreds]);
  if (rest) parts.push(arUnder100(rest));
  return parts.join(' و');
}

export function arabicNumberToWords(value: number): string {
  const n = Math.floor(Math.abs(value));
  if (n === 0) return 'صفر';
  if (n >= 1e15) return String(n);

  const groups: number[] = [];
  let rest = n;
  while (rest > 0) {
    groups.push(rest % 1000);
    rest = Math.floor(rest / 1000);
  }

  const parts: string[] = [];
  for (let i = groups.length - 1; i >= 0; i--) {
    const g = groups[i];
    if (!g) continue;
    if (i === 0) {
      parts.push(arUnder1000(g));
      continue;
    }
    const [one, two, many] = AR_SCALES[i];
    if (g === 1) parts.push(one);
    else if (g === 2) parts.push(two);
    else if (g <= 10) parts.push(`${arUnder1000(g)} ${many}`);
    else parts.push(`${arUnder1000(g)} ${one}`);
  }
  return parts.join(' و');
}

const EN_ONES = [
  'Zero', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
  'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen',
];
const EN_TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
const EN_SCALES = ['', 'Thousand', 'Million', 'Billion', 'Trillion'];

function enUnder1000(n: number): string {
  const parts: string[] = [];
  const hundreds = Math.floor(n / 100);
  const rest = n % 100;
  if (hundreds) parts.push(`${EN_ONES[hundreds]} Hundred`);
  if (rest) {
    if (hundreds) parts.push('and');
    if (rest < 20) parts.push(EN_ONES[rest]);
    else {
      const unit = rest % 10;
      parts.push(unit ? `${EN_TENS[Math.floor(rest / 10)]}-${EN_ONES[unit]}` : EN_TENS[Math.floor(rest / 10)]);
    }
  }
  return parts.join(' ');
}

export function englishNumberToWords(value: number): string {
  const n = Math.floor(Math.abs(value));
  if (n === 0) return 'Zero';
  if (n >= 1e15) return String(n);

  const groups: number[] = [];
  let rest = n;
  while (rest > 0) {
    groups.push(rest % 1000);
    rest = Math.floor(rest / 1000);
  }

  const parts: string[] = [];
  for (let i = groups.length - 1; i >= 0; i--) {
    if (!groups[i]) continue;
    parts.push(`${enUnder1000(groups[i])}${EN_SCALES[i] ? ' ' + EN_SCALES[i] : ''}`);
  }
  return parts.join(' ');
}

/** Splits into whole units and subunits, correcting binary float drift (e.g. 25000.145). */
function splitAmount(amount: number): { whole: number; sub: number } {
  const cents = Math.round(Math.abs(amount) * 100);
  return { whole: Math.floor(cents / 100), sub: cents % 100 };
}

/** Full cheque phrase, e.g. "فقط خمسة وعشرون ألف جنيه مصري لا غير". */
export function amountToWords(amount: number, currencyCode: string, lang: Lang = 'ar'): string {
  if (!Number.isFinite(amount)) return '';
  const currency = getCurrency(currencyCode);
  const { whole, sub } = splitAmount(amount);

  if (lang === 'en') {
    const parts = [`${englishNumberToWords(whole)} ${currency.enMain}`];
    if (sub) parts.push(`${englishNumberToWords(sub)} ${currency.enSub}`);
    return `Only ${parts.join(' and ')} Only`;
  }

  const parts = [`${arabicNumberToWords(whole)} ${currency.arMain}`];
  if (sub) parts.push(`${arabicNumberToWords(sub)} ${currency.arSub}`);
  return `فقط ${parts.join(' و')} لا غير`;
}

export function formatAmountNumber(amount: number): string {
  if (!Number.isFinite(amount)) return '';
  const { sub } = splitAmount(amount);
  return amount.toLocaleString('en-US', {
    minimumFractionDigits: sub ? 2 : 0,
    maximumFractionDigits: 2,
  });
}
