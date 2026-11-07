import { PrismaAdapter } from "@auth/prisma-adapter";
import NextAuth from "next-auth";
import type { Provider } from "next-auth/providers";
import Google from "next-auth/providers/google";
import Nodemailer from "next-auth/providers/nodemailer";
import { prisma } from "@/lib/prisma";

const providers: Provider[] = [];

if (process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET) {
  providers.push(
    Google({
      clientId: process.env.AUTH_GOOGLE_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET,
      allowDangerousEmailAccountLinking: true,
    }),
  );
}

if (process.env.EMAIL_SERVER) {
  providers.push(
    Nodemailer({
      server: process.env.EMAIL_SERVER,
      from: process.env.EMAIL_FROM || "Signal <noreply@localhost>",
    }),
  );
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  providers,
  session: {
    // JWT keeps proxy/middleware auth checks free of Prisma Edge issues
    strategy: "jwt",
  },
  pages: {
    signIn: "/login",
    verifyRequest: "/login/verify",
    error: "/login",
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user?.id) {
        token.id = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.id) {
        session.user.id = String(token.id);
      }
      return session;
    },
    authorized({ auth, request }) {
      const { pathname } = request.nextUrl;
      const isProtected =
        pathname.startsWith("/dashboard") || pathname.startsWith("/session");
      if (isProtected) {
        return !!auth?.user;
      }
      return true;
    },
  },
  trustHost: true,
});
