import { betterAuth } from "better-auth";

// No `database` on purpose: Better Auth runs stateless, keeping the session in an
// encrypted cookie. Phase 1 only needs "who is this" (name + picture), nothing durable.
export const auth = betterAuth({
  socialProviders: {
    // Default scopes (read:user, user:email): Better Auth refuses a sign-in without an
    // email, and many GitHub users keep theirs private. Nothing here can write to GitHub.
    github: {
      clientId: process.env.GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!,
    },
  },
});
