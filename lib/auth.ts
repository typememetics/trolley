import { betterAuth } from "better-auth";

// No `database` on purpose: Better Auth runs stateless, keeping the session in an
// encrypted cookie. Phase 1 only needs "who is this" (name + picture), nothing durable.
export const auth = betterAuth({
  socialProviders: {
    twitter: {
      clientId: process.env.TWITTER_CLIENT_ID!,
      clientSecret: process.env.TWITTER_CLIENT_SECRET!,
      // Read-only identity. X needs both scopes for GET /2/users/me; we skip the
      // provider's default offline.access and users.email since neither is used.
      disableDefaultScope: true,
      scope: ["users.read", "tweet.read"],
      // X serves a 48px "_normal" avatar; the same URL with "_400x400" is the full-size one.
      mapProfileToUser: profile => ({
        image: profile.data.profile_image_url?.replace(/_normal(\.\w+)?$/, "_400x400$1"),
      }),
    },
  },
});
