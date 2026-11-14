# Увійти через GameCon — Next.js (Auth.js / NextAuth v5)

1. `npm install next-auth@beta`
2. Скопіюйте `gamecon-provider.ts` і `auth.ts` у проєкт, додайте `app/api/auth/[...nextauth]/route.ts`:
   ```ts
   import { handlers } from '@/auth';
   export const { GET, POST } = handlers;
   ```
3. `.env.local`: `GAMECON_CLIENT_ID`, `GAMECON_CLIENT_SECRET`, `AUTH_SECRET`.
4. Кнопка: `<form action={async () => { 'use server'; await signIn('gamecon') }}><button>Увійти через GameCon</button></form>`

Адреса повернення для застосунку GameCon: `https://ваш-сайт/api/auth/callback/gamecon`.
