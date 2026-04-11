# Antenna Array Optimizer

## Overview

A full-stack SaaS dashboard for RF engineers to simulate, analyze, and compare circular antenna array radiation patterns using AI-predicted configurations. The backend performs real antenna physics simulations (array factor computation) and stores prediction history. The frontend provides interactive ring configuration tools, polar radiation pattern charts, and performance metrics (HPBW, main lobe gain, side lobe level).

## ML Pipeline (End-to-End)

1. **Simulate Pattern** — user sets ring config (R1-R5 elements) + steering angle → radiation pattern computed by physics engine → polar chart shown
2. **Analyze in Compare** button — captures the polar chart SVG as a PNG → saves config, metrics, pattern, and image blob in a global React context (`SimulationStore`)
3. **Compare Configurations** — auto-loads from the store, automatically:
   - Posts the saved image to `POST /api/predict-from-image`
   - Backend spawns `python3 artifacts/api-server/src/lib/infer.py` with the image + model path
   - MobileNetV2 CNN loads `attached_assets/antenna_config_model_35_1775864227285.pth`, runs inference, returns `{ring1..ring5}` JSON
   - Frontend auto-runs comparison between reference (simulated) and predicted (model output)
   - Shows overlay polar chart + accuracy metrics (global error, HPBW Δ, gain Δ, SLL Δ)

**Color coding**: Reference = #38bdf8 (sky blue), Predicted = #a78bfa (violet)

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)
- **Frontend**: React + Vite, Tailwind CSS, shadcn/ui, Recharts, Framer Motion, wouter

## Architecture

### Frontend (`artifacts/antenna-ui`)
- Dark navy + cyan/electric blue theme — scientific instrument aesthetic
- Pages: Dashboard, Simulate Pattern, Compare Configurations, History & Analysis, History Detail
- Real-time antenna physics via API — no local computation

### Backend (`artifacts/api-server`)
- Physics engine in `src/lib/antenna-physics.ts`:
  - Array factor (AF) computation for circular antenna arrays
  - Radiation pattern in dB with normalization
  - HPBW, main lobe gain, and side lobe level metrics
  - Error computation between reference and predicted configs
- Routes: `/api/simulate`, `/api/simulate/compare`, `/api/predictions`, `/api/history`

### Database (`lib/db`)
- `predictions` table: stores reference/predicted configs (JSONB), metrics, steering angle, and global error

### API Contract (`lib/api-spec/openapi.yaml`)
- Key endpoints:
  - `POST /simulate` — single config simulation
  - `POST /simulate/compare` — compare two configs
  - `GET /predictions` — list all
  - `GET /predictions/stats` — aggregated stats
  - `GET /history` — recent predictions

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

## Antenna Physics

The simulation uses the following physical parameters:
- Carrier frequency: 2.45 GHz
- Speed of light: 3×10⁸ m/s
- 5 concentric rings, base radii from 0.2λ to 2.2λ
- Elements per ring: 2–8
- Radiation pattern computed in azimuth plane (360°, 1° resolution)
- Normalization: 20 log10(AF / max(AF))

## Dataset Context (from Python files)

The original Python project:
1. `generate_dataset.py` — generates synthetic antenna pattern images + configs
2. `split_dataset.py` — splits into train/test sets
3. `train_model.py` — trains a MobileNetV2-based CNN to predict antenna configs from polar pattern images
4. `test_model.py` — evaluates predictions using HPBW, gain, and SSL metrics

The frontend is designed to complement this pipeline by providing interactive simulation and comparison tools.
