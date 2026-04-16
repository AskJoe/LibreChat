import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

/**
 * SSO Callback Component
 * 
 * Handles the SSO flow from MarketPower:
 * 1. Reads access_token, refresh_token, return_url from URL hash
 * 2. Calls /api/auth/sso with the Supabase access token
 * 3. Stores the LibreChat JWT token
 * 4. Redirects to chat
 */
export default function SSOCallback() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState('Authenticating...');

  useEffect(() => {
    const handleSSO = async () => {
      try {
        // Parse hash params (format: #access_token=xxx&refresh_token=xxx&return_url=xxx)
        const hash = window.location.hash.substring(1);
        const params = new URLSearchParams(hash);
        const accessToken = params.get('access_token');
        const returnUrl = params.get('return_url');

        if (!accessToken) {
          setError('No access token provided. Please log in through MarketPower.');
          return;
        }

        setStatus('Verifying credentials...');

        // Call the SSO endpoint
        const response = await fetch('/api/auth/sso', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ access_token: accessToken }),
          credentials: 'include', // Important: include cookies for JWT refresh token
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.message || 'SSO authentication failed');
        }

        const data = await response.json();

        // Store the LibreChat JWT token (same way the login flow does)
        localStorage.setItem('token', data.token);
        
        // Store user data
        if (data.user) {
          localStorage.setItem('user', JSON.stringify(data.user));
        }

        setStatus('Success! Redirecting...');

        // Clear the hash from the URL for security
        window.history.replaceState(null, '', '/sso');

        // Navigate to chat
        setTimeout(() => {
          navigate('/c/new', { replace: true });
        }, 500);
      } catch (err: unknown) {
        console.error('SSO error:', err);
        setError(err instanceof Error ? err.message : 'Authentication failed');
      }
    };

    handleSSO();
  }, [navigate]);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        backgroundColor: '#0d0d0d',
        color: '#ffffff',
        fontFamily: 'system-ui, -apple-system, sans-serif',
      }}
    >
      <div
        style={{
          textAlign: 'center',
          padding: '2rem',
          borderRadius: '1rem',
          backgroundColor: '#1a1a2e',
          border: '1px solid #333',
          maxWidth: '400px',
          width: '90%',
        }}
      >
        <h1 style={{ fontSize: '1.5rem', marginBottom: '1rem', fontWeight: 600 }}>
          Erwin Chat
        </h1>
        {error ? (
          <div>
            <p style={{ color: '#ff6b6b', marginBottom: '1rem' }}>{error}</p>
            <button
              onClick={() => window.close()}
              style={{
                padding: '0.5rem 1.5rem',
                borderRadius: '0.5rem',
                border: 'none',
                backgroundColor: '#4a4af0',
                color: '#fff',
                cursor: 'pointer',
                fontSize: '0.875rem',
              }}
            >
              Close
            </button>
          </div>
        ) : (
          <div>
            <div
              style={{
                width: '2rem',
                height: '2rem',
                border: '3px solid #333',
                borderTopColor: '#4a4af0',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite',
                margin: '0 auto 1rem',
              }}
            />
            <p style={{ color: '#aaa' }}>{status}</p>
          </div>
        )}
      </div>
      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
