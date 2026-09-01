# AliaSpaces mobile

Focused Expo SDK 57 client for the owner surfaces that benefit from a native app:

- persona chat with resumable workspaces;
- a read-only, exactness-aware approval inbox;
- sourced persona research briefs.

The connectors, provider consent, credentials, immutable-media scheduling approval, ledger, and publishing controls remain in the web command center. This app never contains a service-role key and never calls an internal service-role RPC.

## Private local setup

1. Copy `.env.example` to `.env` on the development machine.
2. Set the project URL and **publishable** key from the Supabase project Connect panel. Do not use or paste a service-role key.
3. Add `aliaspaces://auth/callback` to Supabase Auth's redirect allow-list before testing Google sign-in. That dashboard change and the Google consent screen are owner actions.
4. Run `pnpm start` for the signed-out shell. Test the custom-scheme OAuth callback in an
   Android/iOS development build or store-style build; Expo Go is not proof that a production
   custom-scheme login works.

The populated `.env` is ignored by Git. Mobile sessions use Expo SecureStore in bounded chunks; the web build uses AsyncStorage. Real-device login, provider consent, biometric behavior, store identifiers, signing, and release builds remain separate owner-gated verification work.

## Verification

```text
pnpm run verify
```

This lints, type-checks, and creates a static web export without logging in, sending AI prompts, changing cloud data, scheduling, or publishing.
