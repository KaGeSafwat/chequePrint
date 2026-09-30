import { useState } from 'react';
import { usePrinter } from '../../components/PrintProvider';
import { resolveValues } from '../../core/chequeDraft';
import { recordToDraft } from '../../data/chequeService';
import { db } from '../../data/db';
import {
  useBanks,
  useCheques,
  useCompanies,
  useSettings,
} from '../../data/hooks';
import type { ChequeRecord, Direction } from '../../core/types';

const STATUS_LABELS: Record<ChequeRecord['status'], string> = {
  draft: 'مسودة',
  printed: 'مطبوع',
  cancelled: 'ملغي',
};

function TrashIcon() {
  return (
    <svg
      width='15'
      height='15'
      viewBox='0 0 24 24'
      fill='none'
      stroke='currentColor'
      strokeWidth='2'
      strokeLinecap='round'
      strokeLinejoin='round'
      aria-hidden='true'
    >
      <path d='M3 6h18' />
      <path d='M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2' />
      <path d='M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6' />
      <path d='M10 11v6' />
      <path d='M14 11v6' />
    </svg>
  );
}

export function RegisterPage() {
  const settings = useSettings();
  const banks = useBanks();
  const companies = useCompanies();
  const printer = usePrinter();

  const [direction, setDirection] = useState<Direction>('issued');
  const [bankId, setBankId] = useState<number | undefined>();
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [search, setSearch] = useState('');
  const [pendingDelete, setPendingDelete] = useState<ChequeRecord | null>(null);

  const cheques = useCheques({
    direction,
    bankId,
    from: from || undefined,
    to: to || undefined,
    search,
  });

  const bankName = (id: number) => banks.find((b) => b.id === id)?.name ?? '—';
  const companyName = (id: number) =>
    companies.find((c) => c.id === id)?.name ?? '—';

  async function reprint(record: ChequeRecord) {
    const template = await db.templates.get(record.templateId);
    const snapshot = {
      widthMm: record.widthMm,
      heightMm: record.heightMm,
      fields: record.layoutSnapshot,
      backgroundImage: template?.backgroundImage,
    };
    await printer.print({
      template: snapshot,
      pages: [
        resolveValues(
          record.layoutSnapshot,
          recordToDraft(record),
          settings?.wordsLang ?? 'ar',
        ),
      ],
      showBackground: settings?.printBackground ?? false,
      offsetX: template?.offsetX ?? 0,
      offsetY: template?.offsetY ?? 0,
      // Reprinting doesn't write a new record, so there's nothing to gate on confirmation.
      requireConfirmation: false,
    });
  }

  async function setStatus(
    record: ChequeRecord,
    status: ChequeRecord['status'],
  ) {
    await db.cheques.update(record.id!, { status });
  }

  async function confirmDelete() {
    if (!pendingDelete?.id) return;
    await db.cheques.delete(pendingDelete.id);
    setPendingDelete(null);
  }

  return (
    <div className='panel'>
      <h3 className='panel-title'>سجل الشيكات</h3>

      <div className='tabs'>
        <button
          className={direction === 'issued' ? 'active' : ''}
          onClick={() => setDirection('issued')}
        >
          الشيكات الصادرة
        </button>
        <button
          className={direction === 'received' ? 'active' : ''}
          onClick={() => setDirection('received')}
        >
          الشيكات المستلمة
        </button>
      </div>

      <div className='row-3'>
        <div className='field'>
          <label>البنك</label>
          <select
            value={bankId ?? ''}
            onChange={(e) =>
              setBankId(e.target.value ? Number(e.target.value) : undefined)
            }
          >
            <option value=''>كل البنوك</option>
            {banks.map((b) => (
              <option
                key={b.id}
                value={b.id}
              >
                {b.name}
              </option>
            ))}
          </select>
        </div>
        <div className='field'>
          <label>من تاريخ</label>
          <input
            type='date'
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
        </div>
        <div className='field'>
          <label>إلى تاريخ</label>
          <input
            type='date'
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
        </div>
      </div>

      <div className='field'>
        <label>بحث (المستفيد / المبلغ / رقم الشيك)</label>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <table className='table'>
        <thead>
          <tr>
            <th>التاريخ</th>
            <th>المستفيد</th>
            <th>المبلغ</th>
            <th>البنك</th>
            <th>الشركة</th>
            <th>رقم الشيك</th>
            <th>الحالة</th>
            <th>إجراءات</th>
          </tr>
        </thead>
        <tbody>
          {cheques.map((c) => (
            <tr key={c.id}>
              <td>{c.date}</td>
              <td>{c.beneficiary}</td>
              <td>
                {c.amount.toLocaleString('en-US')} {c.currency}
              </td>
              <td>{bankName(c.bankId)}</td>
              <td>{companyName(c.companyId)}</td>
              <td>{c.chequeNumber ?? '—'}</td>
              <td>
                <span
                  className={`badge ${c.status === 'cancelled' ? 'cancelled' : ''}`}
                >
                  {STATUS_LABELS[c.status]}
                </span>
              </td>
              <td>
                <div className='btn-bar'>
                  <button
                    className='btn btn-sm'
                    onClick={() => reprint(c)}
                    disabled={c.status === 'cancelled'}
                  >
                    إعادة طباعة
                  </button>
                  {c.status === 'cancelled' ? (
                    <button
                      className='btn btn-sm'
                      onClick={() => setStatus(c, 'printed')}
                    >
                      إلغاء الإلغاء
                    </button>
                  ) : (
                    <button
                      className='btn btn-sm btn-danger'
                      onClick={() => setStatus(c, 'cancelled')}
                    >
                      إلغاء الشيك
                    </button>
                  )}
                  <button
                    className='btn btn-sm btn-icon btn-danger'
                    title='حذف الشيك نهائياً من قاعدة البيانات'
                    aria-label='حذف الشيك نهائياً من قاعدة البيانات'
                    onClick={() => setPendingDelete(c)}
                  >
                    <TrashIcon />
                  </button>
                </div>
              </td>
            </tr>
          ))}
          {cheques.length === 0 && (
            <tr>
              <td
                colSpan={8}
                className='hint'
              >
                لا توجد شيكات مطابقة.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {pendingDelete && (
        <div className='confirm-overlay'>
          <div className='confirm-box'>
            <p>حذف الشيك نهائياً من قاعدة البيانات؟</p>
            <p className='hint'>
              {pendingDelete.beneficiary} —{' '}
              {pendingDelete.amount.toLocaleString('en-US')}{' '}
              {pendingDelete.currency} — {pendingDelete.date}
            </p>
            <p className='hint'>
              لا يمكن التراجع عن هذا الإجراء. إن أردت الاحتفاظ بالسجل استخدم
              «إلغاء الشيك» بدلاً من الحذف.
            </p>
            <div className='btn-bar'>
              <button
                className='btn btn-danger'
                onClick={confirmDelete}
              >
                نعم، احذف نهائياً
              </button>
              <button
                className='btn'
                onClick={() => setPendingDelete(null)}
              >
                تراجع
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
