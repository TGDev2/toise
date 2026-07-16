'use client';

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="fr">
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'system-ui, sans-serif',
          background: '#efe7d6',
          color: '#18130d',
        }}
      >
        <div style={{ textAlign: 'center', padding: '2rem' }}>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 600 }}>
            Une erreur est survenue
          </h1>
          <p style={{ marginTop: '0.75rem', fontSize: '0.9rem' }}>
            L&apos;application a rencontré un problème inattendu.
          </p>
          <button
            onClick={reset}
            style={{
              marginTop: '1.5rem',
              padding: '0.65rem 1.5rem',
              borderRadius: '9999px',
              border: 'none',
              background: '#1d6b57',
              color: '#fff',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Réessayer
          </button>
        </div>
      </body>
    </html>
  );
}
