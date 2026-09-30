import { useMemo, useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import { usePrinter } from '../../components/PrintProvider';
import { getCurrency } from '../../core/amountToWords';
import {
  EMPTY_DRAFT,
  isAmountWordsTruncated,
  resolveValues,
  type ChequeDraft,
} from '../../core/chequeDraft';
import { saveCheque } from '../../data/chequeService';
import type { ChequeTemplate, Direction, Lang } from '../../core/types';

interface Props {
  template: ChequeTemplate;
  companyId: number;
  direction: Direction;
  lang: Lang;
  printBackground: boolean;
}

type FieldId =
  | 'date'
  | 'beneficiary'
  | 'amount'
  | 'currency'
  | 'signatory'
  | 'chequeNumber'
  | 'notes';

const COLUMN_HINTS: Record<FieldId, { label: string; keys: string[] }> = {
  date: { label: 'التاريخ', keys: ['التاريخ', 'تاريخ', 'date'] },
  beneficiary: {
    label: 'اسم المستفيد',
    keys: ['المستفيد', 'اسم المستفيد', 'beneficiary', 'name', 'payto'],
  },
  amount: { label: 'المبلغ', keys: ['المبلغ', 'القيمة', 'amount', 'value'] },
  currency: { label: 'العملة', keys: ['العملة', 'currency'] },
  signatory: {
    label: 'اسم الموقّع',
    keys: ['الموقع', 'الموقّع', 'signatory', 'signer'],
  },
  chequeNumber: {
    label: 'رقم الشيك',
    keys: ['رقم الشيك', 'chequeno', 'checkno', 'number'],
  },
  notes: { label: 'ملاحظات', keys: ['ملاحظات', 'notes', 'remarks'] },
};

const FIELD_IDS = Object.keys(COLUMN_HINTS) as FieldId[];

const ARABIC_DIACRITICS = /[\u064B-\u0652\u0640]/g;

function normalize(text: string): string {
  return text
    .toString()
    .trim()
    .toLowerCase()
    .replace(ARABIC_DIACRITICS, '')
    .replace(/[\u0623\u0625\u0622]/g, '\u0627')
    .replace(/\u0629/g, '\u0647')
    .replace(/\u0649/g, '\u064a')
    .replace(/[\s_-]/g, '');
}

function autoMap(headers: string[]): Record<FieldId, string> {
  const map = {} as Record<FieldId, string>;
  const taken = new Set<string>();
  for (const id of FIELD_IDS) {
    const hints = COLUMN_HINTS[id].keys.map(normalize);
    const match = headers.find((header) => {
      if (taken.has(header)) return false;
      const value = normalize(header);
      return hints.some((hint) => value === hint || value.includes(hint));
    });
    map[id] = match ?? '';
    if (match) taken.add(match);
  }
  return map;
}

function parseDate(raw: unknown): string {
  if (raw instanceof Date && !Number.isNaN(raw.getTime())) {
    const offset = raw.getTimezoneOffset() * 60000;
    return new Date(raw.getTime() - offset).toISOString().slice(0, 10);
  }
  const text = String(raw ?? '').trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  const dmy = /^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})$/.exec(text);
  if (dmy) {
    const [, d, m, y] = dmy;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  return '';
}

function parseAmount(raw: unknown): number {
  if (typeof raw === 'number') return raw;
  const cleaned = String(raw ?? '').replace(/[^\d.]/g, '');
  return cleaned ? Number(cleaned) : NaN;
}

interface ParsedRow {
  draft: ChequeDraft;
  errors: string[];
}

export function ExcelImport({
  template,
  companyId,
  direction,
  lang,
  printBackground,
}: Props) {
  const printer = usePrinter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [mapping, setMapping] = useState<Record<FieldId, string>>(autoMap([]));
  const [fileError, setFileError] = useState('');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');

  const parsed = useMemo<ParsedRow[]>(() => {
    return rows.map((row) => {
      const errors: string[] = [];
      const date = parseDate(mapping.date ? row[mapping.date] : '');
      const amount = parseAmount(mapping.amount ? row[mapping.amount] : '');
      const beneficiary = String(
        mapping.beneficiary ? (row[mapping.beneficiary] ?? '') : '',
      ).trim();
      const currencyRaw = String(
        mapping.currency ? (row[mapping.currency] ?? '') : '',
      )
        .trim()
        .toUpperCase();

      if (!date) errors.push('تاريخ غير صالح');
      if (!Number.isFinite(amount) || amount <= 0) errors.push('مبلغ غير صالح');
      if (!beneficiary) errors.push('المستفيد مطلوب');

      const draft = {
        ...EMPTY_DRAFT,
        date: date || EMPTY_DRAFT.date,
        beneficiary,
        amount: Number.isFinite(amount) ? amount : 0,
        currency: getCurrency(currencyRaw || 'EGP').code,
        signatory: String(
          mapping.signatory ? (row[mapping.signatory] ?? '') : '',
        ).trim(),
        chequeNumber: String(
          mapping.chequeNumber ? (row[mapping.chequeNumber] ?? '') : '',
        ).trim(),
        notes: String(mapping.notes ? (row[mapping.notes] ?? '') : '').trim(),
      };

      if (isAmountWordsTruncated(template.fields, draft, lang)) {
        errors.push('المبلغ كتابةً أطول من مساحة القالب');
      }

      return { errors, draft };
    });
  }, [rows, mapping, template, lang]);

  const validRows = parsed.filter((r) => r.errors.length === 0);

  async function handleFile(file: File) {
    setFileError('');
    setStatus('');
    try {
      // CSV text is kept raw so day-first dates are not re-read as US month-first dates.
      const isCsv = /\.csv$/i.test(file.name);
      const book = isCsv
        ? XLSX.read(await file.text(), { type: 'string', raw: true })
        : XLSX.read(await file.arrayBuffer(), {
            type: 'array',
            cellDates: true,
          });
      const sheet = book.Sheets[book.SheetNames[0]];
      if (!sheet) throw new Error('الملف لا يحتوي على أوراق عمل.');
      const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
        defval: '',
      });
      if (json.length === 0) throw new Error('لا توجد صفوف بيانات في الملف.');
      const cols = Object.keys(json[0]);
      setHeaders(cols);
      setRows(json);
      setMapping(autoMap(cols));
    } catch (error) {
      setHeaders([]);
      setRows([]);
      setFileError(
        error instanceof Error ? error.message : 'تعذّر قراءة الملف.',
      );
    }
  }

  function downloadSample() {
    const sample = [
      {
        التاريخ: '01/10/2026',
        'اسم المستفيد': 'شركة النيل للتوريدات',
        المبلغ: 25000,
        العملة: 'EGP',
        'اسم الموقّع': 'خالد عبد الرحمن',
        'رقم الشيك': '',
        ملاحظات: '',
      },
    ];
    const sheet = XLSX.utils.json_to_sheet(sample);
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, sheet, 'cheques');
    XLSX.writeFile(book, 'cheques-template.xlsx');
  }

  async function printAll() {
    if (validRows.length === 0) return;
    setBusy(true);
    try {
      const pages = validRows.map((r) =>
        resolveValues(template.fields, r.draft, lang),
      );
      const printed = await printer.print({
        template,
        pages,
        showBackground: printBackground,
        offsetX: template.offsetX,
        offsetY: template.offsetY,
      });
      if (!printed) {
        setStatus('لم يتم حفظ أي شيك في السجل لأن الطباعة لم تكتمل بنجاح.');
        return;
      }
      for (const r of validRows) {
        await saveCheque({
          draft: r.draft,
          template,
          companyId,
          direction,
          status: 'printed',
          lang,
        });
      }
      setStatus(`تمت طباعة ${validRows.length} شيك وحفظها في السجل.`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className='panel'>
      <h3 className='panel-title'>
        الإدخال الجماعي من ملف إكسل
        <button
          className='btn btn-sm'
          onClick={downloadSample}
        >
          تنزيل ملف نموذجي
        </button>
      </h3>

      <div
        className='btn-bar'
        style={{ marginBottom: 12 }}
      >
        <input
          ref={inputRef}
          type='file'
          accept='.xlsx,.xls,.csv'
          style={{ display: 'none' }}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
            e.target.value = '';
          }}
        />
        <button
          className='btn'
          onClick={() => inputRef.current?.click()}
        >
          اختيار ملف…
        </button>
        <button
          className='btn btn-primary'
          disabled={busy || validRows.length === 0}
          onClick={printAll}
        >
          طباعة {validRows.length} شيك
        </button>
      </div>

      {fileError && <p className='error'>{fileError}</p>}

      {headers.length > 0 && (
        <>
          <div className='row-3'>
            {FIELD_IDS.map((id) => (
              <div
                className='field'
                key={id}
              >
                <label>{COLUMN_HINTS[id].label}</label>
                <select
                  value={mapping[id]}
                  onChange={(e) =>
                    setMapping((m) => ({ ...m, [id]: e.target.value }))
                  }
                >
                  <option value=''>— بدون —</option>
                  {headers.map((h) => (
                    <option
                      key={h}
                      value={h}
                    >
                      {h}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>

          <div style={{ maxHeight: 280, overflow: 'auto' }}>
            <table className='table'>
              <thead>
                <tr>
                  <th>#</th>
                  <th>التاريخ</th>
                  <th>المستفيد</th>
                  <th>المبلغ</th>
                  <th>العملة</th>
                  <th>الحالة</th>
                </tr>
              </thead>
              <tbody>
                {parsed.map((r, i) => (
                  <tr
                    key={i}
                    className={r.errors.length ? 'invalid' : ''}
                  >
                    <td>{i + 1}</td>
                    <td>{r.draft.date}</td>
                    <td>{r.draft.beneficiary}</td>
                    <td>{r.draft.amount.toLocaleString('en-US')}</td>
                    <td>{r.draft.currency}</td>
                    <td>{r.errors.length ? r.errors.join('، ') : 'جاهز'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {status && <p className='hint'>{status}</p>}
    </div>
  );
}
