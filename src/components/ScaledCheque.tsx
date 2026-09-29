import { useEffect, useRef, useState } from 'react';
import { ChequeCanvas, PX_PER_MM } from './ChequeCanvas';
import type { ChequeTemplate } from '../core/types';

interface Props {
  template: Pick<ChequeTemplate, 'widthMm' | 'heightMm' | 'fields' | 'backgroundImage'>;
  values: Record<string, string>;
  showBackground: boolean;
  maxScale?: number;
}

/** Shrinks the real-millimetre cheque to whatever width the preview pane offers. */
export function ScaledCheque({ template, values, showBackground, maxScale = 1 }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(maxScale);
  const widthPx = template.widthMm * PX_PER_MM;
  const heightPx = template.heightMm * PX_PER_MM;

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const observer = new ResizeObserver(([entry]) => {
      setScale(Math.min(maxScale, entry.contentRect.width / widthPx));
    });
    observer.observe(host);
    return () => observer.disconnect();
  }, [widthPx, maxScale]);

  return (
    <div ref={hostRef} className="cheque-preview-host" style={{ height: heightPx * scale }}>
      <div style={{ transform: `scale(${scale})`, transformOrigin: 'top right', width: widthPx }}>
        <ChequeCanvas template={template} values={values} showBackground={showBackground} />
      </div>
    </div>
  );
}
