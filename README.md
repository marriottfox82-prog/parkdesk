# ParkDesk

Parking allocation app for Whiteladies Medical Practice.

## Setup

```bash
npm install
cp .env.local.example .env.local
# Fill in VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY from
# Supabase dashboard → Settings → API
npm run dev
```

## Structure

```
src/
  lib/
    supabase.js       Supabase client + ORG_ID constant
    AuthContext.jsx   Session + staffRow context
  hooks/
    useDailyView.js   Fetches spaces, roster, allocations for today
    useWeeklyPlan.js  Fetches allocations for a given week
    useMoveRequest.js Realtime subscription + ack/snooze helpers
  pages/
    LoginPage.jsx     Email/password sign in
    DailyView.jsx     Main reception view — lot grid + notifications
    WeeklyPlan.jsx    Advance planning grid (stub)
    AdminPage.jsx     Admin settings (stub)
  components/
    shared/Nav.jsx    Top navigation bar
```

## Deploy (Netlify)

Connect repo in Netlify dashboard.
Set environment variables under Site → Environment variables:
  VITE_SUPABASE_URL
  VITE_SUPABASE_ANON_KEY

Deploys automatically on push to main.

## Auth setup (demo)

1. Supabase dashboard → Authentication → Users → Invite user
2. Create your account (admin) and a demo staff account
3. Accept both invites, set passwords
4. In Supabase Table Editor → staff table, update auth_user_id
   for those two rows with the UUIDs from auth.users
