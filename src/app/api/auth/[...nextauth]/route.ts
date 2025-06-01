import NextAuth, { NextAuthOptions, User as NextAuthUser } from 'next-auth';
import EmailProvider from 'next-auth/providers/email';
import { PrismaAdapter } from '@next-auth/prisma-adapter';
import { PrismaClient, User as PrismaUser, Role } from '@prisma/client'; // Import PrismaUser and Role for typing

const prisma = new PrismaClient();

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  providers: [
    EmailProvider({
      server: {
        host: process.env.EMAIL_SERVER_HOST,
        port: Number(process.env.EMAIL_SERVER_PORT),
        auth: {
          user: process.env.EMAIL_SERVER_USER,
          pass: process.env.EMAIL_SERVER_PASSWORD,
        },
      },
      from: process.env.EMAIL_FROM,
      async sendVerificationRequest({ identifier: email, url, provider }) {
        const { host } = new URL(url);
        // Log to console if SMTP is not properly configured or if it's set to "console"
        if (!process.env.EMAIL_SERVER_HOST ||
            process.env.EMAIL_SERVER_HOST === "your_smtp_host" ||
            process.env.EMAIL_SERVER_HOST === "console") {
          console.log(`Login link for ${email} (SMTP not configured, logging to console): ${url}`);
          return;
        }
        // Attempt to send email using nodemailer if SMTP is configured
        try {
          const { createTransport } = await import("nodemailer");
          const transport = createTransport(provider.server);
          const result = await transport.sendMail({
            to: email,
            from: provider.from,
            subject: `Sign in to ${host}`,
            text: `Sign in to ${host}\n${url}\n\n`,
            html: `<p>Sign in to <strong>${host}</strong> by clicking the link below:</p><p><a href="${url}">Sign In</a></p>`
          });
          console.log(`Verification email sent to ${email}, result ID: ${result.messageId}`);
        } catch (error) {
          console.error("Failed to send verification email:", error);
          // Fallback to console log if email sending fails
          console.log(`Login link for ${email} (email send failed, logging to console): ${url}`);
        }
      }
    }),
    // TODO: Add WebAuthn (Passkey) provider configuration here later
  ],
  session: {
    strategy: 'database', // Store sessions in the database
    maxAge: 30 * 24 * 60 * 60, // 30 days
    updateAge: 24 * 60 * 60, // Revalidate session an extend age every 24 hours
  },
  callbacks: {
    async session({ session, user }) {
      // The 'user' object here is the user from the database (PrismaUser)
      if (session.user) {
        session.user.id = user.id; // Add the user ID to the session
        // Cast to PrismaUser to access custom fields like 'role'
        const prismaUser = user as PrismaUser;
        if (prismaUser.role) {
           // Make sure to define session.user.role in your NextAuthUser type declaration if extending session type
           (session.user as NextAuthUser & { role?: Role }).role = prismaUser.role;
        }
      }
      return session;
    },
  },
  pages: {
    signIn: '/auth/signin', // Custom sign-in page
    verifyRequest: '/auth/verify-request', // Page displayed after email OTP is sent
    // error: '/auth/error', // Error page, e.g., for OAuth errors
    // newUser: '/auth/new-user' // Redirect new users here (optional)
  },
  secret: process.env.NEXTAUTH_SECRET,
  debug: process.env.NODE_ENV === 'development',
};

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
