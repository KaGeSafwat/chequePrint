import { useEffect, useMemo, useRef, useState } from 'react';
import { ChequeCanvas, PX_PER_MM } from '../../components/ChequeCanvas';
import { usePrinter } from '../../components/PrintProvider';
import { ContextSelectors } from '../common/ContextSelectors';
import {
  FIELD_KEYS,
  FIELD_LABELS,
  FONT_FAMILIES,
  makeField,
} from '../../core/fieldCatalog';
import { resolveValues, type ChequeDraft } from '../../core/chequeDraft';
import { db } from '../../data/db';
import { useSettings, useTemplate } from '../../data/hooks';
import {
  DATE_FORMATS,
  type ChequeField,
  type ChequeTemplate,
  type DateFormat,
  type FieldKey,
  type TextAlign,
} from '../../core/types';

const SAMPLE: ChequeDraft = {
  date: '2026-10-01',
  beneficiary: 'شركة النيل للتوريدات',
  amount: 25000,
  currency: 'EGP',
  signatory: 'خالد عبد الرحمن',
  accountName: 'شركة كود تانس لتطوير البرمجيات',
  accountNumber: '1234567890123',
  chequeNumber: '0001234',
  city: 'القاهرة',
  notes: '',
};

interface DragState {
  id: string;
  mode: 'move' | 'resize';
  startClientX: number;
  startClientY: number;
  origin: { x: number; y: number; w: number; h: number };
}

export function DesignerPage() {
  const settings = useSettings();
  const stored = useTemplate(settings?.activeTemplateId);
  const printer = usePrinter();

  const [draft, setDraft] = useState<ChequeTemplate | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [scale, setScale] = useState(1);
  const [saved, setSaved] = useState(false);
  const hostRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<DragState | null>(null);

  useEffect(() => {
    if (stored) {
      setDraft(structuredClone(stored));
      setSelectedId(stored.fields[0]?.id ?? null);
    }
  }, [stored]);

  const widthPx = (draft?.widthMm ?? 217) * PX_PER_MM;

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const observer = new ResizeObserver(([entry]) => {
      setScale(Math.min(1, (entry.contentRect.width - 28) / widthPx));
    });
    observer.observe(host);
    return () => observer.disconnect();
  }, [widthPx]);

  const values = useMemo(
    () =>
      draft
        ? resolveValues(draft.fields, SAMPLE, settings?.wordsLang ?? 'ar')
        : {},
    [draft, settings?.wordsLang],
  );

  const selected = draft?.fields.find((f) => f.id === selectedId) ?? null;

  function patchTemplate(patch: Partial<ChequeTemplate>) {
    setDraft((prev) => (prev ? { ...prev, ...patch } : prev));
    setSaved(false);
  }

  function patchField(id: string, patch: Partial<ChequeField>) {
    setDraft((prev) =>
      prev
        ? {
            ...prev,
            fields: prev.fields.map((f) =>
              f.id === id ? { ...f, ...patch } : f,
            ),
          }
        : prev,
    );
    setSaved(false);
  }

  useEffect(() => {
    function onMove(event: PointerEvent) {
      const drag = dragRef.current;
      if (!drag || scale <= 0) return;
      const dx = (event.clientX - drag.startClientX) / (scale * PX_PER_MM);
      const dy = (event.clientY - drag.startClientY) / (scale * PX_PER_MM);
      const snap = (v: number) => Math.round(v * 10) / 10;
      if (drag.mode === 'move') {
        patchField(drag.id, {
          x: snap(drag.origin.x + dx),
          y: snap(drag.origin.y + dy),
        });
      } else {
        patchField(drag.id, {
          w: Math.max(5, snap(drag.origin.w - dx)),
          h: Math.max(3, snap(drag.origin.h + dy)),
        });
      }
    }
    function onUp() {
      dragRef.current = null;
    }
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  }, [scale]);

  function startDrag(
    field: ChequeField,
    mode: DragState['mode'],
    event: React.PointerEvent,
  ) {
    event.preventDefault();
    setSelectedId(field.id);
    dragRef.current = {
      id: field.id,
      mode,
      startClientX: event.clientX,
      startClientY: event.clientY,
      origin: { x: field.x, y: field.y, w: field.w, h: field.h },
    };
  }

  function onStageKeyDown(event: React.KeyboardEvent) {
    if (!selected) return;
    const step = event.shiftKey ? 0.1 : 0.5;
    const moves: Record<string, [number, number]> = {
      ArrowUp: [0, -step],
      ArrowDown: [0, step],
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
    };
    const move = moves[event.key];
    if (!move) return;
    event.preventDefault();
    patchField(selected.id, {
      x: Math.round((selected.x + move[0]) * 10) / 10,
      y: Math.round((selected.y + move[1]) * 10) / 10,
    });
  }

  function addField(key: FieldKey) {
    setDraft((prev) =>
      prev ? { ...prev, fields: [...prev.fields, makeField(key)] } : prev,
    );
    setSaved(false);
  }

  function removeField(id: string) {
    setDraft((prev) =>
      prev ? { ...prev, fields: prev.fields.filter((f) => f.id !== id) } : prev,
    );
    if (selectedId === id) setSelectedId(null);
    setSaved(false);
  }

  async function loadBackground(file: File) {
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
    patchTemplate({ backgroundImage: dataUrl });
  }

  async function save() {
    if (!draft?.id) return;
    await db.templates.put({ ...draft, needsCalibration: false });
    setSaved(true);
  }

  async function testPrint() {
    if (!draft) return;
    await printer.print({
      template: draft,
      pages: [values],
      showBackground: false,
      offsetX: draft.offsetX,
      offsetY: draft.offsetY,
    });
  }

  if (!draft) {
    return (
      <div className='panel'>
        <p className='hint'>
          اختر بنكاً ونموذجاً من صفحة «تجهيز الشيكات» أولاً.
        </p>
      </div>
    );
  }

  return (
    <div className='layout'>
      <div>
        <div className='panel'>
          <h3 className='panel-title'>
            مساحة التصميم — {draft.widthMm} × {draft.heightMm} مم
            <span className='hint'>
              اسحب الحقل لتحريكه، أو استخدم أسهم لوحة المفاتيح للضبط الدقيق
            </span>
          </h3>
          <div
            className='designer-stage'
            ref={hostRef}
            tabIndex={0}
            onKeyDown={onStageKeyDown}
            style={{ height: draft.heightMm * PX_PER_MM * scale + 28 }}
          >
            <div
              style={{
                transform: `scale(${scale})`,
                transformOrigin: 'top right',
                width: widthPx,
              }}
            >
              <ChequeCanvas
                template={draft}
                values={values}
                showBackground
              >
                {draft.fields.map((field) => (
                  <div
                    key={field.id}
                    className={`designer-box ${field.id === selectedId ? 'selected' : ''}`}
                    style={{
                      left: `${field.x}mm`,
                      top: `${field.y}mm`,
                      width: `${field.w}mm`,
                      height: `${field.h}mm`,
                    }}
                    onPointerDown={(e) => startDrag(field, 'move', e)}
                  >
                    {field.id === selectedId && (
                      <span
                        className='designer-handle'
                        onPointerDown={(e) => {
                          e.stopPropagation();
                          startDrag(field, 'resize', e);
                        }}
                      />
                    )}
                  </div>
                ))}
              </ChequeCanvas>
            </div>
          </div>
          <div
            className='btn-bar'
            style={{ marginTop: 12 }}
          >
            <button
              className='btn btn-primary'
              onClick={save}
            >
              حفظ النموذج
            </button>
            <button
              className='btn'
              onClick={testPrint}
            >
              طباعة تجريبية
            </button>
            <button
              className='btn'
              onClick={() => stored && setDraft(structuredClone(stored))}
            >
              تراجع عن التعديلات
            </button>
            {saved && <span className='hint'>تم الحفظ.</span>}
          </div>
        </div>

        {selected && (
          <div className='panel'>
            <h3 className='panel-title'>خصائص الحقل: {selected.label}</h3>
            <div className='row-3'>
              <div className='field'>
                <label>نوع الحقل</label>
                <select
                  value={selected.key}
                  onChange={(e) =>
                    patchField(selected.id, {
                      key: e.target.value as FieldKey,
                      label: FIELD_LABELS[e.target.value as FieldKey],
                    })
                  }
                >
                  {FIELD_KEYS.map((k) => (
                    <option
                      key={k}
                      value={k}
                    >
                      {FIELD_LABELS[k]}
                    </option>
                  ))}
                </select>
              </div>
              <div className='field'>
                <label>الخط</label>
                <select
                  value={selected.fontFamily}
                  onChange={(e) =>
                    patchField(selected.id, { fontFamily: e.target.value })
                  }
                >
                  {FONT_FAMILIES.map((f) => (
                    <option
                      key={f}
                      value={f}
                    >
                      {f}
                    </option>
                  ))}
                </select>
              </div>
              <div className='field'>
                <label>حجم الخط (نقطة)</label>
                <input
                  type='number'
                  min='4'
                  max='48'
                  step='0.5'
                  value={selected.fontSize}
                  onChange={(e) =>
                    patchField(selected.id, {
                      fontSize: Number(e.target.value),
                    })
                  }
                />
              </div>
            </div>

            <div className='row-3'>
              {(['x', 'y', 'w', 'h'] as const).map((prop) => (
                <div
                  className='field'
                  key={prop}
                >
                  <label>
                    {
                      {
                        x: 'المسافة من اليسار (مم)',
                        y: 'المسافة من الأعلى (مم)',
                        w: 'العرض (مم)',
                        h: 'الارتفاع (مم)',
                      }[prop]
                    }
                  </label>
                  <input
                    type='number'
                    step='0.1'
                    value={selected[prop]}
                    onChange={(e) =>
                      patchField(selected.id, {
                        [prop]: Number(e.target.value),
                      })
                    }
                  />
                </div>
              ))}
              <div className='field'>
                <label>تباعد الحروف (مم)</label>
                <input
                  type='number'
                  step='0.1'
                  value={selected.letterSpacing}
                  onChange={(e) =>
                    patchField(selected.id, {
                      letterSpacing: Number(e.target.value),
                    })
                  }
                />
              </div>
              <div className='field'>
                <label>المحاذاة</label>
                <select
                  value={selected.align}
                  onChange={(e) =>
                    patchField(selected.id, {
                      align: e.target.value as TextAlign,
                    })
                  }
                >
                  <option value='right'>يمين</option>
                  <option value='center'>وسط</option>
                  <option value='left'>يسار</option>
                </select>
              </div>
            </div>

            {selected.key === 'date' && (
              <div className='field'>
                <label>صيغة التاريخ</label>
                <select
                  value={selected.dateFormat ?? 'dd/mm/yyyy'}
                  onChange={(e) =>
                    patchField(selected.id, {
                      dateFormat: e.target.value as DateFormat,
                    })
                  }
                >
                  {DATE_FORMATS.map((f) => (
                    <option
                      key={f}
                      value={f}
                    >
                      {f}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {selected.key === 'static' && (
              <div className='field'>
                <label>النص الثابت</label>
                <input
                  value={selected.staticText ?? ''}
                  onChange={(e) =>
                    patchField(selected.id, { staticText: e.target.value })
                  }
                />
              </div>
            )}

            <div className='btn-bar'>
              <label className='switch'>
                <input
                  type='checkbox'
                  checked={selected.bold}
                  onChange={(e) =>
                    patchField(selected.id, { bold: e.target.checked })
                  }
                />
                خط عريض
              </label>
              <label className='switch'>
                <input
                  type='checkbox'
                  checked={selected.rtl}
                  onChange={(e) =>
                    patchField(selected.id, { rtl: e.target.checked })
                  }
                />
                اتجاه من اليمين لليسار
              </label>
              <label className='switch'>
                <input
                  type='checkbox'
                  checked={selected.multiline}
                  onChange={(e) =>
                    patchField(selected.id, { multiline: e.target.checked })
                  }
                />
                سطور متعددة
              </label>
              <label className='switch'>
                <input
                  type='checkbox'
                  checked={selected.visible}
                  onChange={(e) =>
                    patchField(selected.id, { visible: e.target.checked })
                  }
                />
                مرئي
              </label>
            </div>
          </div>
        )}
      </div>

      <aside>
        <ContextSelectors />

        <div className='panel'>
          <h3 className='panel-title'>إعدادات النموذج</h3>
          <div className='field'>
            <label>اسم النموذج</label>
            <input
              value={draft.name}
              onChange={(e) => patchTemplate({ name: e.target.value })}
            />
          </div>
          <div className='row'>
            <div className='field'>
              <label>العرض (مم)</label>
              <input
                type='number'
                step='0.1'
                value={draft.widthMm}
                onChange={(e) =>
                  patchTemplate({ widthMm: Number(e.target.value) })
                }
              />
            </div>
            <div className='field'>
              <label>الارتفاع (مم)</label>
              <input
                type='number'
                step='0.1'
                value={draft.heightMm}
                onChange={(e) =>
                  patchTemplate({ heightMm: Number(e.target.value) })
                }
              />
            </div>
          </div>
          <div className='row'>
            <div className='field'>
              <label>إزاحة الطباعة أفقياً (مم)</label>
              <input
                type='number'
                step='0.1'
                value={draft.offsetX}
                onChange={(e) =>
                  patchTemplate({ offsetX: Number(e.target.value) })
                }
              />
            </div>
            <div className='field'>
              <label>إزاحة الطباعة رأسياً (مم)</label>
              <input
                type='number'
                step='0.1'
                value={draft.offsetY}
                onChange={(e) =>
                  patchTemplate({ offsetY: Number(e.target.value) })
                }
              />
            </div>
          </div>
          <div className='field'>
            <label>صورة خلفية الشيك (للمعاينة فقط)</label>
            <input
              type='file'
              accept='image/*'
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) loadBackground(file);
                e.target.value = '';
              }}
            />
          </div>
          {draft.backgroundImage && (
            <button
              className='btn btn-sm btn-danger'
              onClick={() => patchTemplate({ backgroundImage: undefined })}
            >
              إزالة الصورة
            </button>
          )}
          <p
            className='hint'
            style={{ marginTop: 10 }}
          >
            امسح شيكاً حقيقياً ضوئياً بحيث تكون الصورة مقصوصة على حواف الشيك
            تماماً، ثم اضبط العرض والارتفاع بالمليمتر ليطابقا مقاس الشيك الفعلي.
          </p>
        </div>

        <div className='panel'>
          <h3 className='panel-title'>
            الحقول
            <select
              value=''
              onChange={(e) =>
                e.target.value && addField(e.target.value as FieldKey)
              }
            >
              <option value=''>+ إضافة حقل</option>
              {FIELD_KEYS.map((k) => (
                <option
                  key={k}
                  value={k}
                >
                  {FIELD_LABELS[k]}
                </option>
              ))}
            </select>
          </h3>
          <div className='field-list'>
            {draft.fields.map((f) => (
              <div
                key={f.id}
                className={`field-list-item ${f.id === selectedId ? 'active' : ''}`}
                onClick={() => setSelectedId(f.id)}
              >
                <input
                  type='checkbox'
                  checked={f.visible}
                  onClick={(e) => e.stopPropagation()}
                  onChange={(e) =>
                    patchField(f.id, { visible: e.target.checked })
                  }
                />
                <span style={{ flex: 1 }}>{f.label}</span>
                <button
                  className='btn btn-sm btn-danger'
                  onClick={(e) => {
                    e.stopPropagation();
                    removeField(f.id);
                  }}
                >
                  حذف
                </button>
              </div>
            ))}
          </div>
        </div>
      </aside>
    </div>
  );
}
