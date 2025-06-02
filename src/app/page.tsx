// src/app/page.tsx
import { redirect } from 'next/navigation';

export default function HomePage() {
  // Permanently redirect users from the root path to the /dashboard page
  redirect('/dashboard');

  // This part will not be reached due to the redirect,
  // but returning null or a simple component is good practice if redirect wasn't unconditional.
  // return null;
}
