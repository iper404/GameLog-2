<h1 align="center">GameLog 2.0</h1>
<h3 align="center">Full-Stack Web App</h3>

<p align="center">
Track your <b>Now Playing</b> game + manage a <b>backlog queue</b>, with progress bars and per-user accounts.
</p>

<img width="949" height="908" alt="image" src="https://github.com/user-attachments/assets/7bd29c38-b45a-42db-8339-d8f68a62c16b" />

---

## Tech Stack

**Frontend**
- TypeScript + React + **Next.js** (App Router)
- Tailwind CSS

**Backend**
- Python + **FastAPI**
- SQLModel (ORM)

**Database / Auth / Storage**
- **Supabase** (Auth + Postgres + optional Storage)

**Deployment**
- Frontend: **Vercel**
- Backend: **Render**

---

## Overview

GameLog 2.0 is a web app that lets users:
- create an account
- add games
- set a “Now Playing” game
- track hours + estimated game length (auto completion %)
- manage a backlog queue with progress bars

The app is multi-user: each user only sees and can edit/delete their own games.

---

## Features

- **Supabase Auth** (sign up / sign in)
- **Per-user game library** (backend enforces ownership)
- **Now Playing card** with cover art + completion progress bar
- **Backlog queue** sorted by recent “now playing” selections
- **CRUD**
  - Add game
  - Edit progress / estimated length
  - Edit game info (title/platform/cover URL)
  - Delete game
- **Responsive UI** (mobile-friendly layout)

---

## Live Demo

**Try it here:** https://gamelog-2.vercel.app/

Log in with the demo account to test the features of the app:

email:
test@gmail.com

password:
123456

Or:

Create an account and test:
- Add games
- Set Now Playing
- Update hours / estimated length (completion % recalculates automatically)
- Confirm per-user data isolation by using a second account
---

## Roadmap

**Near-term**
- **Cover art upload** via Supabase Storage (upload file → store public URL on the game)

**Mid-term**
- Game search + metadata autofill (title, cover art, platform)
  - Consider **RAWG** or **IGDB** (more reliable than unofficial HowLongToBeat scraping)
- “Sessions” log (date + hours played) and simple analytics (weekly hours, completion velocity)
- Pagination / search / filters (platform, status, completion range)

**Long-term**
- Social + sharing (public profile, share Now Playing)
- iOS App

---

## Implementation Notes

**Authentication**
- Supabase Auth in the frontend
- Frontend sends `Authorization: Bearer <access_token>` to the backend
- Backend validates token against Supabase and derives `user_id`
- All game queries are scoped by `owner_id = user_id`

**Data model**
- Games include:
  - title, platform, status
  - hours_played, estimated_hours → computed completion_percent (0–100)
  - is_current (Now Playing)
  - last_now_playing_at (used to order backlog recency)

**UI/UX**
- Now Playing is always the primary element
- Backlog queue reflects recency of Now Playing history
- Mobile-friendly layout with careful header sizing and backlog presentation

---

## Copyright & License
© Ivan Peric, 2025

