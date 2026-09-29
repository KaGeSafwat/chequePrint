import { useLiveQuery } from 'dexie-react-hooks';
import { DEFAULT_SETTINGS, db } from './db';
import type { ChequeRecord, Direction } from '../core/types';

export function useSettings() {
  return useLiveQuery(async () => (await db.settings.get('app')) ?? DEFAULT_SETTINGS, [], DEFAULT_SETTINGS);
}

export function useBanks() {
  return useLiveQuery(() => db.banks.toArray(), [], []);
}

export function useCompanies() {
  return useLiveQuery(() => db.companies.toArray(), [], []);
}

export function useTemplates(bankId?: number) {
  return useLiveQuery(
    () => (bankId ? db.templates.where('bankId').equals(bankId).toArray() : db.templates.toArray()),
    [bankId],
    [],
  );
}

export function useTemplate(id?: number) {
  return useLiveQuery(() => (id ? db.templates.get(id) : undefined), [id], undefined);
}

export interface ChequeFilter {
  direction?: Direction;
  bankId?: number;
  companyId?: number;
  from?: string;
  to?: string;
  search?: string;
}

export function useCheques(filter: ChequeFilter) {
  const { direction, bankId, companyId, from, to, search } = filter;
  return useLiveQuery(
    async () => {
      let rows: ChequeRecord[] = await db.cheques.orderBy('date').reverse().toArray();
      if (direction) rows = rows.filter((r) => r.direction === direction);
      if (bankId) rows = rows.filter((r) => r.bankId === bankId);
      if (companyId) rows = rows.filter((r) => r.companyId === companyId);
      if (from) rows = rows.filter((r) => r.date >= from);
      if (to) rows = rows.filter((r) => r.date <= to);
      if (search) {
        const needle = search.trim().toLowerCase();
        rows = rows.filter(
          (r) =>
            r.beneficiary.toLowerCase().includes(needle) ||
            String(r.amount).includes(needle) ||
            (r.chequeNumber ?? '').toLowerCase().includes(needle),
        );
      }
      return rows;
    },
    [direction, bankId, companyId, from, to, search],
    [],
  );
}
