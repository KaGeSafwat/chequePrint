import { useMemo, useState } from 'react';
import { ContextSelectors } from '../common/ContextSelectors';
import { ScaledCheque } from '../../components/ScaledCheque';
import { usePrinter } from '../../components/PrintProvider';
import { CURRENCIES, amountToWords } from '../../core/amountToWords';
import {
  EMPTY_DRAFT,
  isAmountWordsTruncated,
  resolveValues,
  type ChequeDraft,
} from '../../core/chequeDraft';
import { saveCheque } from '../../data/chequeService';
import { updateSettings } from '../../data/db';
import { useSettings, useTemplate } from '../../data/hooks';
import type { Direction } from '../../core/types';
import { ExcelImport } from './ExcelImport';

type Mode = 'single' | 'excel';

export function EntryPage() {
  const settings = useSettings();
  const template = useTemplate(settings?.activeTemplateId);
  const printer = usePrinter();

  const [mode, setMode] = useState<Mode>('single');
  const [direction, setDirection] = useState<Direction>('issued');
  const [draft, setDraft] = useState<ChequeDraft>({ ...EMPTY_DRAFT });
  const [status, setStatus] = useState<string>('');

  const lang = settings?.wordsLang ?? 'ar';
  const values = useMemo(
    () => (template ? resolveValues(template.fields, draft, lang) : {}),
    [template, draft, lang],
  );
  const amountWordsTruncated = useMemo(
    () =>
      template ? isAmountWordsTruncated(template.fields, draft, lang) : false,
    [template, draft, lang],
  );

  function patch(next: Partial<ChequeDraft>) {
    setDraft((prev) => ({ ...prev, ...next }));
    setStatus('');
  }

  async function handlePrint() {
    if (!template || !settings?.activeCompanyId) return;
    const printed = await printer.print({
      template,
      pages: [values],
      showBackground: settings.printBackground,
      offsetX: template.offsetX,
      offsetY: template.offsetY,
    });
    if (!printed) {
      setStatus('لم يتم حفظ الشيك في السجل لأن الطباعة لم تكتمل بنجاح.');
      return;
    }
    await saveCheque({
      draft,
      template,
      companyId: settings.activeCompanyId,
      direction,
      status: 'printed',
      lang,
    });
    setStatus('تمت الطباعة وحُفظ الشيك في السجل.');
  }

  async function handleSaveDraft() {
    if (!template || !settings?.activeCompanyId) return;
    await saveCheque({
      draft,
      template,
      companyId: settings.activeCompanyId,
      direction,
      status: 'draft',
      lang,
    });
    setStatus('تم حفظ الشيك كمسودة.');
  }

  const canPrint = Boolean(
    template &&
    settings?.activeCompanyId &&
    draft.beneficiary &&
    draft.amount > 0,
  );

  return (
    <div className='layout'>
      <div>
        <div className='panel'>
          <h3 className='panel-title'>
            معاينة الشيك
            <label className='switch'>
              <input
                type='checkbox'
                checked={settings?.printBackground ?? false}
                onChange={(e) =>
                  updateSettings({ printBackground: e.target.checked })
                }
              />
              طباعة صورة الشيك مع البيانات
            </label>
          </h3>
          {template ? (
            <div className='preview-frame'>
              <ScaledCheque
                template={template}
                values={values}
                showBackground
              />
            </div>
          ) : (
            <p className='hint'>اختر بنكاً ونموذجاً أولاً.</p>
          )}
          {template?.needsCalibration && (
            <p
              className='warn'
              style={{ marginTop: 12 }}
            >
              هذا النموذج لم تتم معايرته بعد. افتح «تصميم القوالب»، ارفع صورة
              شيك حقيقي، واضبط أماكن الحقول قبل الطباعة الفعلية.
            </p>
          )}
          {amountWordsTruncated && (
            <p
              className='warn'
              style={{ marginTop: 12 }}
            >
              تحذير: المبلغ كتابةً أطول من المساحة المتاحة في القالب وسيظهر
              مبتوراً عند الطباعة. أضف حقل «المبلغ كتابةً (سطر ٢)» أو وسّع الحقل
              من «تصميم القوالب».
            </p>
          )}
          {template && (
            <p
              className='hint'
              style={{ marginTop: 10 }}
            >
              المبلغ كتابةً: {amountToWords(draft.amount, draft.currency, lang)}
            </p>
          )}
        </div>

        {mode === 'excel' && template && settings?.activeCompanyId && (
          <ExcelImport
            template={template}
            companyId={settings.activeCompanyId}
            direction={direction}
            lang={lang}
            printBackground={settings.printBackground}
          />
        )}
      </div>

      <aside>
        <ContextSelectors />

        <div className='panel'>
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
          <div className='tabs'>
            <button
              className={mode === 'single' ? 'active' : ''}
              onClick={() => setMode('single')}
            >
              إدخال فردي
            </button>
            <button
              className={mode === 'excel' ? 'active' : ''}
              onClick={() => setMode('excel')}
            >
              من ملف إكسل
            </button>
          </div>

          {mode === 'single' ? (
            <>
              <div className='field'>
                <label>التاريخ</label>
                <input
                  type='date'
                  value={draft.date}
                  onChange={(e) => patch({ date: e.target.value })}
                />
              </div>
              <div className='field'>
                <label>اسم المستفيد</label>
                <input
                  value={draft.beneficiary}
                  onChange={(e) => patch({ beneficiary: e.target.value })}
                  placeholder='اسم الشخص أو الشركة'
                />
              </div>
              <div className='row'>
                <div className='field'>
                  <label>المبلغ</label>
                  <input
                    type='number'
                    min='0'
                    step='0.01'
                    value={draft.amount || ''}
                    onChange={(e) => patch({ amount: Number(e.target.value) })}
                  />
                </div>
                <div className='field'>
                  <label>العملة</label>
                  <select
                    value={draft.currency}
                    onChange={(e) => patch({ currency: e.target.value })}
                  >
                    {CURRENCIES.map((c) => (
                      <option
                        key={c.code}
                        value={c.code}
                      >
                        {c.arMain}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className='field'>
                <label>اسم موقّع الشيك</label>
                <input
                  value={draft.signatory}
                  onChange={(e) => patch({ signatory: e.target.value })}
                />
              </div>
              <div className='row'>
                <div className='field'>
                  <label>رقم الشيك</label>
                  <input
                    value={draft.chequeNumber}
                    onChange={(e) => patch({ chequeNumber: e.target.value })}
                  />
                </div>
                <div className='field'>
                  <label>المدينة</label>
                  <input
                    value={draft.city}
                    onChange={(e) => patch({ city: e.target.value })}
                  />
                </div>
              </div>
              <div className='field'>
                <label>لغة كتابة المبلغ</label>
                <select
                  value={lang}
                  onChange={(e) =>
                    updateSettings({ wordsLang: e.target.value as 'ar' | 'en' })
                  }
                >
                  <option value='ar'>عربي</option>
                  <option value='en'>English</option>
                </select>
              </div>
              <div className='field'>
                <label>ملاحظات</label>
                <textarea
                  rows={2}
                  value={draft.notes}
                  onChange={(e) => patch({ notes: e.target.value })}
                />
              </div>

              <div className='btn-bar'>
                <button
                  className='btn btn-primary'
                  disabled={!canPrint}
                  onClick={handlePrint}
                >
                  طباعة الشيك
                </button>
                <button
                  className='btn'
                  disabled={!canPrint}
                  onClick={handleSaveDraft}
                >
                  حفظ كمسودة
                </button>
                <button
                  className='btn'
                  onClick={() => setDraft({ ...EMPTY_DRAFT })}
                >
                  مسح
                </button>
              </div>
              {status && (
                <p
                  className='hint'
                  style={{ marginTop: 8 }}
                >
                  {status}
                </p>
              )}
            </>
          ) : (
            <p className='hint'>
              ارفع ملف إكسل من اللوحة المجاورة. سيتم استخدام النموذج والبنك
              والشركة المختارة أعلاه لكل الشيكات في الملف.
            </p>
          )}
        </div>
      </aside>
    </div>
  );
}
