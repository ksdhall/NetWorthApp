'use client';

import { SessionProvider } from 'next-auth/react';
import type { ReactNode } from 'react';

interface Props {
  children: ReactNode;
  // The session prop is not strictly needed for App Router if SessionProvider fetches it,
  // but can be used for passing initial session data from Server Components if available.
  // session?: any;
}

export default function NextAuthSessionProvider({ children }: Props) {
  return <SessionProvider>{children}</SessionProvider>;
}
