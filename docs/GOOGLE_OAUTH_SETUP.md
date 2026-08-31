# Set up "Entrar com Google" (one-time, ~15 minutes)

Adds one-tap login alongside the magic-link email flow. Massive UX win for non-tech students who already have Gmail.

> **Not currently in use.** There is no Google button on `/login` today — the
> action survives in `src/app/login/actions.ts` (`signInWithGoogle`) but nothing
> calls it, so this whole document is a plan, not a fix for something broken.
> If you do wire it back up, note the origins below have been corrected: the
> app moved off Vercel to Cloudflare and lives at https://batusboxe.com.

## Step 1 — Create OAuth credentials in Google Cloud

1. Go to **https://console.cloud.google.com/**.
2. Top-left dropdown → **New project** → name it `Batus` → **Create**.
3. Wait ~30 seconds for the project to provision, then make sure it's selected.
4. Left sidebar: **APIs & Services → OAuth consent screen**.
   - User type: **External** → Create.
   - App name: `Batus Boxing & Training`.
   - User support email: `batusboxing@gmail.com`.
   - Developer contact: same.
   - **Save and continue** through the next steps with defaults until you're back at the OAuth consent screen.
   - Click **Publish app** (this just makes it available to all Google users, no review needed for our minimal scopes).
5. Left sidebar: **APIs & Services → Credentials**.
   - **Create credentials → OAuth client ID**.
   - Application type: **Web application**.
   - Name: `Batus Web`.
   - Authorised JavaScript origins:
     - `https://batusboxe.com`
     - (add your custom domain later when bought)
   - Authorised redirect URIs:
     - `https://udgrwwkuvtycidxfaffx.supabase.co/auth/v1/callback`
   - **Create**.
6. A modal pops up with your **Client ID** and **Client secret**. Copy both — you'll paste them into Supabase next. (You can also retrieve them later from this page.)

## Step 2 — Wire it into Supabase

1. **Supabase dashboard → Authentication → Providers**.
2. Scroll to **Google** → toggle it **on**.
3. Paste:
   - **Client ID (for OAuth)** — from step 1.6.
   - **Client Secret (for OAuth)** — from step 1.6.
4. The **Callback URL** field will already show `https://udgrwwkuvtycidxfaffx.supabase.co/auth/v1/callback`. Confirm it matches what you put in Google.
5. **Save**.

## Step 3 — Test

1. Open `/login` in a private window (so you're not already logged in).
2. Click **Entrar com Google**.
3. It should redirect to Google → pick an account → consent → bounce back to `/admin` (if you signed in as `batusboxing@gmail.com` which is admin) or `/aulas`.

If you see "OAuth failed" coming back, the most common causes:
- Redirect URI typo in Google Cloud Console.
- Google project hasn't finished provisioning (give it 5 minutes after creation).
- OAuth consent screen still in "Testing" state (publish it).

## What about the magic-link flow?

It still works exactly as before. Google OAuth is *additional* — students who don't have Gmail or prefer email still get the email link. Both flows land them in the same place.
