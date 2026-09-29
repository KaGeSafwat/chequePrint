import { useState } from 'react';
import { CURRENCIES } from '../../core/amountToWords';
import { defaultTemplateFor } from '../../data/defaultTemplates';
import { db, updateSettings } from '../../data/db';
import {
  useBanks,
  useCompanies,
  useSettings,
  useTemplates,
} from '../../data/hooks';
import type { Lang } from '../../core/types';

export function SettingsPage() {
  const settings = useSettings();
  const banks = useBanks();
  const companies = useCompanies();
  const templates = useTemplates(settings?.activeBankId);

  const [companyName, setCompanyName] = useState('');
  const [bankName, setBankName] = useState('');
  const [templateName, setTemplateName] = useState('');

  async function addCompany() {
    const name = companyName.trim();
    if (!name) return;
    const id = await db.companies.add({ name });
    setCompanyName('');
    if (!settings?.activeCompanyId)
      await updateSettings({ activeCompanyId: id });
  }

  async function addBank() {
    const name = bankName.trim();
    if (!name) return;
    const id = await db.banks.add({ name, builtIn: false });
    await db.templates.add(defaultTemplateFor(id, name));
    setBankName('');
  }

  async function addTemplate() {
    const name = templateName.trim();
    const bankId = settings?.activeBankId;
    if (!name || !bankId) return;
    const bank = banks.find((b) => b.id === bankId);
    await db.templates.add({
      ...defaultTemplateFor(bankId, bank?.name ?? ''),
      name,
    });
    setTemplateName('');
  }

  async function deleteTemplate(id: number) {
    const remaining = await db.templates
      .where('bankId')
      .equals(settings!.activeBankId!)
      .count();
    if (remaining <= 1) return;
    await db.templates.delete(id);
    if (settings?.activeTemplateId === id) {
      const next = await db.templates
        .where('bankId')
        .equals(settings.activeBankId!)
        .first();
      await updateSettings({ activeTemplateId: next?.id });
    }
  }

  async function duplicateTemplate(id: number) {
    const source = await db.templates.get(id);
    if (!source) return;
    const { id: _ignored, ...rest } = source;
    await db.templates.add({
      ...structuredClone(rest),
      name: `${source.name} — نسخة`,
    });
  }

  return (
    <div className='layout'>
      <div>
        <div className='panel'>
          <h3 className='panel-title'>الشركات</h3>
          <div
            className='btn-bar'
            style={{ marginBottom: 10 }}
          >
            <input
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder='اسم الشركة'
              style={{
                flex: 1,
                padding: '8px 10px',
                border: '1px solid var(--line)',
                borderRadius: 8,
              }}
            />
            <button
              className='btn btn-primary'
              onClick={addCompany}
            >
              إضافة
            </button>
          </div>
          <table className='table'>
            <tbody>
              {companies.map((c) => (
                <tr key={c.id}>
                  <td>
                    <input
                      value={c.name}
                      onChange={(e) =>
                        db.companies.update(c.id!, { name: e.target.value })
                      }
                      style={{
                        width: '100%',
                        border: 'none',
                        background: 'transparent',
                      }}
                    />
                  </td>
                  <td style={{ width: 90 }}>
                    <button
                      className='btn btn-sm btn-danger'
                      disabled={companies.length <= 1}
                      onClick={() => db.companies.delete(c.id!)}
                    >
                      حذف
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className='panel'>
          <h3 className='panel-title'>البنوك</h3>
          <div
            className='btn-bar'
            style={{ marginBottom: 10 }}
          >
            <input
              value={bankName}
              onChange={(e) => setBankName(e.target.value)}
              placeholder='اسم بنك جديد'
              style={{
                flex: 1,
                padding: '8px 10px',
                border: '1px solid var(--line)',
                borderRadius: 8,
              }}
            />
            <button
              className='btn btn-primary'
              onClick={addBank}
            >
              إضافة بنك
            </button>
          </div>
          <table className='table'>
            <tbody>
              {banks.map((b) => (
                <tr key={b.id}>
                  <td>{b.name}</td>
                  <td style={{ width: 120 }}>
                    {b.builtIn ? <span className='badge'>أساسي</span> : ''}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className='panel'>
          <h3 className='panel-title'>نماذج البنك المختار</h3>
          <div
            className='btn-bar'
            style={{ marginBottom: 10 }}
          >
            <input
              value={templateName}
              onChange={(e) => setTemplateName(e.target.value)}
              placeholder='اسم نموذج جديد'
              style={{
                flex: 1,
                padding: '8px 10px',
                border: '1px solid var(--line)',
                borderRadius: 8,
              }}
            />
            <button
              className='btn btn-primary'
              onClick={addTemplate}
            >
              إضافة نموذج
            </button>
          </div>
          <table className='table'>
            <tbody>
              {templates.map((t) => (
                <tr key={t.id}>
                  <td>{t.name}</td>
                  <td>
                    {t.needsCalibration ? (
                      <span className='badge cancelled'>يحتاج معايرة</span>
                    ) : (
                      ''
                    )}
                  </td>
                  <td style={{ width: 170 }}>
                    <div className='btn-bar'>
                      <button
                        className='btn btn-sm'
                        onClick={() => duplicateTemplate(t.id!)}
                      >
                        نسخ
                      </button>
                      <button
                        className='btn btn-sm btn-danger'
                        disabled={templates.length <= 1}
                        onClick={() => deleteTemplate(t.id!)}
                      >
                        حذف
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <aside>
        <div className='panel'>
          <h3 className='panel-title'>تفضيلات عامة</h3>
          <div className='field'>
            <label>العملة الافتراضية</label>
            <select
              value={settings?.defaultCurrency ?? 'EGP'}
              onChange={(e) =>
                updateSettings({ defaultCurrency: e.target.value })
              }
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
          <div className='field'>
            <label>لغة كتابة المبلغ</label>
            <select
              value={settings?.wordsLang ?? 'ar'}
              onChange={(e) =>
                updateSettings({ wordsLang: e.target.value as Lang })
              }
            >
              <option value='ar'>عربي</option>
              <option value='en'>English</option>
            </select>
          </div>
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
          <p
            className='hint'
            style={{ marginTop: 10 }}
          >
            اتركه مغلقاً عند الطباعة على شيكات البنك الحقيقية، فلا يُطبع سوى
            البيانات.
          </p>
        </div>

        <div className='panel'>
          <h3 className='panel-title'>نصائح ضبط الطباعة</h3>
          <p className='hint'>
            ١) في نافذة الطباعة اختر «الحجم الفعلي» أو ١٠٠٪ وألغِ خيار «الاحتواء
            ضمن الصفحة».
            <br />
            ٢) اضبط مقاس الورق في إعدادات الطابعة ليطابق مقاس الشيك.
            <br />
            ٣) اطبع على ورقة عادية أولاً وضعها فوق الشيك الحقيقي أمام الضوء، ثم
            عدّل «إزاحة الطباعة» في صفحة تصميم القوالب حتى تنطبق البيانات على
            أماكنها.
          </p>
        </div>
      </aside>
    </div>
  );
}
