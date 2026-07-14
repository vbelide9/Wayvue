# Wayvue × Supabase — setup

Supabase backs Wayvue's community features (Phase 1: **ratings on recommended places**).
It gives us three things the app doesn't have today: user accounts (Auth), a database
(Postgres), and — later — file storage for the social feed.

The client talks to Supabase **directly** using the public anon key; Row-Level Security
(in [`schema.sql`](./schema.sql)) is what enforces "a user can only write their own
rating." The Express server is not involved in the ratings path.

## One-time setup (you do this)

1. **Create a project** at <https://supabase.com/dashboard> (free tier is fine).
2. **Run the schema**: Dashboard → SQL Editor → New query → paste all of
   [`schema.sql`](./schema.sql) → Run. Re-running it later is safe.
3. **Enable auth**: Dashboard → Authentication → Providers. Turn on whichever sign-in
   method we settle on (email magic link needs no extra config; Google OAuth needs a
   Google Cloud OAuth client + the callback URL Supabase shows you).
4. **Grab your keys**: Dashboard → Project Settings → API. Copy:
   - **Project URL** → `VITE_SUPABASE_URL`
   - **anon / public key** → `VITE_SUPABASE_ANON_KEY`
5. Put them in `client/.env` (see `client/.env.example`). The anon key is meant to be
   public — it only ever acts through RLS. **Never** put the `service_role` key in the
   client.

## After that (code)

`client/src/lib/supabase.ts` reads those two env vars and exports the browser client.
If the vars are unset, the client is `null` and the ratings UI simply doesn't render —
the rest of the app keeps working exactly as it does today.
