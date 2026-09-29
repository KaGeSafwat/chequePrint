import { describe, it, expect } from 'vitest';
import { arabicNumberToWords, englishNumberToWords, amountToWords } from './amountToWords';

describe('arabicNumberToWords', () => {
  const cases: [number, string][] = [
    [0, 'صفر'],
    [1, 'واحد'],
    [10, 'عشرة'],
    [11, 'أحد عشر'],
    [21, 'واحد وعشرون'],
    [100, 'مائة'],
    [200, 'مائتان'],
    [345, 'ثلاثمائة وخمسة وأربعون'],
    [1000, 'ألف'],
    [2000, 'ألفان'],
    [3000, 'ثلاثة آلاف'],
    [11000, 'أحد عشر ألف'],
    [25000, 'خمسة وعشرون ألف'],
    [100000, 'مائة ألف'],
    [1000000, 'مليون'],
    [2000000, 'مليونان'],
    [1234567, 'مليون ومائتان وأربعة وثلاثون ألف وخمسمائة وسبعة وستون'],
  ];

  it.each(cases)('converts %i', (input, expected) => {
    expect(arabicNumberToWords(input)).toBe(expected);
  });
});

describe('amountToWords', () => {
  it('wraps whole amounts in the cheque phrase', () => {
    expect(amountToWords(25000, 'EGP')).toBe('فقط خمسة وعشرون ألف جنيه مصري لا غير');
  });

  it('appends subunits when present', () => {
    expect(amountToWords(1500.5, 'EGP')).toBe('فقط ألف وخمسمائة جنيه مصري وخمسون قرش لا غير');
  });

  it('rounds float drift to the nearest subunit', () => {
    expect(amountToWords(0.1 + 0.2, 'EGP')).toBe('فقط صفر جنيه مصري وثلاثون قرش لا غير');
  });

  it('supports other currencies', () => {
    expect(amountToWords(12, 'USD')).toBe('فقط اثنا عشر دولار أمريكي لا غير');
  });

  it('supports english', () => {
    expect(amountToWords(25000, 'EGP', 'en')).toBe('Only Twenty-Five Thousand Egyptian Pounds Only');
  });
});

describe('englishNumberToWords', () => {
  it('handles hundreds with remainder', () => {
    expect(englishNumberToWords(345)).toBe('Three Hundred and Forty-Five');
  });

  it('handles millions', () => {
    expect(englishNumberToWords(1234567)).toBe(
      'One Million Two Hundred and Thirty-Four Thousand Five Hundred and Sixty-Seven',
    );
  });
});
