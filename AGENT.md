# Agent Guide

## Project
- Name: DigQueue
- Stack: Next.js App Router + TypeScript + Tailwind + SQLite + Drizzle

## Guardrails
- No piracy/downloading copyrighted audio.
- Allowed exports: metadata CSV/JSON and legal outbound links.
- Respect Discogs and YouTube API usage patterns with caching and rate limits.

## Primary Workflows
1. Queue Discogs labels.
2. Ingest releases and tracklists.
3. Match playable YouTube videos.
4. Autoplay queue continuously in mini-player.
5. Track listened/unlistened + saved / wishlist for recommendations.

## Key Commands
- `yarn dev`
- `yarn db:migrate`
- `yarn lint`
- `yarn build`

## Git Discipline
- After every major change or completed feature: run `yarn lint` (and `yarn build` when relevant), commit, then push immediately.
- Do not leave multiple completed major features unpushed in the local branch.
