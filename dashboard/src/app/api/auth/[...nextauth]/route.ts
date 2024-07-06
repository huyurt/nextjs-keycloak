import { AuthOptions, TokenSet } from 'next-auth';
import { JWT } from 'next-auth/jwt';
import NextAuth from 'next-auth/next';
import CredentialsProvider from 'next-auth/providers/credentials'
import KeycloakProvider from 'next-auth/providers/keycloak'

function requestRefreshOfAccessToken(token: JWT) {
  return fetch(`${process.env.KEYCLOAK_ISSUER}/protocol/openid-connect/token`, {
    headers: { 
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      client_id: process.env.KEYCLOAK_CLIENT_ID,
      client_secret: process.env.KEYCLOAK_CLIENT_SECRET,
      grant_type: 'refresh_token',
      refresh_token: token.refreshToken!,
    }),
    method: 'POST',
    cache: 'no-store'
  });
}

export const authOptions: AuthOptions = {
  providers: [
    KeycloakProvider({
      clientId: process.env.KEYCLOAK_CLIENT_ID,
      clientSecret: process.env.KEYCLOAK_CLIENT_SECRET,
      issuer: process.env.KEYCLOAK_ISSUER,
      idToken: true,
    }),
    CredentialsProvider({
      credentials: {
        username: { label: 'Username', type: 'text', },
        password: { label: 'Password', type: 'password', },
      },
      authorize: async (credentials, req) => {
        try {
          const url = `${process.env.KEYCLOAK_ISSUER}/protocol/openid-connect/token`;
          const data = new URLSearchParams({
            client_id: process.env.KEYCLOAK_CLIENT_ID,
            client_secret: process.env.KEYCLOAK_CLIENT_SECRET,
            grant_type: 'password',
            scope: 'openid profile email offline_access',
            response_type: 'code',
            username: credentials?.username!,
            password: credentials?.password!,
          });

          const response = await fetch(url, {
            body: data,
            method: 'POST',
            cache: 'no-store'
          });
          if (response.status === 200) {
            const tokenInfo = await response.json();
            if (tokenInfo.access_token) {
              const response = await fetch(`${process.env.KEYCLOAK_ISSUER}/protocol/openid-connect/userinfo`, {
                headers: { 
                  'Content-Type': 'application/x-www-form-urlencoded',
                  'Authorization': `Bearer ${tokenInfo.access_token}`
                },
                method: 'GET',
                cache: 'no-store'
              });
              const user = await response.json();

              return {
                ...user,
                idToken: tokenInfo.id_token,
                accessToken: tokenInfo.access_token,
                refreshToken: tokenInfo.refresh_token,
              };
            }
          } else {
            console.error('Error:', response.status, response.statusText);
          }
        } catch (error) {
          console.error('Request failed:', error);
        }

        return null;
      }
    }),
  ],
  //pages: {
  //  signIn: '/auth/signin',
  //  signOut: '/auth/signout',
  //},
  //session: {
  //  strategy: 'jwt',
  //  maxAge: 60 * 30
  //},
  secret: process.env.NEXTAUTH_SECRET,
  callbacks: {
    async jwt({ token, user, account }) {
      if (user) {
        token.idToken = user.idToken;
        token.accessToken = user.accessToken;
        token.refreshToken = user.refreshToken;
        token.expiresAt = account.expires_at;
      }
      if (Date.now() < (token.expiresAt! * 1000 - 60 * 1000)) {
        return token;
      } else {
        try {
          const response = await requestRefreshOfAccessToken(token);

          const tokens: TokenSet = await response.json();

          if (!response.ok) throw tokens;

          const updatedToken: JWT = {
            ...token, // Keep the previous token properties
            idToken: tokens.id_token,
            accessToken: tokens.access_token,
            expiresAt: Math.floor(Date.now() / 1000 + (tokens.expires_in as number)),
            refreshToken: tokens.refresh_token ?? token.refreshToken,
          };
          return updatedToken;
        } catch (error) {
          console.error('Error refreshing access token', error);
          return { ...token, error: 'RefreshAccessTokenError' };
        }
      }
    },
    async session({ session, token }) {
      session.accessToken = token.accessToken;
      session.error = token.error;
      if (!token.error) {
        return session;
      }
      return null;
    },
  }
}

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST }
