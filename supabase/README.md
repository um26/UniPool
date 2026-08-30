# UniPool Supabase

UniPool uses a dedicated Supabase project (`jwodrevycbzlcukkoaps`, Mumbai/ap-south-1) for shared-state features that should not depend on the legacy Render mobility API.

Current production Edge Functions:
- `unipool-shared` — Circles, personal finance, direct-chat persistence, presence/typing, and shared conversation state.
- `unipool-utility` — user directory/email lookup, Circle email invites, restricted-user relations, and policy-consent records.

Security model:
- All UniPool Supabase tables have RLS enabled.
- No browser-facing table policies are enabled.
- Edge Functions use the service role internally and validate the existing UniPool bearer session before authenticated operations.
- The UniPool Supabase project is separate from ClockIt and must not share application tables or credentials with it.

The canonical schema is managed through Supabase migrations. The production database currently includes Circle/expense tables, personal transactions, chat/presence tables, directory/session cache, email invite records, user relations, and policy consents.
