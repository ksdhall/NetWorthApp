import Link from 'next/link'; // Import Link

export default function VerifyRequestPage() {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '80vh',
      textAlign: 'center',
      fontFamily: 'Arial, sans-serif',
      padding: '20px',
      backgroundColor: '#f9f9f9'
    }}>
      <div style={{ padding: '40px', backgroundColor: '#fff', borderRadius: '10px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
        <h1 style={{ marginBottom: '20px', fontSize: '2em', color: '#333' }}>Check Your Email</h1>
        <p style={{ marginBottom: '15px', fontSize: '1.1em', color: '#555' }}>
          A secure sign-in link has been sent to your email address.
        </p>
        <p style={{ fontSize: '1.1em', color: '#555' }}>
          Please check your inbox and click the link to complete your sign-in.
        </p>
        <Link href="/" passHref legacyBehavior>
          <a style={{
            display: 'inline-block',
            marginTop: '30px',
            padding: '12px 25px',
            backgroundColor: '#0070f3',
            color: 'white',
            textDecoration: 'none',
            borderRadius: '5px',
            fontSize: '1em',
            transition: 'background-color 0.2s ease'
          }}
          onMouseOver={(e) => { (e.target as HTMLAnchorElement).style.background = '#005bb5'; }}
          onMouseOut={(e) => { (e.target as HTMLAnchorElement).style.background = '#0070f3'; }}
          >
            Go to Homepage
          </a>
        </Link>
      </div>
    </div>
  );
}
