# AI QA App — Frontend

React + Vite web client for the AI-driven QA product. It's the UI for creating
projects, uploading product docs, managing login profiles, discovering routes, and
authoring/running natural-language test **flows** against the
[backend](../AI-QA) and [PinchTab Server](../Pinchtab%20Server).

## Stack

- **React 19** + **Vite** (HMR dev server on `:5173`)
- **React Router 7** for routing
- **Supabase JS** for auth (the same Supabase project the backend uses)

## Structure

```
src/
  main.jsx              # app entry + router
  context/AuthContext.jsx        # Supabase session/user context
  components/ProtectedRoute.jsx  # gates authenticated routes
  lib/supabase.js       # Supabase client (anon key)
  pages/
    Landing.jsx         # marketing / entry
    Signup.jsx, Login.jsx   # Supabase email auth
    Dashboard.jsx       # the user's projects
    CreateProject.jsx   # new project + doc upload
    ProjectDetail.jsx   # a project: routes, login profiles, and the Flows panel
                        #   (compose a flow, run it, saved flows + run history)
```

Auth is handled client-side by Supabase; the resulting JWT is sent as
`Authorization: Bearer <token>` on every backend call, and Postgres RLS scopes all
data to the signed-in user.

## Setup

```bash
npm install
cp .env.example .env    # then fill in the values below
```

| Var | Description |
|-----|-------------|
| `VITE_SUPABASE_URL` | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase anon/public key (never the service_role key) |
| `VITE_API_URL` | Backend QA API base, e.g. `http://localhost:4000` |

## Run

```bash
npm run dev       # Vite dev server (http://localhost:5173)
npm run build     # production build
npm run preview   # preview the build
npm run lint      # eslint
```

The backend (`AI-QA`, default `:4000`) must be running for project/flow features;
running a flow additionally needs the **PinchTab Server** gateway up.
