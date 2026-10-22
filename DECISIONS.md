# Decisions

Format: date · decision · why.

- 2026-10-22 · Next.js App Router, strict TS, Tailwind, shadcn/ui, Zod, Vitest, pnpm · plan-mandated stack; pnpm is the package manager.
- 2026-10-22 · Modular monolith, no database/ORM/auth/AI provider/hosting/job runner yet · plan says to decide after feasibility work (Phase 0/2).
- 2026-10-22 · Evidence validation is separate from schema validation (`src/core/evidence/validate.ts`) · a schema-valid draft can still cite nothing.
- 2026-10-22 · Claim statuses: `verified | inferred | unknown | needs_clarification`; no confidence percentages · principle 4.

## Open

- AI provider (compare quality/cost on fixtures), ORM, auth library, hosting, background job mechanism.
