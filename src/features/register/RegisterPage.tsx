import { useState } from 'react';
import { usePrinter } from '../../components/PrintProvider';
import { resolveValues } from '../../core/chequeDraft';
import { recordToDraft } from '../../data/chequeService';
import { db } from '../../data/db';
import { useBanks, useCheques, useCompanies, useSettings } from '../../data/hooks';
import type { ChequeRecord, Direction } from '../../core/types';

const STATUS_LABELS: Record<ChequeRecord['status'], string> = {
  draft: 'مسودة',
  printed: 'مطبوع',
  cancelled: 'ملغي',
};

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

  const cheques = useCheques({ direction, bankId, from: from || undefined, to: to || undefined, search });

  const bankName = (id: number) => banks.find((b) => b.id === id)?.name ?? '—';
  const companyName = (id: number) => companies.find((c) => c.id === id)?.name ?? '—';

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
      pages: [resolveValues(record.layoutSnapshot, recordToDraft(record), settings?.wordsLang ?? 'ar')],
      showBackground: settings?.printBackground ?? false,
      offsetX: template?.offsetX ?? 0,
      offsetY: template?.offsetY ?? 0,
    });
  }

  async function setStatus(record: ChequeRecord, status: ChequeRecord['status']) {
    await db.cheques.update(record.id!, { status });
  }

  return (
    <div className="panel">
      <h3 className="panel-title">سجل الشيكات</h3>

      <div className="tabs">
        <button className={direction === 'issued' ? 'active' : ''} onClick={() => setDirection('issued')}>
          الشيكات الصادرة
        </button>
        <button className={direction === 'received' ? 'active' : ''} onClick={() => setDirection('received')}>
          الشيكات المستلمة
        </button>
      </div>

      <div className="row-3">
        <div className="field">
          <label>البنك</label>
          <select value={bankId ?? ''} onChange={(e) => setBankId(e.target.value ? Number(e.target.value) : undefined)}>
            <option value="">كل البنوك</option>
            {banks.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>من تاريخ</label>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div className="field">
          <label>إلى تاريخ</label>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
      </div>

      <div className="field">
        <label>بحث (المستفيد / المبلغ / رقم الشيك)</label>
        <input value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      <table className="table">
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
                <span className={`badge ${c.status === 'cancelled' ? 'cancelled' : ''}`}>
                  {STATUS_LABELS[c.status]}
                </span>
              </td>
              <td>
                <div className="btn-bar">
                  <button className="btn btn-sm" onClick={() => reprint(c)} disabled={c.status === 'cancelled'}>
                    إعادة طباعة
                  </button>
                  {c.status === 'cancelled' ? (
                    <button className="btn btn-sm" onClick={() => setStatus(c, 'printed')}>
                      إلغاء الإلغاء
                    </button>
                  ) : (
                    <button className="btn btn-sm btn-danger" onClick={() => setStatus(c, 'cancelled')}>
                      إلغاء الشيك
                    </button>
                  )}
                </div>
              </td>
            </tr>
          ))}
          {cheques.length === 0 && (
            <tr>
              <td colSpan={8} className="hint">
                لا توجد شيكات مطابقة.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
