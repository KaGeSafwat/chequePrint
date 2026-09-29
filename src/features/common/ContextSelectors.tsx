import { db, updateSettings } from '../../data/db';
import {
  useBanks,
  useCompanies,
  useSettings,
  useTemplates,
} from '../../data/hooks';

export function ContextSelectors({
  showTemplate = true,
}: {
  showTemplate?: boolean;
}) {
  const settings = useSettings();
  const banks = useBanks();
  const companies = useCompanies();
  const templates = useTemplates(settings?.activeBankId);

  async function selectBank(bankId: number) {
    const first = await db.templates.where('bankId').equals(bankId).first();
    await updateSettings({ activeBankId: bankId, activeTemplateId: first?.id });
  }

  return (
    <div className='panel'>
      <h3 className='panel-title'>بيانات التشغيل</h3>
      <div className='field'>
        <label>الشركة النشطة</label>
        <select
          value={settings?.activeCompanyId ?? ''}
          onChange={(e) =>
            updateSettings({ activeCompanyId: Number(e.target.value) })
          }
        >
          {companies.map((c) => (
            <option
              key={c.id}
              value={c.id}
            >
              {c.name}
            </option>
          ))}
        </select>
      </div>
      <div className='field'>
        <label>البنك</label>
        <select
          value={settings?.activeBankId ?? ''}
          onChange={(e) => selectBank(Number(e.target.value))}
        >
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
      {showTemplate && (
        <div className='field'>
          <label>نموذج الشيك</label>
          <select
            value={settings?.activeTemplateId ?? ''}
            onChange={(e) =>
              updateSettings({ activeTemplateId: Number(e.target.value) })
            }
          >
            {templates.map((t) => (
              <option
                key={t.id}
                value={t.id}
              >
                {t.name}
              </option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
}
