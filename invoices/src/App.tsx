import { useEffect, useState } from 'react';
import { get, post } from './api.ts';
import { Field } from './components.tsx';
import { useRoute } from './router.ts';
import { Customers } from './pages/Customers.tsx';
import { DocumentEditor } from './pages/DocumentEditor.tsx';
import { DocumentView } from './pages/DocumentView.tsx';
import { Items } from './pages/Items.tsx';
import { Dashboard, DocumentList } from './pages/lists.tsx';
import { PublicDocument } from './pages/PublicDocument.tsx';
import { Settings } from './pages/Settings.tsx';

interface Session {
  authRequired: boolean;
  authenticated: boolean;
}

const NAV = [
  { path: '', label: 'Overview' },
  { path: 'invoices', label: 'Invoices' },
  { path: 'estimates', label: 'Estimates' },
  { path: 'customers', label: 'Customers' },
  { path: 'items', label: 'Services' },
  { path: 'settings', label: 'Settings' },
];

export function App() {
  const route = useRoute();

  // The customer link renders without the owner app or a sign-in.
  if (route[0] === 'i' && route[1]) {
    return <PublicDocument token={route[1]} />;
  }

  return <OwnerApp route={route} />;
}

function OwnerApp({ route }: { route: string[] }) {
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    const load = () => get<Session>('/session').then(setSession);
    void load();
    window.addEventListener('invoices:signed-out', load);

    return () => window.removeEventListener('invoices:signed-out', load);
  }, []);

  if (!session) {
    return null;
  }

  if (!session.authenticated) {
    return <Login onSignedIn={() => setSession({ ...session, authenticated: true })} />;
  }

  return (
    <div className="shell">
      <nav className="nav no-print">
        <div className="nav-brand">Invoices</div>
        <div className="nav-links">
          {NAV.map((item) => (
            <a key={item.path} href={`#/${item.path}`} className={(route[0] ?? '') === item.path ? 'active' : ''}>
              {item.label}
            </a>
          ))}
        </div>
        {session.authRequired && (
          <button
            className="link-button nav-signout"
            onClick={async () => {
              await post('/logout');
              setSession({ ...session, authenticated: false });
            }}
          >
            Sign out
          </button>
        )}
      </nav>
      <main className="content">
        <Page route={route} />
      </main>
    </div>
  );
}

function Page({ route }: { route: string[] }) {
  const [section, id, action] = route;

  switch (section) {
    case undefined:
      return <Dashboard />;
    case 'invoices':
    case 'estimates': {
      const kind = section === 'invoices' ? 'invoice' : 'estimate';

      if (id === 'new') {
        return <DocumentEditor key={`new-${kind}`} kind={kind} id={null} />;
      }

      if (id && /^\d+$/.test(id)) {
        return action === 'edit' ? (
          <DocumentEditor key={`edit-${id}`} kind={kind} id={Number(id)} />
        ) : (
          <DocumentView key={id} id={Number(id)} />
        );
      }

      return <DocumentList key={kind} kind={kind} />;
    }
    case 'customers':
      return <Customers />;
    case 'items':
      return <Items />;
    case 'settings':
      return <Settings />;
    default:
      return <Dashboard />;
  }
}

function Login({ onSignedIn }: { onSignedIn: () => void }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  return (
    <main className="login">
      <form
        className="card stack-sm"
        onSubmit={async (e) => {
          e.preventDefault();

          try {
            await post('/login', { password });
            onSignedIn();
          } catch (err) {
            setError(err instanceof Error ? err.message : String(err));
          }
        }}
      >
        <h1>Sign in</h1>
        {error && <p className="error">{error}</p>}
        <Field label="Password">
          <input type="password" autoFocus value={password} onChange={(e) => setPassword(e.target.value)} />
        </Field>
        <button type="submit" className="button primary">
          Sign in
        </button>
      </form>
    </main>
  );
}
