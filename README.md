# Antenna Array Optimizer

A full-stack monorepo for simulating circular antenna arrays, comparing radiation patterns, and running ML-based inference on captured pattern images.

## What It Does

- Simulates antenna radiation patterns with a physics-based backend.
- Compares reference and predicted antenna configurations.
- Stores prediction history for later review.
- Uses a Python inference step to predict ring configurations from pattern images.

## Tech Stack

- TypeScript
- Node.js + Express 5
- React + Vite
- PostgreSQL + Drizzle ORM
- Zod
- Python for ML inference

## Project Structure

- `backend/api-server` - Express API server and simulation/inference routes.
- `frontend/antenna-ui` - Main production UI.
- `frontend/mockup-sandbox` - Separate prototyping UI.
- `shared/api-spec` - OpenAPI contract used for code generation.
- `shared/api-client-react` - Generated React API client.
- `shared/api-zod` - Generated Zod schemas.
- `shared/db` - Shared database schema and helpers.
- `attached_assets` - Model file and ML scripts currently used by the inference workflow.
- `docs/ml-pipeline` - Documentation for the dataset, training, and evaluation pipeline.

## Local Setup

1. Install dependencies with pnpm.
2. Copy `.env.example` to `.env` and adjust `PORT`, `DATABASE_URL`, `LOG_LEVEL`, and `BASE_PATH` as needed.
3. Start the backend and frontend package workflows from their respective package directories.

## Useful Commands

At the repository root:

- `pnpm run typecheck` - Type-check the workspace.
- `pnpm run build` - Type-check and build the workspace packages (does not start servers).
- `pnpm run dev` - Start backend + frontend in parallel (development mode).
- `pnpm run start` - Start backend + frontend from built output/preview mode.

To see the app in browser after startup:

- Frontend: `http://localhost:4173`
- Backend API: `http://localhost:8080/api/healthz`

## Troubleshooting

- If you see `EADDRINUSE: address already in use :::8080`, another process is already using the backend port.
- Do not run `pnpm run dev` and `pnpm run start` at the same time.
- On Windows, find the process using 8080:
	`Get-NetTCPConnection -LocalPort 8080 -State Listen | Select-Object LocalAddress,LocalPort,OwningProcess`
- Then stop it:
	`Stop-Process -Id <PID> -Force`

Backend:

- `pnpm --filter @workspace/api-server run dev`
- `pnpm --filter @workspace/api-server run build`
- `pnpm --filter @workspace/api-server run typecheck`

Frontend:

- `pnpm --filter @workspace/antenna-ui run dev`
- `pnpm --filter @workspace/antenna-ui run build`
- `pnpm --filter @workspace/antenna-ui run typecheck`

Shared packages:

- `pnpm --filter @workspace/api-spec run codegen`
- `pnpm --filter @workspace/db run push`

## ML Pipeline

The current pipeline uses the following files in `attached_assets`:

- `generate_dataset_*.py` - Synthetic dataset generation.
- `split_dataset_*.py` - Train/test split helper.
- `train_model_*.py` - MobileNetV2 training script.
- `test_model_*.py` - Evaluation script.
- `antenna_config_model_*.pth` - Trained model artifact.

The long-term goal is to keep one canonical version of each of these assets and move the workflow documentation into `docs/ml-pipeline`.

## Notes

- The main UI is `frontend/antenna-ui`.
- `frontend/mockup-sandbox` is kept as a separate design/prototype workspace for now.
- The repo is configured for pnpm workspaces.