import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChequeCanvas } from './ChequeCanvas';
import type { ChequeTemplate } from '../core/types';

export interface PrintJob {
  template: Pick<ChequeTemplate, 'widthMm' | 'heightMm' | 'fields' | 'backgroundImage'>;
  pages: Record<string, string>[];
  showBackground: boolean;
  offsetX: number;
  offsetY: number;
}

interface PrintApi {
  print: (job: PrintJob) => Promise<void>;
}

const PrintContext = createContext<PrintApi | null>(null);

export function usePrinter(): PrintApi {
  const api = useContext(PrintContext);
  if (!api) throw new Error('usePrinter must be used inside <PrintProvider>');
  return api;
}

export function PrintProvider({ children }: { children: React.ReactNode }) {
  const [job, setJob] = useState<PrintJob | null>(null);
  const [resolver, setResolver] = useState<(() => void) | null>(null);

  const print = useCallback((next: PrintJob) => {
    return new Promise<void>((resolve) => {
      setResolver(() => resolve);
      setJob(next);
    });
  }, []);

  useEffect(() => {
    if (!job) return;
    const finish = () => {
      setJob(null);
      resolver?.();
      setResolver(null);
    };
    window.addEventListener('afterprint', finish, { once: true });
    // Two frames so layout and the background image settle before the print dialog opens.
    const id = requestAnimationFrame(() => requestAnimationFrame(() => window.print()));
    return () => {
      cancelAnimationFrame(id);
      window.removeEventListener('afterprint', finish);
    };
  }, [job, resolver]);

  const api = useMemo(() => ({ print }), [print]);
  const host = document.getElementById('print-root');

  return (
    <PrintContext.Provider value={api}>
      {children}
      {job && host
        ? createPortal(
            <>
              <style>{`@page { size: ${job.template.widthMm}mm ${job.template.heightMm}mm; margin: 0; }`}</style>
              {job.pages.map((values, index) => (
                <div
                  key={index}
                  className="print-page"
                  style={{
                    width: `${job.template.widthMm}mm`,
                    height: `${job.template.heightMm}mm`,
                    overflow: 'hidden',
                    pageBreakAfter: index === job.pages.length - 1 ? 'auto' : 'always',
                  }}
                >
                  <div style={{ transform: `translate(${job.offsetX}mm, ${job.offsetY}mm)` }}>
                    <ChequeCanvas
                      template={job.template}
                      values={values}
                      showBackground={job.showBackground}
                    />
                  </div>
                </div>
              ))}
            </>,
            host,
          )
        : null}
    </PrintContext.Provider>
  );
}
