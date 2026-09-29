import type { CSSProperties } from 'react';
import type { ChequeField, ChequeTemplate } from '../core/types';

export const PX_PER_MM = 96 / 25.4;

interface Props {
  template: Pick<ChequeTemplate, 'widthMm' | 'heightMm' | 'fields' | 'backgroundImage'>;
  values: Record<string, string>;
  showBackground: boolean;
  /** Extra per-field styling hook used by the designer for selection outlines. */
  fieldDecorator?: (field: ChequeField) => CSSProperties | undefined;
  onFieldPointerDown?: (field: ChequeField, event: React.PointerEvent) => void;
  children?: React.ReactNode;
}

export function fieldStyle(field: ChequeField): CSSProperties {
  return {
    position: 'absolute',
    left: `${field.x}mm`,
    top: `${field.y}mm`,
    width: `${field.w}mm`,
    height: `${field.h}mm`,
    fontFamily: `"${field.fontFamily}", Arial, sans-serif`,
    fontSize: `${field.fontSize}pt`,
    fontWeight: field.bold ? 700 : 400,
    letterSpacing: field.letterSpacing ? `${field.letterSpacing}mm` : undefined,
    direction: field.rtl ? 'rtl' : 'ltr',
    textAlign: field.align,
    display: 'flex',
    alignItems: 'center',
    justifyContent: field.align === 'center' ? 'center' : field.align === 'left' ? 'flex-start' : 'flex-end',
    whiteSpace: field.multiline ? 'normal' : 'nowrap',
    overflow: 'hidden',
    lineHeight: 1.15,
    color: '#000',
    boxSizing: 'border-box',
  };
}

/**
 * The cheque is always laid out in real millimetres so screen preview and printed
 * output share one source of truth; callers scale it with a CSS transform.
 */
export function ChequeCanvas({
  template,
  values,
  showBackground,
  fieldDecorator,
  onFieldPointerDown,
  children,
}: Props) {
  const useBackground = showBackground && Boolean(template.backgroundImage);
  return (
    <div
      className="cheque-canvas"
      style={{
        position: 'relative',
        width: `${template.widthMm}mm`,
        height: `${template.heightMm}mm`,
        background: useBackground ? `#fff url(${template.backgroundImage}) center/100% 100% no-repeat` : '#fff',
        overflow: 'hidden',
      }}
    >
      {template.fields
        .filter((f) => f.visible)
        .map((field) => (
          <div
            key={field.id}
            style={{ ...fieldStyle(field), ...(fieldDecorator?.(field) ?? {}) }}
            onPointerDown={onFieldPointerDown ? (e) => onFieldPointerDown(field, e) : undefined}
          >
            <span style={{ width: '100%' }}>{values[field.id] ?? ''}</span>
          </div>
        ))}
      {children}
    </div>
  );
}
