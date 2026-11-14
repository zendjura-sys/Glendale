// auth.ts у корені Next.js-проєкту.
import NextAuth from 'next-auth';
import GameCon from './gamecon-provider';

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    GameCon({
      clientId: process.env.GAMECON_CLIENT_ID,
      clientSecret: process.env.GAMECON_CLIENT_SECRET,
    }),
  ],
});
