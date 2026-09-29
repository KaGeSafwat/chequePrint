import { useState } from 'react';
import { PrintProvider } from './components/PrintProvider';
import { EntryPage } from './features/entry/EntryPage';
import { RegisterPage } from './features/register/RegisterPage';
import { DesignerPage } from './features/designer/DesignerPage';
import { SettingsPage } from './features/settings/SettingsPage';

type Page = 'entry' | 'register' | 'designer' | 'settings';

const PAGES: { id: Page; label: string }[] = [
  { id: 'entry', label: 'تجهيز الشيكات' },
  { id: 'register', label: 'سجل الشيكات' },
  { id: 'designer', label: 'تصميم القوالب' },
  { id: 'settings', label: 'الإعدادات' },
];

export function App() {
  const [page, setPage] = useState<Page>('entry');

  return (
    <PrintProvider>
      <div className="app">
        <header className="app-header">
          <div className="app-title">برنامج تجهيز وطباعة الشيكات</div>
          <nav className="app-nav">
            {PAGES.map((p) => (
              <button
                key={p.id}
                className={page === p.id ? 'active' : ''}
                onClick={() => setPage(p.id)}
              >
                {p.label}
              </button>
            ))}
          </nav>
        </header>
        <main className="app-body">
          {page === 'entry' && <EntryPage />}
          {page === 'register' && <RegisterPage />}
          {page === 'designer' && <DesignerPage />}
          {page === 'settings' && <SettingsPage />}
        </main>
      </div>
    </PrintProvider>
  );
}
