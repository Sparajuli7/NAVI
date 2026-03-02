# Deploying NAVI to Vercel

Use this guide when connecting this repo to Vercel (e.g. after deleting the old project and re-importing).

## 1. Import the repository

- In [Vercel](https://vercel.com), click **Add New… → Project**.
- Import your Git repository (e.g. `Sparajuli7/NAVI`).
- **Do not** deploy yet — configure the following first.

## 2. Set the Root Directory (required)

The app lives in a subfolder, not the repo root.

- In **Configure Project**, find **Root Directory**.
- Click **Edit** and set it to:
  ```
  AI Language Companion App
  ```
- Leave **Framework Preset** as **Vite** (auto-detected) or set it to **Vite** if needed.

## 3. Build & output (optional override)

The app already has a `vercel.json` in `AI Language Companion App/` that sets:

- **Build Command:** `pnpm run build`
- **Output Directory:** `dist`
- **Rewrites:** SPA (all routes → `index.html`)

You can leave these as **Override: off** so Vercel uses the repo config, or set them manually:

| Setting            | Value              |
|--------------------|--------------------|
| Build Command      | `pnpm run build`   |
| Output Directory   | `dist`             |
| Install Command    | `pnpm install`     |

## 4. Deploy

- Click **Deploy**.
- Wait for the build to finish. The first build may take a few minutes.
- Your production URL will serve the NAVI app (home, chat, onboarding).

## Troubleshooting

- **404 on the root URL:** Ensure **Root Directory** is exactly `AI Language Companion App` (no trailing slash).
- **Build fails:** Check the build logs. Common fixes: Root Directory set correctly, and **Install Command** = `pnpm install` if you use pnpm.
- **Blank page or wrong app:** Confirm **Output Directory** is `dist` and that the deployment used the correct Root Directory.
