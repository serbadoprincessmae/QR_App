# Phase 2 — Authentication

> Replace hardcoded student identity with Supabase Authentication.
> Users can register, log in, and log out.

---

## 1. MODULE OBJECTIVE

**What are we building?**

We are replacing the hardcoded `STUDENT-2026-001` with real Supabase Authentication. After this phase, users must register an account and log in before using the app. Each user gets a unique identity.

**Why do we need it?**

Currently, every user is the same person. There is no way to distinguish between students. If the app is reinstalled, the identity is lost. Authentication solves this.

**What will the student learn?**

- What authentication is (sign up, sign in, sign out)
- What a session is (staying logged in)
- How to create auth-protected screens
- How to get the current logged-in user
- How explicit navigation works with expo-router

---

## 2. CURRENT STATE

```
App starts
    |
    v
No login screen
    |
    v
Hardcoded: STUDENT_ID = 'STUDENT-2026-001'
    |
    v
All screens use this ID
```

---

## 3. TARGET STATE

```
App starts
    |
    v
Login Screen (default)
    |
    +--- Register --> Account created --> Login Screen
    |
    +--- Login (email + password) --> Tabs (Scan, History, Profile)
                                        |
                                        +--- Profile --> Sign Out --> Login Screen
```

---

## 4. FILES INVOLVED

| File | Action | Why |
|---|---|---|
| `lib/auth.ts` | Created | Authentication state + service (pub/sub pattern) |
| `app/login.tsx` | Created | Login screen with email/password form |
| `app/register.tsx` | Created | Registration screen with email/password/confirm |
| `app/_layout.tsx` | Modified | Stack with auth-based `<Redirect>` + loading state (see `docs/07-visual-identity.md`) |
| `app/(tabs)/profile.tsx` | Modified | Shows user info + Sign Out button |
| `app/(tabs)/scan.tsx` | Modified | Use authenticated user instead of hardcoded ID |
| `app/(tabs)/history.tsx` | Modified | Use authenticated user instead of hardcoded ID |
| `constants/student.ts` | Unchanged | Will be deprecated later |

---

## 5. CONCEPT EXPLANATIONS

### What is Authentication?

Authentication answers: **"Who are you?"**

- Sign Up: Create a new account
- Sign In: Log into existing account
- Sign Out: End the session

### Why Not Use onAuthStateChange?

Supabase's `onAuthStateChange` and `getSession()` are designed for web environments. In React Native with Expo Go, these APIs can hang indefinitely due to:
- Stale tokens in storage triggering failed refresh attempts
- AsyncStorage adapter compatibility issues
- Network timeout behavior differences on mobile

**Our solution:** A global state store with a pub/sub pattern. Auth operations (`signIn`, `signUp`, `signOut`) directly update the global state and notify all listeners. Navigation is handled explicitly with `router.replace()`.

### Why Explicit Navigation Instead of Conditional Rendering?

expo-router manages its own navigation state. When a root layout conditionally renders different `<Stack>` elements based on auth state, expo-router cannot properly unmount/remount screens.

**Our solution:** All screens are always registered in a single `<Stack>`. After login, the screen calls `router.replace('/(tabs)')` to navigate. After sign out, it calls `router.replace('/login')`.

---

## 6. BEFORE/AFTER COMPARISON

### Student Identity

```diff
- import { STUDENT_ID } from '@/constants/student';
- registerAttendance(data, STUDENT_ID)
+ import { useAuth } from '@/lib/auth';
+ const { user } = useAuth();
+ const studentId = user?.id ?? 'unknown';
+ registerAttendance(data, studentId)
```

### Auth State Management

```diff
- // Before: No auth state, no login screen
+ // After: Global state with pub/sub
+ let globalSession: Session | null = null;
+ let listeners: Set<() => void> = new Set();
+
+ export function setAuth(session: Session | null) {
+   globalSession = session;
+   globalUser = session?.user ?? null;
+   globalLoading = false;
+   notify();
+ }
```

### Navigation

```diff
- // Before: Conditional Stack rendering (doesn't work with expo-router)
+ // After: Single Stack, explicit navigation
+ // login.tsx: router.replace('/(tabs)') after sign in
+ // profile.tsx: router.replace('/login') after sign out
```

### Sign Out

```diff
- // Before: Wait for Supabase server (hangs on mobile)
+ // After: Update state immediately, fire server call in background
+ export async function signOut() {
+   setAuth(null);
+   supabase.auth.signOut().catch(() => {});
+   return { error: null };
+ }
```

---

## 7. LINE-BY-LINE EXPLANATION

### lib/supabase.ts

```typescript
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
```
- `createClient` — Creates the Supabase client singleton
- `process.env.EXPO_PUBLIC_*` — Expo environment variables (loaded from `.env`)
- `autoRefreshToken: true` — Supabase auto-refreshes expired tokens
- `persistSession: true` — Session is stored on device
- `detectSessionInUrl: false` — Not needed for React Native (no URL bar)

**Note:** We do NOT use a custom storage adapter (SecureStore or AsyncStorage). The default storage works on both iOS and Android. Custom adapters caused the session to hang during `getSession()`.

### lib/auth.ts

```typescript
import { useState, useEffect } from 'react';
import { supabase } from './supabase';
import type { Session, User } from '@supabase/supabase-js';
```
- `useState`, `useEffect` — React hooks for subscribing to changes
- `supabase` — The client from Phase 1
- `Session`, `User` — TypeScript types from Supabase

```typescript
type AuthState = {
  session: Session | null;
  user: User | null;
  loading: boolean;
};
```
- Defines the shape of our auth state
- `session` — Contains access token, user info (null if not logged in)
- `user` — The logged-in user object (null if not logged in)
- `loading` — True while checking if session exists

```typescript
let globalSession: Session | null = null;
let globalUser: User | null = null;
let globalLoading = false;
let listeners: Set<() => void> = new Set();
```
- **Module-level variables** — Shared across all components that call `useAuth()`
- `globalSession` — Current session (null = not logged in)
- `globalUser` — Current user (null = not logged in)
- `globalLoading` — Starts `false` (no async check needed)
- `listeners` — Set of callback functions to notify when state changes

```typescript
function notify() {
  listeners.forEach((l) => l());
}
```
- Calls every registered listener when state changes

```typescript
export function setAuth(session: Session | null) {
  globalSession = session;
  globalUser = session?.user ?? null;
  globalLoading = false;
  notify();
}
```
- **The core function** — Updates global state and notifies all listeners
- Called by `signIn`, `signUp`, and `signOut`

```typescript
export function useAuth(): AuthState {
  const [, forceRender] = useState(0);

  useEffect(() => {
    const listener = () => forceRender((n) => n + 1);
    listeners.add(listener);
    return () => { listeners.delete(listener); };
  }, []);

  return {
    session: globalSession,
    user: globalUser,
    loading: globalLoading,
  };
}
```
- Custom React hook — Any component can call `useAuth()` to get current auth state
- Uses `forceRender` to trigger re-render when global state changes
- Cleans up listener when component unmounts
- Returns current global state (not React state — reads directly from module variables)

```typescript
export async function signUp(email: string, password: string) {
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (!error && data.session) {
    setAuth(data.session);
  }
  return { data, error };
}
```
- Creates a new user account via Supabase
- If successful and a session is returned, updates global state
- Returns data/error for the caller to handle

```typescript
export async function signIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (!error && data.session) {
    setAuth(data.session);
  }
  return { data, error };
}
```
- Logs in an existing user
- If successful, updates global state
- Returns data/error for the caller to handle

```typescript
export async function signOut() {
  setAuth(null);
  supabase.auth.signOut().catch(() => {});
  return { error: null };
}
```
- **Key design choice:** Updates state immediately (sets session to null)
- Fires Supabase `signOut()` in the background (fire-and-forget)
- This avoids the hang that occurs when waiting for the server response on mobile
- The caller navigates to login immediately after this returns

### app/_layout.tsx

> **Note:** This layout now includes an **auth-based redirect**. The current version is documented in `docs/07-visual-identity.md`. This section keeps the code that was accurate at the end of Phase 2; see the visual-identity doc for the updated file.

```typescript
import { Stack } from 'expo-router';
import { COLORS } from '@/constants/colors';

export default function RootLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="login" />
      <Stack.Screen name="register" />
      <Stack.Screen name="(tabs)" />
    </Stack>
  );
}
```
- **Original Phase 2 layout** — All screens are always registered within a single `<Stack>`
- Navigation is handled per-screen after auth operations (e.g. `router.replace` in login/register)
- `headerShown: false` — All screens manage their own headers
- A later design pass added auth-based `<Redirect>` routing on top of this single Stack (see `docs/07-visual-identity.md`)

### app/login.tsx

```typescript
const router = useRouter();

const handleLogin = async () => {
  setError(null);
  setLoading(true);
  try {
    const { data, error: authError } = await signIn(email.trim(), password);
    if (authError) {
      setError(authError.message);
    } else {
      router.replace('/(tabs)');
    }
  } catch (err: any) {
    setError(err?.message || 'Unexpected error');
  } finally {
    setLoading(false);
  }
};
```
- `useRouter()` — Gives access to expo-router navigation
- After successful `signIn`, calls `router.replace('/(tabs)')` to navigate to the main app
- On error, shows the error message on the login form
- `router.replace()` replaces the current screen (user can't press Back to go to login)

### app/(tabs)/profile.tsx

```typescript
const router = useRouter();

const handleSignOut = async () => {
  setLoading(true);
  try {
    await signOut();
    router.replace('/login');
  } catch (err: any) {
    Alert.alert('Error', err?.message || 'Failed to sign out.');
  } finally {
    setLoading(false);
  }
};
```
- After `signOut()`, immediately navigates to login screen
- Shows user email and User ID on the profile card
- Sign Out button is disabled while the operation is in progress

---

## 8. TESTING

### How to Test This Module

1. **Start Expo:**
   ```bash
   npx expo start -c
   ```

2. **Verify login screen appears:**
   - You should see "Welcome Back" screen with email/password fields
   - NOT the Home screen (you are not logged in)

3. **Test Registration:**
   - Tap "Don't have an account? Sign Up"
   - Enter email and password
   - Tap "Sign Up"
   - You should see "Check your email!" message (if email confirmation is ON)
   - OR you may be logged in directly (if email confirmation is OFF)

4. **Test Login:**
   - Go back to the login screen
   - Enter your email and password
   - Tap "Sign In"
   - You should see the Scan tab

5. **Test Sign Out:**
   - Go to Profile tab
   - Tap "Sign Out"
   - You should be redirected to the login screen

6. **Test Login Error:**
   - Enter wrong email or password
   - Tap "Sign In"
   - You should see an error message

---

## 9. EXPECTED RESULT

- Login screen appears when app starts (default screen)
- Registration creates account in Supabase
- Login with correct credentials navigates to tabs
- Login with wrong credentials shows error message
- Sign Out navigates back to login screen
- Profile shows user email and User ID
- Scan screen uses authenticated user ID (not hardcoded)
- History screen uses authenticated user ID (not hardcoded)

---

## 10. COMMON ERRORS

### Error: "Invalid login credentials"

**Cause:** Wrong email or password.

**Fix:** Verify email and password are correct. Check for typos. Check Supabase Dashboard > Authentication > Users to verify the account exists.

### Error: "Email not confirmed"

**Cause:** User has not confirmed their email (email confirmation is ON in Supabase).

**Fix:** Either confirm the email, or disable email confirmation:
1. Go to Supabase Dashboard
2. Authentication > Providers > Email
3. Toggle "Confirm email" OFF
4. Click Save Changes

### Error: "User already registered"

**Cause:** Email is already in use.

**Fix:** Use a different email, or try to log in with the existing account.

### Error: App stuck on loading spinner

**Cause:** `getSession()` or `onAuthStateChange` is hanging.

**Fix:** This is the known issue this implementation works around. If you see this, ensure you are using the pub/sub pattern in `lib/auth.ts` (not `getSession()` or `onAuthStateChange`).

### Error: Login succeeds but stays on login screen

**Cause:** Navigation not triggered after login.

**Fix:** Ensure `app/login.tsx` calls `router.replace('/(tabs)')` after successful `signIn()`.

### Error: Sign out doesn't navigate

**Cause:** Navigation not triggered after sign out.

**Fix:** Ensure `app/(tabs)/profile.tsx` calls `router.replace('/login')` after `signOut()`.

---

## 11. SECURITY NOTES

### What is Safe

- Email + password authentication via Supabase is secure
- Passwords are hashed (never stored in plain text)
- Supabase handles token management and refresh

### What to Watch For

- Never log passwords in console
- Never store passwords in your own database
- Always use HTTPS (Supabase enforces this)
- Email confirmation prevents fake accounts (disable only in dev)

### Email Confirmation

By default, Supabase may require email confirmation. For development:
1. Go to Supabase Dashboard > Authentication > Providers > Email
2. Toggle "Confirm email" OFF
3. Click Save Changes

---

## 12. STEP-BY-STEP EXECUTION GUIDE

### Prerequisites

- Phase 1 completed (Supabase client installed, `.env` configured)
- Supabase project created with real credentials in `.env`
- Expo development server can start
# Phase 3 — Database Design

> This is a **student lab activity**. Work through it step by step. Every section builds on the one before it. By the end you will have created a **real cloud database** that is secure and ready for your app.

---

## HOW TO USE THIS DOCUMENT (Read Me First)

This phase is **hands-on**. You will:
1. **LEARN** — read short explanations (in plain language, with analogies)
2. **DO** — run SQL in your Supabase project
3. **CHECK** — confirm each step worked using the checklists
4. **REVIEW** — answer the "Check Your Understanding" questions at the end

**Time needed:** ~45 minutes
**You will need:** Your Supabase project from Phase 1, and the SQL code in `supabase/schema.sql`

---

## 1. WHAT ARE WE DOING AND WHY?

### The Big Picture

Your app currently stores attendance in a **local file** on your phone (called SQLite). This has 3 big problems:

| Problem | What it means |
|---|---|
| 🗑️ **Data lives on ONE device** | Delete the app → read your attendance history? GONE. |
| 👤 **No real users** | It pretends everyone is `STUDENT-2026-001`. |
| 🔓 **No security** | Anyone using the app could read everyone's data. |

Today, we are going to build a **cloud database** (on Supabase) that fixes all 3 problems.

### The Analogy: A Notebook vs. A Shared Online Document

Think of it this way:

- **SQLite** = a paper notebook you carry in your pocket. Only YOU can see it. Lose the notebook → your notes are gone. Rip out a page → nobody knows.
- **Supabase/PostgreSQL** = a **Google Spreadsheet** shared on the internet. Anyone with an account can see THEIR OWN tab. The owner can add security so strangers can't peek. And it's backed up — you can't lose it.

Today you build the structure of that online spreadsheet — the **tables** (tabs), the **columns** (cells), and the **security rules** (who can see what).

### What You Will Understand By The End

After this phase, you'll be able to answer:
- What is a **table**, a **row**, and a **column**?
- What is a **Primary Key** and why does every table have one?
- What is a **Foreign Key** and how does it connect tables?
- What is a **Unique constraint** and why does it stop duplicate attendance?
- What is **Row Level Security** and why is it essential?
- How does a **trigger** auto-create a profile when someone signs up?

---

## 2. YOUR APP'S DATABASE: BEFORE (SQLite)

Here is the database structure your app uses RIGHT NOW. Don't worry — you don't need to write this. Just READ it and understand the idea.

```sql
-- events table: stores details about each event
CREATE TABLE events (
  eventId TEXT PRIMARY KEY NOT NULL,   -- a unique code for the event
  title   TEXT NOT NULL,               -- the event name
  start   TEXT NOT NULL,               -- start time
  end     TEXT NOT NULL                -- end time
);

-- attendance table: stores one row per student scan
CREATE TABLE attendance (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,  -- auto-incrementing number
  studentId   TEXT NOT NULL,                      -- which student (hardcoded!)
  eventId     TEXT NOT NULL,                      -- which event
  scannedAt   TEXT NOT NULL,                      -- when scanned
  UNIQUE (studentId, eventId)                     -- no duplicate scans
);
```

**Spot the problems:**
- There is **no `profiles` table** — we don't even track real users.
- `studentId` is just a text string like `"STUDENT-2026-001"` — not a real account.
- Anyone running the app gets the SAME `studentId`. That's the whole problem.

> ✅ **STOP AND THINK:** In your own words, why is having one `studentId` for everyone a problem? (Write it down before moving on.)

---

## 3. WHAT WE ARE BUILDING: AFTER (Supabase PostgreSQL)

Here is the NEW structure. We are creating **three** tables instead of two. Each one serves a clear purpose.

### The Three Tables At A Glance

```
┌─────────────────────────────────────────────────────────────┐
│                    SUPABASE CLOUD DATABASE                    │
│                                                               │
│   auth.users  (Supabase's built-in list of user accounts)     │
│        │                                                      │
│        │ 1:1 (one profile per user)                          │
│        ▼                                                      │
│   ┌────────────┐    creates ┌──────────────┐                 │
│   │  profiles  │            │    events    │                 │
│   └────────────┘            └──────┬───────┘                 │
│                                    │ 1:N (one event,         │
│                                    │ many attendance rows)   │
│                                    ▼                         │
│                            ┌──────────────┐                 │
│                            │  attendance  │  ← one student   │
│                            └──────────────┘    scans one event│
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

Hold on to this picture. Now we'll explain each piece **line by line**.

---

## 4. TABLE 1: `profiles` — WHO ARE THE USERS?

### Why do we need it?

Phase 2 gave each student a **login** (email + password). Supabase keeps those logins in a special built-in table called `auth.users`. But we also want to store extra info about each person (like whether they're a student or a teacher, or their display name). So we create our OWN table called `profiles` that sits **alongside** `auth.users`.

### Read the SQL line by line

```sql
create table if not exists public.profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  email      text not null,
  full_name  text,
  role       text not null default 'student' check (role in ('student', 'teacher')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

Let's decode each line:

| Line | Meaning (plain English) |
|---|---|
| `create table if not exists public.profiles` | Make a table named `profiles` in the `public` schema. `if not exists` = don't error if it's already there (safe to re-run). |
| `id uuid primary key` | `id` is the **Primary Key** — a unique ID for each profile. `uuid` = a huge random ID (like a long fingerprint) that can't collide across devices. `primary key` = unique + required + indexed. |
| `references auth.users (id)` | This is a **Foreign Key** — it says "this profile belongs to ONE user from the auth.users table." |
| `on delete cascade` | If the user account is deleted, delete their profile too (keeps things clean). |
| `email text not null` | Store their email. `text` = text data type. `not null` = this field can't be empty. |
| `full_name text` | Optional display name (no `not null`, so it CAN be empty). |
| `role text not null default 'student'`<br>`check (role in ('student','teacher'))` | `role` is `'student'` by default. The `check` is a rule: it can ONLY be `'student'` or `'teacher'` — anything else is rejected. |
| `created_at timestamptz not null default now()` | When this profile was created. `timestamptz` stores date+time WITH timezone info. `default now()` auto-fills it. |
| `updated_at ...` | When it was last changed. (Convention: every table should track when it was created/updated.) |

> 💡 **KEY CONCEPT — Primary Key:** Every table has a Primary Key column that is *unique* for each row. It's like each person's **national ID number** — no two people share the same one, and it's used to find them.
>
> 💡 **KEY CONCEPT — Foreign Key:** A Foreign Key is a column in one table that points to the Primary Key of another table. It's how tables **connect**. Here, `profiles.id` points to `auth.users.id`.

---

## 5. TABLE 2: `events` — WHAT IS THE EVENT?

### Read the SQL line by line

```sql
create table if not exists public.events (
  id          uuid primary key default gen_random_uuid(),
  event_code  text not null unique,
  title       text not null,
  start_time  timestamptz,
  end_time    timestamptz,
  created_by  uuid references auth.users (id) on delete set null,
  created_at  timestamptz not null default now()
);
```

| Line | Meaning (plain English) |
|---|---|
| `id uuid primary key default gen_random_uuid()` | Primary key. `default gen_random_uuid()` means PostgreSQL **generates a random ID automatically** — we don't have to provide one. |
| `event_code text not null unique` | The short code embedded in the QR code. `unique` = no two events can share the same code. |
| `title text not null` | Event name (e.g., "Research Defense"). |
| `start_time timestamptz` | When the event starts. **Note the name change** — we use `start_time` NOT `start`, because `start`/`end` are **reserved words** in PostgreSQL (they have special meaning). |
| `end_time timestamptz` | When the event ends. |
| `created_by uuid references auth.users (id)`<br>`on delete set null` | Who created this event (a teacher's user ID). `on delete set null`: if that teacher's account is deleted, don't delete the event — just blank out `created_by`. |
| `created_at ...` | When the event was created. |

> ⚠️ **CAUTION — Reserved Words:** Words like `start`, `end`, `select`, `from`, `order` are **reserved** in PostgreSQL — they already mean something to the database engine. You cannot use them as column names without special handling. **This caused a real bug earlier** (see Section "Common Errors")! We avoid it by naming them `start_time` / `end_time`.

---

## 6. TABLE 3: `attendance` — WHO SCANNED WHAT?

### Read the SQL line by line

```sql
create table if not exists public.attendance (
  id          uuid primary key default gen_random_uuid(),
  student_id  uuid not null references auth.users (id) on delete cascade,
  event_id    uuid not null references public.events (id) on delete cascade,
  scanned_at  timestamptz not null default now(),
  unique (student_id, event_id)
);
```

| Line | Meaning (plain English) |
|---|---|
| `id uuid primary key default gen_random_uuid()` | Primary key, auto-generated. |
| `student_id uuid not null references auth.users (id)` | **Which student** scanned. A Foreign Key pointing to the auth user. `not null` = every attendance row MUST have a student. |
| `event_id uuid not null references public.events (id)` | **Which event** they scanned. A Foreign Key pointing to `events`. |
| `scanned_at timestamptz not null default now()` | When the scan happened. Auto-filled with the current time. |
| `unique (student_id, event_id)` | **This is the anti-cheat rule!** A student can only appear ONCE per event. If they scan twice, the SECOND attempt is rejected. |

> 💡 **KEY CONCEPT — Unique Constraint:** `unique (student_id, event_id)` means "the combination of `(student_id, event_id)` must be unique across all rows." This is exactly what stops a student from registering for the same event twice. Remember this — the app will use it to show "Already registered for this event."

---

## 7. HOW THE TABLES CONNECT (Relationships)

Now let's connect the dots. This is called **database relationships**.

```
auth.users ──── 1:1  ──── profiles
     │                 (each user = one profile)
     │ uses
     ▼
events ──── 1:N ──── attendance
(one event)   (many scans)
     ▲
     └── created_by points to a user
```

| Relationship | Type | Meaning |
|---|---|---|
| `profiles.id → auth.users.id` | **1 to 1** | One user has exactly ONE profile. |
| `events.created_by → auth.users.id` | **Many to 1** | A teacher (one user) creates MANY events. |
| `attendance.student_id → auth.users.id` | **Many to 1** | A student has MANY attendance records. |
| `attendance.event_id → events.id` | **Many to 1** | An event has MANY attendance records. |

**Reading a relationship:** "A **student** scans an **event**. That scan is stored in `attendance` as one row linking `student_id` (the who) and `event_id` (the what)."

> ✅ **STOP AND THINK:** If a student wants to see their attendance history, which tables do we need to combine (JOIN)? Write down your guess before Section 11.

---

## 8. ROW LEVEL SECURITY (RLS) — THE SECURITY GUARD

### The danger without it

Remember the `anon` (publishable) API key is used by the app — and it's in your app's code. If someone extracts that key, they could query your database. **Without RLS, they could read EVERY student's attendance.** That's a privacy disaster.

### What RLS does

**Row Level Security** is like a **security guard at the door of every row**. Even if someone has the key, the guard decides: "Can YOU see THIS row?" It checks the rules you define using `auth.uid()`.

### What is `auth.uid()`?

`auth.uid()` returns the user ID of whoever is **currently logged in**. If nobody is logged in, it returns `null`.

So a rule like this means: **"You can only see attendance rows where YOU are the student."**

```sql
-- You can only READ attendance where student_id equals YOUR user id
create policy "Students can view their own attendance"
  on public.attendance for select
  using (auth.uid() = student_id);
```

### Reading a policy line by line

```sql
create policy "Students can view their own attendance"   -- name of the rule
  on public.attendance for select                        -- applies to SELECT (reading)
  using (auth.uid() = student_id);                        -- the rule: only if you are the student
```

| Keyword | Meaning |
|---|---|
| `create policy "name"` | Create a named security rule. |
| `on public.attendance` | Which table the rule protects. |
| `for select` | The action the rule controls. (`select` = read, `insert` = add, `update` = change, `delete` = remove) |
| `using (...)` | The condition that must be TRUE for the row to be visible. |
| `with check (...)` | The condition that must be TRUE to ADD/change a row. |

### The policies we wrote (and why)

| Policy | Action | Rule |
|---|---|---|
| "Profiles are viewable by owner" | select | you see your own profile only |
| "Users can insert their own profile" | insert | you can create your own profile |
| "Users can update their own profile" | update | you can edit your own profile |
| "Teachers can view profiles of their attendees" | select | a teacher can read the profile (name) of students who attended their events — added later in the "attendee names" enhancement (see the Phase 6/10 material) |
| "Events are readable by any authenticated user" | select | any logged-in user can read events (needed to validate QR codes) |
| "Users can insert events" | insert | any logged-in user can create an event |
| "Users can update their own events" | update | you can edit events you created |
| "Students can view their own attendance" | select | you see your own attendance only |
| "Students can insert their own attendance" | insert | you can add your own attendance |
| "Teachers can view attendance for their events" | select | teachers see attendance for events they created |

> 💡 **KEY CONCEPT — Row Level Security (RLS):** RLS is **not optional** in a multi-user app. It's the difference between "anyone with the key can read everything" and "each user can only see their own data." Later phases will rely on it heavily.

---

## 9. THE TRIGGER — AUTOMATIC PROFILES

When a new user signs up in Phase 2, we want their `profiles` row to be **created automatically**. We don't want a student to have to do it manually. PostgreSQL has a feature for this: a **trigger**.

A trigger is: **"When THIS happens to THIS table, automatically run THIS function."**

```sql
create or replace function public.handle_new_user()
returns trigger language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
```

| Piece | Meaning |
|---|---|
| `create or replace function handle_new_user()` | Define a function named `handle_new_user`. |
| `returns trigger language plpgsql` | It's a trigger function, written in plpgsql (PostgreSQL's SQL language). |
| `begin ... insert into profiles (id, email) values (new.id, new.email) ... end` | The function inserts a new profile using the new user's id and email. `new.id` / `new.email` = the values of the row that just got inserted into `auth.users`. |
| `create trigger on_auth_user_created` | Name the trigger. |
| `after insert on auth.users` | Run it AFTER a new row is inserted into `auth.users` (after a signup). |
| `for each row execute procedure handle_new_user()` | Run the function for every new row. |

**The flow:**
1. User signs up in the app (Phase 2) → Supabase adds a row to `auth.users`
2. Trigger fires automatically
3. A matching `profiles` row is created with that user's id and email
4. Done — no manual work needed

> ✅ **STOP AND THINK:** What would happen if a user signed up but the trigger didn't exist? (Hint: think about what happens when the app tries to read the profile of a user who has none.)

---

## 10. SQLITE vs POSTGRESQL — SIDE BY SIDE

| Feature | SQLite (old) | Supabase PostgreSQL (new) |
|---|---|---|
| Where it lives | Local file on your device | In the cloud (Supabase) |
| Users | Hardcoded `STUDENT-2026-001` | Real accounts in `auth.users` |
| Security | None — anyone can read/write | RLS policies per user |
| IDs | `INTEGER` auto-increment | `uuid` (globally unique) |
| Timestamps | `TEXT` strings | `timestamptz` (timezone-aware) |
| Foreign keys | Not enforced | Enforced by the database |
| Sharing | Impossible | Data available across devices |
| Backups | None | Automatic (cloud) |

**The big win:** Data is now **shared, secure, and backed up**.

---

## 11. HOW THE APP WILL USE THIS (Preview of Phase 4+)

Soon, your app's code will map to the tables like this:

| App action (in code) | Database action |
|---|---|
| Student scans a QR code | Validate `event` → find/create `events` row → insert `attendance` row |
| Check "Already registered?" | The `unique (student_id, event_id)` constraint rejects a duplicate |
| View attendance history | `SELECT` from `attendance` JOIN `events` where `student_id = auth.uid()` |
| Teacher creates an event | `INSERT` into `events` |
| Sign up (Phase 2) | Trigger auto-creates a `profiles` row |

This is what Phase 4 will build. For now, just understand the **structure** — the code comes next.

---

## 12. RUNNING THE SQL — YOUR LAB TASK

You will now actually create these tables in **your own** Supabase project.

### Step 1: Open the SQL Editor

1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Click your project
3. Click **SQL Editor** in the left sidebar
4. Click **New query**

### Step 2: Paste the code

1. Open the file **`supabase/schema.sql`** in your project
2. Select ALL of it and copy (Ctrl+A, Ctrl+C)
3. Paste (Ctrl+V) into the SQL Editor window

### Step 3: Run it

- Click **Run** (or press Ctrl+Enter)
- ✅ **Expected:** "Success. No rows returned." (Tables don't return data — they just exist.)

> **Troubleshooting:** If you get an error like `policy ... already exists`, that means you ran it before. The script is now **idempotent** (safe to re-run) — just Run it again.

### Step 4: Verify the tables exist

1. Click **Table Editor** in the left sidebar
2. You should see a **`public`** schema with **three tables**:
   - `attendance`
   - `events`
   - `profiles`
3. **If you don't see them:** refresh the browser page (F5). Sometimes the Table Editor needs a reload to show new tables.

### Step 5: Verify RLS is on

For EACH table (attendance, events, profiles):
1. Click the table name in Table Editor
2. Look at the top-right — the **RLS** toggle should show "RLS enabled"
3. Toggle it ON if it's off (it should already be on from the SQL)

---

## 13. LAB CHECKLIST (Tick these off as you work)

| # | Task | Done? |
|---|---|---|
| 1 | Opened the SQL Editor in Supabase | ☐ |
| 2 | Pasted the full contents of `supabase/schema.sql` | ☐ |
| 3 | Ran the SQL successfully (no errors) | ☐ |
| 4 | `profiles` table appears in Table Editor | ☐ |
| 5 | `events` table appears in Table Editor | ☐ |
| 6 | `attendance` table appears in Table Editor | ☐ |
| 7 | RLS enabled on `profiles` | ☐ |
| 8 | RLS enabled on `events` | ☐ |
| 9 | RLS enabled on `attendance` | ☐ |
| 10 | I understand what a Primary Key is | ☐ |
| 11 | I understand what a Foreign Key is | ☐ |
| 12 | I understand why `unique (student_id, event_id)` prevents double-scanning | ☐ |
| 13 | I understand what RLS does | ☐ |
| 14 | I understand how the trigger auto-creates profiles | ☐ |

---

## 14. CHECK YOUR UNDERSTANDING (Quiz)

Answer these to make sure you've got it before moving on.

1. **What is a Primary Key?** Why does every table have one?
2. **What is a Foreign Key?** Give one example from our schema.
3. Which column in `attendance` prevents a student from scanning the same event twice?
4. What does `auth.uid()` return?
5. If we had NO Row Level Security, what could any app user do?
6. Why do we name the column `end_time` instead of `end`?
7. What does the `on_auth_user_created` trigger do, and WHEN does it run?
8. Explain "1 to many relationship" using `events` and `attendance` as an example.

*(Answers are at the bottom of this document — try them first without peeking!)*

---

## 15. COMMON ERRORS (Real problems you might hit)

### Error: `syntax error at or near "end"`

**Cause:** `end` is a **reserved word** in PostgreSQL. A column can't be named `end`.

**Fix:** We use `end_time` (and `start_time`) in the schema. The QR payload still uses `start`/`end`, but the database stores them as `start_time`/`end_time`.

### Error: `policy "..." for table "..." already exists`

**Cause:** You're running the script a second time and the policy already exists.

**Fix:** The script now has `drop policy if exists` before each policy, so this shouldn't happen. If it does, just re-run — or run the latest `supabase/schema.sql` which is idempotent.

### Error: `permission denied for table`

**Cause:** An RLS policy is blocking access.

**Fix:** Check the policy's `using` / `with check` clauses. Make sure `auth.uid()` is compared to the right column.

### Error: `duplicate key value violates unique constraint`

**Cause:** A UNIQUE constraint (like `(student_id, event_id)`) was violated.

**Fix:** This is expected — the app will catch this and show "Already registered for this event."

---

## 16. WHAT YOU SHOULD HAVE NOW

✅ A `profiles` table (linked to auth.users)
✅ An `events` table
✅ An `attendance` table
✅ RLS enabled on all three
✅ An auto-profile trigger installed
✅ The app still works with SQLite (we haven't changed any code yet — that's Phase 4!)

**You built a real secure cloud database. Give yourself a pat on the back.** 🎉

---

## CHECK YOUR UNDERSTANDING — ANSWERS

1. **Primary Key:** The column that uniquely identifies each row (like a national ID). Every table has one so you can find/connect specific rows.
2. **Foreign Key:** A column that references the Primary Key of another table, connecting them. Example: `attendance.student_id → auth.users.id`.
3. The `unique (student_id, event_id)` constraint.
4. The user ID of the currently logged-in user (or `null` if not logged in).
5. They could read (or modify) everyone's data, since the key is in the app's code.
6. Because `end` is a reserved word in PostgreSQL.
7. It auto-creates a `profiles` row for a new user, and runs AFTER a row is inserted into `auth.users` (on signup).
8. One event can have many attendance rows (1 event → many scans), but each attendance row links to exactly one event.

---

*Phase 3 completed 2026-09-03.*# Phase 3 — Database Design

> This is a **student lab activity**. Work through it step by step. Every section builds on the one before it. By the end you will have created a **real cloud database** that is secure and ready for your app.

---

## HOW TO USE THIS DOCUMENT (Read Me First)

This phase is **hands-on**. You will:
1. **LEARN** — read short explanations (in plain language, with analogies)
2. **DO** — run SQL in your Supabase project
3. **CHECK** — confirm each step worked using the checklists
4. **REVIEW** — answer the "Check Your Understanding" questions at the end

**Time needed:** ~45 minutes
**You will need:** Your Supabase project from Phase 1, and the SQL code in `supabase/schema.sql`

---

## 1. WHAT ARE WE DOING AND WHY?

### The Big Picture

Your app currently stores attendance in a **local file** on your phone (called SQLite). This has 3 big problems:

| Problem | What it means |
|---|---|
| 🗑️ **Data lives on ONE device** | Delete the app → read your attendance history? GONE. |
| 👤 **No real users** | It pretends everyone is `STUDENT-2026-001`. |
| 🔓 **No security** | Anyone using the app could read everyone's data. |

Today, we are going to build a **cloud database** (on Supabase) that fixes all 3 problems.

### The Analogy: A Notebook vs. A Shared Online Document

Think of it this way:

- **SQLite** = a paper notebook you carry in your pocket. Only YOU can see it. Lose the notebook → your notes are gone. Rip out a page → nobody knows.
- **Supabase/PostgreSQL** = a **Google Spreadsheet** shared on the internet. Anyone with an account can see THEIR OWN tab. The owner can add security so strangers can't peek. And it's backed up — you can't lose it.

Today you build the structure of that online spreadsheet — the **tables** (tabs), the **columns** (cells), and the **security rules** (who can see what).

### What You Will Understand By The End

After this phase, you'll be able to answer:
- What is a **table**, a **row**, and a **column**?
- What is a **Primary Key** and why does every table have one?
- What is a **Foreign Key** and how does it connect tables?
- What is a **Unique constraint** and why does it stop duplicate attendance?
- What is **Row Level Security** and why is it essential?
- How does a **trigger** auto-create a profile when someone signs up?

---

## 2. YOUR APP'S DATABASE: BEFORE (SQLite)

Here is the database structure your app uses RIGHT NOW. Don't worry — you don't need to write this. Just READ it and understand the idea.

```sql
-- events table: stores details about each event
CREATE TABLE events (
  eventId TEXT PRIMARY KEY NOT NULL,   -- a unique code for the event
  title   TEXT NOT NULL,               -- the event name
  start   TEXT NOT NULL,               -- start time
  end     TEXT NOT NULL                -- end time
);

-- attendance table: stores one row per student scan
CREATE TABLE attendance (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,  -- auto-incrementing number
  studentId   TEXT NOT NULL,                      -- which student (hardcoded!)
  eventId     TEXT NOT NULL,                      -- which event
  scannedAt   TEXT NOT NULL,                      -- when scanned
  UNIQUE (studentId, eventId)                     -- no duplicate scans
);
```

**Spot the problems:**
- There is **no `profiles` table** — we don't even track real users.
- `studentId` is just a text string like `"STUDENT-2026-001"` — not a real account.
- Anyone running the app gets the SAME `studentId`. That's the whole problem.

> ✅ **STOP AND THINK:** In your own words, why is having one `studentId` for everyone a problem? (Write it down before moving on.)

---

## 3. WHAT WE ARE BUILDING: AFTER (Supabase PostgreSQL)

Here is the NEW structure. We are creating **three** tables instead of two. Each one serves a clear purpose.

### The Three Tables At A Glance

```
┌─────────────────────────────────────────────────────────────┐
│                    SUPABASE CLOUD DATABASE                    │
│                                                               │
│   auth.users  (Supabase's built-in list of user accounts)     │
│        │                                                      │
│        │ 1:1 (one profile per user)                          │
│        ▼                                                      │
│   ┌────────────┐    creates ┌──────────────┐                 │
│   │  profiles  │            │    events    │                 │
│   └────────────┘            └──────┬───────┘                 │
│                                    │ 1:N (one event,         │
│                                    │ many attendance rows)   │
│                                    ▼                         │
│                            ┌──────────────┐                 │
│                            │  attendance  │  ← one student   │
│                            └──────────────┘    scans one event│
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

Hold on to this picture. Now we'll explain each piece **line by line**.

---

## 4. TABLE 1: `profiles` — WHO ARE THE USERS?

### Why do we need it?

Phase 2 gave each student a **login** (email + password). Supabase keeps those logins in a special built-in table called `auth.users`. But we also want to store extra info about each person (like whether they're a student or a teacher, or their display name). So we create our OWN table called `profiles` that sits **alongside** `auth.users`.

### Read the SQL line by line

```sql
create table if not exists public.profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  email      text not null,
  full_name  text,
  role       text not null default 'student' check (role in ('student', 'teacher')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

Let's decode each line:

| Line | Meaning (plain English) |
|---|---|
| `create table if not exists public.profiles` | Make a table named `profiles` in the `public` schema. `if not exists` = don't error if it's already there (safe to re-run). |
| `id uuid primary key` | `id` is the **Primary Key** — a unique ID for each profile. `uuid` = a huge random ID (like a long fingerprint) that can't collide across devices. `primary key` = unique + required + indexed. |
| `references auth.users (id)` | This is a **Foreign Key** — it says "this profile belongs to ONE user from the auth.users table." |
| `on delete cascade` | If the user account is deleted, delete their profile too (keeps things clean). |
| `email text not null` | Store their email. `text` = text data type. `not null` = this field can't be empty. |
| `full_name text` | Optional display name (no `not null`, so it CAN be empty). |
| `role text not null default 'student'`<br>`check (role in ('student','teacher'))` | `role` is `'student'` by default. The `check` is a rule: it can ONLY be `'student'` or `'teacher'` — anything else is rejected. |
| `created_at timestamptz not null default now()` | When this profile was created. `timestamptz` stores date+time WITH timezone info. `default now()` auto-fills it. |
| `updated_at ...` | When it was last changed. (Convention: every table should track when it was created/updated.) |

> 💡 **KEY CONCEPT — Primary Key:** Every table has a Primary Key column that is *unique* for each row. It's like each person's **national ID number** — no two people share the same one, and it's used to find them.
>
> 💡 **KEY CONCEPT — Foreign Key:** A Foreign Key is a column in one table that points to the Primary Key of another table. It's how tables **connect**. Here, `profiles.id` points to `auth.users.id`.

---

## 5. TABLE 2: `events` — WHAT IS THE EVENT?

### Read the SQL line by line

```sql
create table if not exists public.events (
  id          uuid primary key default gen_random_uuid(),
  event_code  text not null unique,
  title       text not null,
  start_time  timestamptz,
  end_time    timestamptz,
  created_by  uuid references auth.users (id) on delete set null,
  created_at  timestamptz not null default now()
);
```

| Line | Meaning (plain English) |
|---|---|
| `id uuid primary key default gen_random_uuid()` | Primary key. `default gen_random_uuid()` means PostgreSQL **generates a random ID automatically** — we don't have to provide one. |
| `event_code text not null unique` | The short code embedded in the QR code. `unique` = no two events can share the same code. |
| `title text not null` | Event name (e.g., "Research Defense"). |
| `start_time timestamptz` | When the event starts. **Note the name change** — we use `start_time` NOT `start`, because `start`/`end` are **reserved words** in PostgreSQL (they have special meaning). |
| `end_time timestamptz` | When the event ends. |
| `created_by uuid references auth.users (id)`<br>`on delete set null` | Who created this event (a teacher's user ID). `on delete set null`: if that teacher's account is deleted, don't delete the event — just blank out `created_by`. |
| `created_at ...` | When the event was created. |

> ⚠️ **CAUTION — Reserved Words:** Words like `start`, `end`, `select`, `from`, `order` are **reserved** in PostgreSQL — they already mean something to the database engine. You cannot use them as column names without special handling. **This caused a real bug earlier** (see Section "Common Errors")! We avoid it by naming them `start_time` / `end_time`.

---

## 6. TABLE 3: `attendance` — WHO SCANNED WHAT?

### Read the SQL line by line

```sql
create table if not exists public.attendance (
  id          uuid primary key default gen_random_uuid(),
  student_id  uuid not null references auth.users (id) on delete cascade,
  event_id    uuid not null references public.events (id) on delete cascade,
  scanned_at  timestamptz not null default now(),
  unique (student_id, event_id)
);
```

| Line | Meaning (plain English) |
|---|---|
| `id uuid primary key default gen_random_uuid()` | Primary key, auto-generated. |
| `student_id uuid not null references auth.users (id)` | **Which student** scanned. A Foreign Key pointing to the auth user. `not null` = every attendance row MUST have a student. |
| `event_id uuid not null references public.events (id)` | **Which event** they scanned. A Foreign Key pointing to `events`. |
| `scanned_at timestamptz not null default now()` | When the scan happened. Auto-filled with the current time. |
| `unique (student_id, event_id)` | **This is the anti-cheat rule!** A student can only appear ONCE per event. If they scan twice, the SECOND attempt is rejected. |

> 💡 **KEY CONCEPT — Unique Constraint:** `unique (student_id, event_id)` means "the combination of `(student_id, event_id)` must be unique across all rows." This is exactly what stops a student from registering for the same event twice. Remember this — the app will use it to show "Already registered for this event."

---

## 7. HOW THE TABLES CONNECT (Relationships)

Now let's connect the dots. This is called **database relationships**.

```
auth.users ──── 1:1  ──── profiles
     │                 (each user = one profile)
     │ uses
     ▼
events ──── 1:N ──── attendance
(one event)   (many scans)
     ▲
     └── created_by points to a user
```

| Relationship | Type | Meaning |
|---|---|---|
| `profiles.id → auth.users.id` | **1 to 1** | One user has exactly ONE profile. |
| `events.created_by → auth.users.id` | **Many to 1** | A teacher (one user) creates MANY events. |
| `attendance.student_id → auth.users.id` | **Many to 1** | A student has MANY attendance records. |
| `attendance.event_id → events.id` | **Many to 1** | An event has MANY attendance records. |

**Reading a relationship:** "A **student** scans an **event**. That scan is stored in `attendance` as one row linking `student_id` (the who) and `event_id` (the what)."

> ✅ **STOP AND THINK:** If a student wants to see their attendance history, which tables do we need to combine (JOIN)? Write down your guess before Section 11.

---

## 8. ROW LEVEL SECURITY (RLS) — THE SECURITY GUARD

### The danger without it

Remember the `anon` (publishable) API key is used by the app — and it's in your app's code. If someone extracts that key, they could query your database. **Without RLS, they could read EVERY student's attendance.** That's a privacy disaster.

### What RLS does

**Row Level Security** is like a **security guard at the door of every row**. Even if someone has the key, the guard decides: "Can YOU see THIS row?" It checks the rules you define using `auth.uid()`.

### What is `auth.uid()`?

`auth.uid()` returns the user ID of whoever is **currently logged in**. If nobody is logged in, it returns `null`.

So a rule like this means: **"You can only see attendance rows where YOU are the student."**

```sql
-- You can only READ attendance where student_id equals YOUR user id
create policy "Students can view their own attendance"
  on public.attendance for select
  using (auth.uid() = student_id);
```

### Reading a policy line by line

```sql
create policy "Students can view their own attendance"   -- name of the rule
  on public.attendance for select                        -- applies to SELECT (reading)
  using (auth.uid() = student_id);                        -- the rule: only if you are the student
```

| Keyword | Meaning |
|---|---|
| `create policy "name"` | Create a named security rule. |
| `on public.attendance` | Which table the rule protects. |
| `for select` | The action the rule controls. (`select` = read, `insert` = add, `update` = change, `delete` = remove) |
| `using (...)` | The condition that must be TRUE for the row to be visible. |
| `with check (...)` | The condition that must be TRUE to ADD/change a row. |

### The policies we wrote (and why)

| Policy | Action | Rule |
|---|---|---|
| "Profiles are viewable by owner" | select | you see your own profile only |
| "Users can insert their own profile" | insert | you can create your own profile |
| "Users can update their own profile" | update | you can edit your own profile |
| "Teachers can view profiles of their attendees" | select | a teacher can read the profile (name) of students who attended their events — added later in the "attendee names" enhancement (see the Phase 6/10 material) |
| "Events are readable by any authenticated user" | select | any logged-in user can read events (needed to validate QR codes) |
| "Users can insert events" | insert | any logged-in user can create an event |
| "Users can update their own events" | update | you can edit events you created |
| "Students can view their own attendance" | select | you see your own attendance only |
| "Students can insert their own attendance" | insert | you can add your own attendance |
| "Teachers can view attendance for their events" | select | teachers see attendance for events they created |

> 💡 **KEY CONCEPT — Row Level Security (RLS):** RLS is **not optional** in a multi-user app. It's the difference between "anyone with the key can read everything" and "each user can only see their own data." Later phases will rely on it heavily.

---

## 9. THE TRIGGER — AUTOMATIC PROFILES

When a new user signs up in Phase 2, we want their `profiles` row to be **created automatically**. We don't want a student to have to do it manually. PostgreSQL has a feature for this: a **trigger**.

A trigger is: **"When THIS happens to THIS table, automatically run THIS function."**

```sql
create or replace function public.handle_new_user()
returns trigger language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
```

| Piece | Meaning |
|---|---|
| `create or replace function handle_new_user()` | Define a function named `handle_new_user`. |
| `returns trigger language plpgsql` | It's a trigger function, written in plpgsql (PostgreSQL's SQL language). |
| `begin ... insert into profiles (id, email) values (new.id, new.email) ... end` | The function inserts a new profile using the new user's id and email. `new.id` / `new.email` = the values of the row that just got inserted into `auth.users`. |
| `create trigger on_auth_user_created` | Name the trigger. |
| `after insert on auth.users` | Run it AFTER a new row is inserted into `auth.users` (after a signup). |
| `for each row execute procedure handle_new_user()` | Run the function for every new row. |

**The flow:**
1. User signs up in the app (Phase 2) → Supabase adds a row to `auth.users`
2. Trigger fires automatically
3. A matching `profiles` row is created with that user's id and email
4. Done — no manual work needed

> ✅ **STOP AND THINK:** What would happen if a user signed up but the trigger didn't exist? (Hint: think about what happens when the app tries to read the profile of a user who has none.)

---

## 10. SQLITE vs POSTGRESQL — SIDE BY SIDE

| Feature | SQLite (old) | Supabase PostgreSQL (new) |
|---|---|---|
| Where it lives | Local file on your device | In the cloud (Supabase) |
| Users | Hardcoded `STUDENT-2026-001` | Real accounts in `auth.users` |
| Security | None — anyone can read/write | RLS policies per user |
| IDs | `INTEGER` auto-increment | `uuid` (globally unique) |
| Timestamps | `TEXT` strings | `timestamptz` (timezone-aware) |
| Foreign keys | Not enforced | Enforced by the database |
| Sharing | Impossible | Data available across devices |
| Backups | None | Automatic (cloud) |

**The big win:** Data is now **shared, secure, and backed up**.

---

## 11. HOW THE APP WILL USE THIS (Preview of Phase 4+)

Soon, your app's code will map to the tables like this:

| App action (in code) | Database action |
|---|---|
| Student scans a QR code | Validate `event` → find/create `events` row → insert `attendance` row |
| Check "Already registered?" | The `unique (student_id, event_id)` constraint rejects a duplicate |
| View attendance history | `SELECT` from `attendance` JOIN `events` where `student_id = auth.uid()` |
| Teacher creates an event | `INSERT` into `events` |
| Sign up (Phase 2) | Trigger auto-creates a `profiles` row |

This is what Phase 4 will build. For now, just understand the **structure** — the code comes next.

---

## 12. RUNNING THE SQL — YOUR LAB TASK

You will now actually create these tables in **your own** Supabase project.

### Step 1: Open the SQL Editor

1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Click your project
3. Click **SQL Editor** in the left sidebar
4. Click **New query**

### Step 2: Paste the code

1. Open the file **`supabase/schema.sql`** in your project
2. Select ALL of it and copy (Ctrl+A, Ctrl+C)
3. Paste (Ctrl+V) into the SQL Editor window

### Step 3: Run it

- Click **Run** (or press Ctrl+Enter)
- ✅ **Expected:** "Success. No rows returned." (Tables don't return data — they just exist.)

> **Troubleshooting:** If you get an error like `policy ... already exists`, that means you ran it before. The script is now **idempotent** (safe to re-run) — just Run it again.

### Step 4: Verify the tables exist

1. Click **Table Editor** in the left sidebar
2. You should see a **`public`** schema with **three tables**:
   - `attendance`
   - `events`
   - `profiles`
3. **If you don't see them:** refresh the browser page (F5). Sometimes the Table Editor needs a reload to show new tables.

### Step 5: Verify RLS is on

For EACH table (attendance, events, profiles):
1. Click the table name in Table Editor
2. Look at the top-right — the **RLS** toggle should show "RLS enabled"
3. Toggle it ON if it's off (it should already be on from the SQL)

---

## 13. LAB CHECKLIST (Tick these off as you work)

| # | Task | Done? |
|---|---|---|
| 1 | Opened the SQL Editor in Supabase | ☐ |
| 2 | Pasted the full contents of `supabase/schema.sql` | ☐ |
| 3 | Ran the SQL successfully (no errors) | ☐ |
| 4 | `profiles` table appears in Table Editor | ☐ |
| 5 | `events` table appears in Table Editor | ☐ |
| 6 | `attendance` table appears in Table Editor | ☐ |
| 7 | RLS enabled on `profiles` | ☐ |
| 8 | RLS enabled on `events` | ☐ |
| 9 | RLS enabled on `attendance` | ☐ |
| 10 | I understand what a Primary Key is | ☐ |
| 11 | I understand what a Foreign Key is | ☐ |
| 12 | I understand why `unique (student_id, event_id)` prevents double-scanning | ☐ |
| 13 | I understand what RLS does | ☐ |
| 14 | I understand how the trigger auto-creates profiles | ☐ |

---

## 14. CHECK YOUR UNDERSTANDING (Quiz)

Answer these to make sure you've got it before moving on.

1. **What is a Primary Key?** Why does every table have one?
2. **What is a Foreign Key?** Give one example from our schema.
3. Which column in `attendance` prevents a student from scanning the same event twice?
4. What does `auth.uid()` return?
5. If we had NO Row Level Security, what could any app user do?
6. Why do we name the column `end_time` instead of `end`?
7. What does the `on_auth_user_created` trigger do, and WHEN does it run?
8. Explain "1 to many relationship" using `events` and `attendance` as an example.

*(Answers are at the bottom of this document — try them first without peeking!)*

---

## 15. COMMON ERRORS (Real problems you might hit)

### Error: `syntax error at or near "end"`

**Cause:** `end` is a **reserved word** in PostgreSQL. A column can't be named `end`.

**Fix:** We use `end_time` (and `start_time`) in the schema. The QR payload still uses `start`/`end`, but the database stores them as `start_time`/`end_time`.

### Error: `policy "..." for table "..." already exists`

**Cause:** You're running the script a second time and the policy already exists.

**Fix:** The script now has `drop policy if exists` before each policy, so this shouldn't happen. If it does, just re-run — or run the latest `supabase/schema.sql` which is idempotent.

### Error: `permission denied for table`

**Cause:** An RLS policy is blocking access.

**Fix:** Check the policy's `using` / `with check` clauses. Make sure `auth.uid()` is compared to the right column.

### Error: `duplicate key value violates unique constraint`

**Cause:** A UNIQUE constraint (like `(student_id, event_id)`) was violated.

**Fix:** This is expected — the app will catch this and show "Already registered for this event."

---

## 16. WHAT YOU SHOULD HAVE NOW

✅ A `profiles` table (linked to auth.users)
✅ An `events` table
✅ An `attendance` table
✅ RLS enabled on all three
✅ An auto-profile trigger installed
✅ The app still works with SQLite (we haven't changed any code yet — that's Phase 4!)

**You built a real secure cloud database. Give yourself a pat on the back.** 🎉

---

## CHECK YOUR UNDERSTANDING — ANSWERS

1. **Primary Key:** The column that uniquely identifies each row (like a national ID). Every table has one so you can find/connect specific rows.
2. **Foreign Key:** A column that references the Primary Key of another table, connecting them. Example: `attendance.student_id → auth.users.id`.
3. The `unique (student_id, event_id)` constraint.
4. The user ID of the currently logged-in user (or `null` if not logged in).
5. They could read (or modify) everyone's data, since the key is in the app's code.
6. Because `end` is a reserved word in PostgreSQL.
7. It auto-creates a `profiles` row for a new user, and runs AFTER a row is inserted into `auth.users` (on signup).
8. One event can have many attendance rows (1 event → many scans), but each attendance row links to exactly one event.

---

*Phase 3 completed 2026-09-03.*
---

### Step 1: Update Supabase Client

Open `lib/supabase.ts` and replace ALL content with:

```typescript
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
```

Save the file.

---

### Step 2: Create Authentication Service

Create a new file: `lib/auth.ts`

Paste the following content exactly:

```typescript
import { useState, useEffect } from 'react';
import { supabase } from './supabase';
import type { Session, User } from '@supabase/supabase-js';

type AuthState = {
  session: Session | null;
  user: User | null;
  loading: boolean;
};

let globalSession: Session | null = null;
let globalUser: User | null = null;
let globalLoading = false;
let listeners: Set<() => void> = new Set();

function notify() {
  listeners.forEach((l) => l());
}

export function setAuth(session: Session | null) {
  globalSession = session;
  globalUser = session?.user ?? null;
  globalLoading = false;
  notify();
}

export function useAuth(): AuthState {
  const [, forceRender] = useState(0);

  useEffect(() => {
    const listener = () => forceRender((n) => n + 1);
    listeners.add(listener);
    return () => { listeners.delete(listener); };
  }, []);

  return {
    session: globalSession,
    user: globalUser,
    loading: globalLoading,
  };
}

export async function signUp(email: string, password: string) {
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (!error && data.session) {
    setAuth(data.session);
  }
  return { data, error };
}

export async function signIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (!error && data.session) {
    setAuth(data.session);
  }
  return { data, error };
}

export async function signOut() {
  setAuth(null);
  supabase.auth.signOut().catch(() => {});
  return { error: null };
}
```

Save the file.

---

### Step 3: Create Login Screen

Create a new file: `app/login.tsx`

Paste the following content exactly:

```tsx
import { useState } from 'react';
import {
  StyleSheet,
  Text,
  TextInput,
  View,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
  TouchableWithoutFeedback,
  Keyboard,
} from 'react-native';
import { Link, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import AppButton from '@/components/AppButton';
import Header from '@/components/Header';
import { COLORS } from '@/constants/colors';
import { signIn } from '@/lib/auth';

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    setError(null);
    setLoading(true);

    try {
      const { data, error: authError } = await signIn(email.trim(), password);

      if (authError) {
        setError(authError.message);
      } else {
        router.replace('/(tabs)');
      }
    } catch (err: any) {
      setError(err?.message || 'Unexpected error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.headerContainer}>
              <Header title="QR Attendance" />
            </View>

            <Text style={styles.title}>Welcome Back</Text>
            <Text style={styles.subtitle}>Sign in to record your attendance</Text>

            <View style={styles.form}>
              <Text style={styles.label}>Email</Text>
              <TextInput
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                placeholder="your.email@school.edu"
                placeholderTextColor={COLORS.textSecondary}
                autoCapitalize="none"
                keyboardType="email-address"
                editable={!loading}
              />

              <Text style={styles.label}>Password</Text>
              <TextInput
                style={styles.input}
                value={password}
                onChangeText={setPassword}
                placeholder="Enter your password"
                placeholderTextColor={COLORS.textSecondary}
                secureTextEntry
                editable={!loading}
              />

              {error && <Text style={styles.error}>{error}</Text>}

              {loading ? (
                <ActivityIndicator size="large" color={COLORS.primary} style={styles.loader} />
              ) : (
                <AppButton
                  theme="primary"
                  title="Sign In"
                  icon="log-in-outline"
                  onPress={handleLogin}
                />
              )}
            </View>

            <Link href="/register" style={styles.link}>
              Don't have an account? Sign Up
            </Link>
          </ScrollView>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
  headerContainer: {
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: COLORS.textPrimary,
    textAlign: 'center',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginBottom: 32,
  },
  form: {
    marginBottom: 24,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textPrimary,
    marginBottom: 6,
    marginTop: 10,
  },
  input: {
    backgroundColor: COLORS.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: COLORS.textPrimary,
  },
  error: {
    fontSize: 14,
    color: '#C62828',
    textAlign: 'center',
    marginTop: 12,
    marginBottom: 4,
  },
  loader: {
    marginVertical: 16,
  },
  link: {
    fontSize: 14,
    color: COLORS.primary,
    textAlign: 'center',
    fontWeight: '600',
  },
});
```

Save the file.

---

### Step 4: Create Registration Screen

Create a new file: `app/register.tsx`

Paste the following content exactly:

```tsx
import { useState } from 'react';
import {
  StyleSheet,
  Text,
  TextInput,
  View,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
  TouchableWithoutFeedback,
  Keyboard,
} from 'react-native';
import { Link } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import AppButton from '@/components/AppButton';
import Header from '@/components/Header';
import { COLORS } from '@/constants/colors';
import { signUp } from '@/lib/auth';

export default function RegisterScreen() {
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleRegister = async () => {
    setError(null);

    if (!email.trim() || !password || !confirmPassword) {
      setError('All fields are required.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    setLoading(true);

    try {
      const { error: authError } = await signUp(email.trim(), password);

      if (authError) {
        setError(authError.message);
      } else {
        setSuccess(true);
      }
    } catch (err) {
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.headerContainer}>
              <Header title="QR Attendance" />
            </View>

            <Text style={styles.title}>Create Account</Text>
            <Text style={styles.subtitle}>Register to start recording attendance</Text>

            {success ? (
              <View style={styles.successContainer}>
                <Text style={styles.successTitle}>Check your email!</Text>
                <Text style={styles.successText}>
                  We sent a confirmation link to {email}. Click the link to verify your
                  account, then come back and sign in.
                </Text>
                <Link href="/login" style={styles.link}>
                  Back to Sign In
                </Link>
              </View>
            ) : (
              <View style={styles.form}>
                <Text style={styles.label}>Email</Text>
                <TextInput
                  style={styles.input}
                  value={email}
                  onChangeText={setEmail}
                  placeholder="your.email@school.edu"
                  placeholderTextColor={COLORS.textSecondary}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  editable={!loading}
                />

                <Text style={styles.label}>Password</Text>
                <TextInput
                  style={styles.input}
                  value={password}
                  onChangeText={setPassword}
                  placeholder="At least 6 characters"
                  placeholderTextColor={COLORS.textSecondary}
                  secureTextEntry
                  editable={!loading}
                />

                <Text style={styles.label}>Confirm Password</Text>
                <TextInput
                  style={styles.input}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  placeholder="Re-enter your password"
                  placeholderTextColor={COLORS.textSecondary}
                  secureTextEntry
                  editable={!loading}
                />

                {error && <Text style={styles.error}>{error}</Text>}

                {loading ? (
                  <ActivityIndicator size="large" color={COLORS.primary} style={styles.loader} />
                ) : (
                  <AppButton
                    theme="primary"
                    title="Sign Up"
                    icon="person-add-outline"
                    onPress={handleRegister}
                  />
                )}
              </View>
            )}

            {!success && (
              <Link href="/login" style={styles.link}>
                Already have an account? Sign In
              </Link>
            )}
          </ScrollView>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
  headerContainer: {
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: COLORS.textPrimary,
    textAlign: 'center',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginBottom: 32,
  },
  form: {
    marginBottom: 24,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textPrimary,
    marginBottom: 6,
    marginTop: 10,
  },
  input: {
    backgroundColor: COLORS.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: COLORS.textPrimary,
  },
  error: {
    fontSize: 14,
    color: '#C62828',
    textAlign: 'center',
    marginTop: 12,
    marginBottom: 4,
  },
  loader: {
    marginVertical: 16,
  },
  link: {
    fontSize: 14,
    color: COLORS.primary,
    textAlign: 'center',
    fontWeight: '600',
  },
  successContainer: {
    alignItems: 'center',
    marginBottom: 24,
    padding: 20,
    backgroundColor: COLORS.card,
    borderRadius: 14,
  },
  successTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: 8,
  },
  successText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 16,
  },
});
```

Save the file.

---

### Step 5: Update Root Layout

Open `app/_layout.tsx` and replace ALL content with:

```tsx
import { Stack } from 'expo-router';

import { COLORS } from '@/constants/colors';

export default function RootLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="login" />
      <Stack.Screen name="register" />
      <Stack.Screen name="(tabs)" />
    </Stack>
  );
}
```

Save the file.

---

### Step 6: Update Profile Screen

Open `app/(tabs)/profile.tsx` and replace ALL content with:

```tsx
import { useState } from 'react';
import { StyleSheet, Text, View, Alert } from 'react-native';
import { useRouter } from 'expo-router';

import AppButton from '@/components/AppButton';
import { COLORS } from '@/constants/colors';
import { useAuth, signOut } from '@/lib/auth';

export default function ProfileScreen() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSignOut = async () => {
    setLoading(true);
    try {
      await signOut();
      router.replace('/login');
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to sign out.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>My Profile</Text>

      {user && (
        <View style={styles.infoCard}>
          <Text style={styles.label}>Email</Text>
          <Text style={styles.value}>{user.email}</Text>

          <Text style={styles.label}>User ID</Text>
          <Text style={styles.valueSmall}>{user.id}</Text>
        </View>
      )}

      <AppButton
        title="Sign Out"
        icon="log-out-outline"
        onPress={handleSignOut}
        disabled={loading}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    paddingHorizontal: 24,
    paddingTop: 24,
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    color: COLORS.textPrimary,
    marginBottom: 16,
  },
  infoCard: {
    backgroundColor: COLORS.card,
    borderRadius: 14,
    padding: 16,
    marginBottom: 24,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textSecondary,
    marginBottom: 4,
    marginTop: 8,
  },
  value: {
    fontSize: 15,
    color: COLORS.textPrimary,
    fontWeight: '500',
  },
  valueSmall: {
    fontSize: 11,
    color: COLORS.textSecondary,
  },
});
```

Save the file.

---

### Step 7: Update Scan Screen

Open `app/(tabs)/scan.tsx` and make these changes:

**Replace the import:**
```diff
- import { STUDENT_ID } from '@/constants/student';
+ import { useAuth } from '@/lib/auth';
```

**Inside the component, add:**
```diff
  export default function ScanScreen() {
+   const { user } = useAuth();
```

**In the handleBarcodeScanned function:**
```diff
-   registerAttendance(data, STUDENT_ID).then((result) => {
+   const studentId = user?.id ?? 'unknown';
+   registerAttendance(data, studentId).then((result) => {
```

Save the file.

---

### Step 8: Update History Screen

Open `app/(tabs)/history.tsx` and make these changes:

**Replace the import:**
```diff
- import { STUDENT_ID } from '@/constants/student';
+ import { useAuth } from '@/lib/auth';
```

**Inside the component, add:**
```diff
  export default function HistoryScreen() {
+   const { user } = useAuth();
```

**In the loadHistory function:**
```diff
-   getAttendanceHistory(STUDENT_ID).then((rows) => {
+   const studentId = user?.id ?? 'unknown';
+   getAttendanceHistory(studentId).then((rows) => {
```

Save the file.docs/migration-log.md

---

### Step 9: Verify TypeScript

Run:
```bash
npx tsc --noEmit
```

Expected: No output (no errors).

---

### Step 10: Test the App

Run:
```bash
npx expo start -c
```

**Test Checklist:**

| # | Test | Expected Result |
|---|---|---|
| 1 | App starts | Shows login screen (not tabs) |
| 2 | Tap "Sign Up" | Navigates to registration screen |
| 3 | Fill form, tap "Sign Up" | Account created in Supabase |
| 4 | Go back to login | Enter email + password, tap "Sign In" |
| 5 | Login success | Shows Scan tab |
| 6 | Go to Profile tab | Shows user email and ID |
| 7 | Tap "Sign Out" | Redirects to login screen |
| 8 | Login with wrong credentials | Shows error message |
| 9 | Go to Scan tab | Camera opens (no errors) |
| 10 | Go to History tab | Shows records or empty state (no errors) |

---

### Step 11: Summary Checklist

| # | Check | Status |
|---|---|---|
| 1 | `lib/supabase.ts` updated | Uses plain config (no custom storage) |
| 2 | `lib/auth.ts` created | Global state + pub/sub pattern |
| 3 | `app/login.tsx` created | Login with router.replace navigation |
| 4 | `app/register.tsx` created | Registration form |
| 5 | `app/_layout.tsx` updated | Simple Stack, all screens registered |
| 6 | `app/(tabs)/profile.tsx` updated | Sign Out with router.replace |
| 7 | `app/(tabs)/scan.tsx` updated | Uses `user.id` |
| 8 | `app/(tabs)/history.tsx` updated | Uses `user.id` |
| 9 | TypeScript compiles | `npx tsc --noEmit` shows no errors |
| 10 | Login works | Tabs appear after login |
| 11 | Sign Out works | Login screen appears after sign out |

---

## 13. KNOWN LIMITATIONS

1. **No session restore on refresh** — Users must log in again after refreshing the app. Session restore will be added in a future phase once the `getSession()` hang issue is resolved.

2. **signOut is fire-and-forget** — The Supabase server is notified asynchronously. If the device is offline, the session may persist on the server but will be cleared locally.

3. **No token refresh** — Since we don't use `onAuthStateChange`, token refresh events are not handled. Short-lived sessions may expire without the user being notified.

---

## 14. DOCUMENTATION

After completing this phase:
- Created `docs/02-authentication.md` (this document)
- Updated `docs/migration-log.md` with Phase 2 entry

---

*This phase was completed on 2026-09-03.*
*Authentication is functional: users can register, log in, and log out.*
*The hardcoded STUDENT_ID is no longer used in scan.tsx and history.tsx.*
