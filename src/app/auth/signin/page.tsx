'use client';

import { signIn, getProviders } from 'next-auth/react';
import { useEffect, useState } from 'react';
import type { ClientSafeProvider, LiteralUnion } from 'next-auth/react';
import type { BuiltInProviderType } from 'next-auth/providers/index'; // Corrected import path

export default function SignInPage() {
  // Specify string as a possible type for provider keys
  const [providers, setProviders] = useState<Record<LiteralUnion<BuiltInProviderType, string>, ClientSafeProvider> | null>(null);
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await getProviders();
        setProviders(res);
      } catch (error) {
        console.error("Failed to get providers:", error);
        // Handle error (e.g., show error message to user)
      }
    })();
  }, []);

  const handleEmailSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !providers?.email) return;
    setLoading(true);
    try {
      // Using callbackUrl to redirect to home page after successful sign-in attempt (i.e., email sent)
      // The actual sign-in happens when the user clicks the link in their email.
      const result = await signIn('email', { email, redirect: false, callbackUrl: '/' });
      if (result?.error) {
        console.error("Sign-in error:", result.error);
        // Handle error (e.g., show error message to user)
        alert("Error sending sign-in email: " + result.error);
      } else if (result?.url) {
        // If redirect is false, result.url will contain the verify request page URL
        // Typically, NextAuth redirects to pages.verifyRequest automatically if redirect is not false.
        // Since we set redirect: false, we might need to manually redirect or inform user.
        // For EmailProvider, it usually redirects to verifyRequest page by default.
        // If using redirect:false, ensure your logic handles the verify request page navigation if needed.
        // For now, assume NextAuth handles the redirect to verifyRequest page if email is sent.
        // If not, window.location.href = result.url; could be used if result.url is the verify page.
        // However, NextAuth should redirect to pages.verifyRequest by default.
        console.log("Sign-in email sent, verify URL (if applicable):", result.url);
         // No explicit redirect here, relying on NextAuth's default behavior to show verify-request page
      }
    } catch (error) {
      console.error("Exception during sign-in:", error);
      alert("An unexpected error occurred during sign-in.");
    } finally {
      setLoading(false);
    }
  };

  if (providers === null) { // Check for null explicitly to distinguish from empty object
    return <div style={{ padding: '20px', textAlign: 'center' }}>Loading authentication options...</div>;
  }

  if (Object.keys(providers).length === 0) {
     return <div style={{ padding: '20px', textAlign: 'center' }}>No authentication providers configured.</div>;
  }

  return (
    <div style={{ maxWidth: '380px', margin: '60px auto', padding: '30px', border: '1px solid #e0e0e0', borderRadius: '10px', boxShadow: '0 4px 12px rgba(0,0,0,0.08)', backgroundColor: '#fff' }}>
      <h1 style={{ textAlign: 'center', marginBottom: '25px', fontSize: '1.8em', color: '#333' }}>Sign In</h1>
      {providers.email ? (
        <form onSubmit={handleEmailSignIn}>
          <p style={{ marginBottom: '15px', color: '#555', textAlign: 'center' }}>
            Enter your email address to receive a secure sign-in link.
          </p>
          <div>
            <label htmlFor="email-input" style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', color: '#444' }}>Email address:</label>
            <input
              id="email-input"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your.email@example.com"
              required
              disabled={loading}
              style={{ width: '100%', padding: '12px', marginBottom: '20px', border: '1px solid #ccc', borderRadius: '5px', boxSizing: 'border-box', fontSize: '1em' }}
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              padding: '14px',
              background: loading ? '#ccc' : '#0070f3',
              color: 'white',
              border: 'none',
              borderRadius: '5px',
              cursor: loading ? 'not-allowed' : 'pointer',
              fontSize: '1.1em',
              transition: 'background-color 0.2s ease'
            }}
            onMouseOver={(e) => { if (!loading) e.currentTarget.style.background = '#005bb5'; }}
            onMouseOut={(e) => { if (!loading) e.currentTarget.style.background = '#0070f3'; }}
          >
            {loading ? 'Sending...' : 'Send Sign-In Link'}
          </button>
        </form>
      ) : (
        <p style={{textAlign: 'center', color: 'red'}}>Email provider not available.</p>
      )}
      {/* TODO: Add Passkey/WebAuthn sign-in button here later */}
    </div>
  );
}
