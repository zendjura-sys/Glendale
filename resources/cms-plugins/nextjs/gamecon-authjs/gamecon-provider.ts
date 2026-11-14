// Auth.js (NextAuth v5): провайдер «GameCon» — OAuth 2.1 з PKCE і state.
import type { OAuthConfig, OAuthUserConfig } from 'next-auth/providers';

export type GameConProfile = {
  sub: string;
  preferred_username: string;
  name: string | null;
  email: string | null;
  email_verified: boolean | null;
  picture: string | null;
  profile: string;
};

export default function GameCon(
  options: OAuthUserConfig<GameConProfile> & { baseUrl?: string },
): OAuthConfig<GameConProfile> {
  const base = (options.baseUrl ?? 'https://gamecon.online').replace(/\/$/, '');

  return {
    id: 'gamecon',
    name: 'GameCon',
    type: 'oauth',
    authorization: { url: `${base}/oauth/authorize`, params: { scope: 'profile email' } },
    token: `${base}/oauth/token`,
    userinfo: `${base}/api/developer/v1/userinfo`,
    checks: ['pkce', 'state'],
    client: { token_endpoint_auth_method: 'client_secret_post' },
    profile(p) {
      return { id: p.sub, name: p.name ?? p.preferred_username, email: p.email, image: p.picture };
    },
    style: { bg: '#4f46e5', text: '#fff' },
    options,
  };
}
