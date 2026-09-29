import Dexie, { type Table } from 'dexie';
import type { AppSettings, Bank, ChequeRecord, ChequeTemplate, Company } from '../core/types';
import { BANK_NAMES, defaultTemplateFor } from './defaultTemplates';

export class ChequeDb extends Dexie {
  banks!: Table<Bank, number>;
  companies!: Table<Company, number>;
  templates!: Table<ChequeTemplate, number>;
  cheques!: Table<ChequeRecord, number>;
  settings!: Table<AppSettings, string>;

  constructor() {
    super('cheque-printer');
    this.version(1).stores({
      banks: '++id, name',
      companies: '++id, name',
      templates: '++id, bankId, name',
      cheques: '++id, bankId, companyId, direction, date, beneficiary, status',
      settings: 'key',
    });
  }
}

export const db = new ChequeDb();

export const DEFAULT_SETTINGS: AppSettings = {
  key: 'app',
  printBackground: false,
  wordsLang: 'ar',
  defaultCurrency: 'EGP',
};

export async function seedDatabase(): Promise<void> {
  await db.transaction('rw', db.banks, db.companies, db.templates, db.settings, async () => {
    if ((await db.banks.count()) === 0) {
      for (const name of BANK_NAMES) {
        const bankId = await db.banks.add({ name, builtIn: true });
        await db.templates.add(defaultTemplateFor(bankId, name));
      }
    }
    if ((await db.companies.count()) === 0) {
      await db.companies.add({ name: 'شركتي' });
    }
    if (!(await db.settings.get('app'))) {
      const bank = await db.banks.orderBy('id').first();
      const company = await db.companies.orderBy('id').first();
      const template = bank ? await db.templates.where('bankId').equals(bank.id!).first() : undefined;
      await db.settings.put({
        ...DEFAULT_SETTINGS,
        activeBankId: bank?.id,
        activeCompanyId: company?.id,
        activeTemplateId: template?.id,
      });
    }
  });
}

export async function updateSettings(patch: Partial<AppSettings>): Promise<void> {
  const current = (await db.settings.get('app')) ?? DEFAULT_SETTINGS;
  await db.settings.put({ ...current, ...patch, key: 'app' });
}
