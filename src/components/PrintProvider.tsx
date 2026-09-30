import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { createPortal } from 'react-dom';
import { ChequeCanvas } from './ChequeCanvas';
import type { ChequeTemplate } from '../core/types';

export interface PrintJob {
  template: Pick<
    ChequeTemplate,
    'widthMm' | 'heightMm' | 'fields' | 'backgroundImage'
  >;
  pages: Record<string, string>[];
  showBackground: boolean;
  offsetX: number;
  offsetY: number;
  /** Ask the user to confirm the sheet actually came out correctly before the caller commits a record. Default true. */
  requireConfirmation?: boolean;
}

interface PrintApi {
  /** Resolves false if the user reports the print failed, so callers can skip saving the cheque. */
  print: (job: PrintJob) => Promise<boolean>;
}

const PrintContext = createContext<PrintApi | null>(null);

export function usePrinter(): PrintApi {
  const api = useContext(PrintContext);
  if (!api) throw new Error('usePrinter must be used inside <PrintProvider>');
  return api;
}

export function PrintProvider({ children }: { children: React.ReactNode }) {
  const [job, setJob] = useState<PrintJob | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [resolver, setResolver] = useState<((ok: boolean) => void) | null>(
    null,
  );

  const print = useCallback((next: PrintJob) => {
    return new Promise<boolean>((resolve) => {
      setResolver(() => resolve);
      setJob(next);
    });
  }, []);

  useEffect(() => {
    if (!job) return;
    const finish = () => {
      setJob(null);
      if (job.requireConfirmation === false) {
        resolver?.(true);
        setResolver(null);
      } else {
        // The 'afterprint' event fires whether the user printed or cancelled the dialog,
        // so a human confirmation is the only reliable signal that the sheet came out.
        setConfirming(true);
      }
    };
    window.addEventListener('afterprint', finish, { once: true });
    // rAF lets layout and the background image settle first, but it never fires in a
    // hidden tab, so a timer backs it up to guarantee the dialog always opens.
    let opened = false;
    const open = () => {
      if (opened) return;
      opened = true;
      window.print();
    };
    const frame = requestAnimationFrame(() => requestAnimationFrame(open));
    const timer = window.setTimeout(open, 300);
    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(timer);
      window.removeEventListener('afterprint', finish);
    };
  }, [job, resolver]);

  function respond(ok: boolean) {
    resolver?.(ok);
    setResolver(null);
    setConfirming(false);
  }

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
                  className='print-page'
                  style={{
                    width: `${job.template.widthMm}mm`,
                    height: `${job.template.heightMm}mm`,
                    overflow: 'hidden',
                    pageBreakAfter:
                      index === job.pages.length - 1 ? 'auto' : 'always',
                  }}
                >
                  <div
                    style={{
                      transform: `translate(${job.offsetX}mm, ${job.offsetY}mm)`,
                    }}
                  >
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
      {confirming && (
        <div className='confirm-overlay'>
          <div className='confirm-box'>
            <p>هل خرجت الشيكات من الطابعة بشكل صحيح ومطابقة للبيانات؟</p>
            <div className='btn-bar'>
              <button
                className='btn btn-primary'
                onClick={() => respond(true)}
              >
                نعم، تمت الطباعة بنجاح
              </button>
              <button
                className='btn btn-danger'
                onClick={() => respond(false)}
              >
                لا، لم تتم الطباعة بشكل صحيح
              </button>
            </div>
          </div>
        </div>
      )}
    </PrintContext.Provider>
  );
}
