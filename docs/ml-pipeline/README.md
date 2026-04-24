# ML Pipeline

This document describes the Python-side workflow used by the antenna configuration project.

## Files

The current assets live in `attached_assets`:

- `generate_dataset_*.py` - Generates synthetic training data.
- `split_dataset_*.py` - Splits the dataset into train and test sets.
- `train_model_*.py` - Trains the antenna configuration classifier.
- `test_model_*.py` - Evaluates the trained model.
- `antenna_config_model_*.pth` - Exported model weights.

## Workflow

1. Generate a synthetic dataset from antenna configuration parameters.
2. Split the dataset into training and evaluation subsets.
3. Train the model.
4. Evaluate the model against reference metrics.
5. Use the exported model weights from the backend inference route.

## Current Cleanup Target

The repository still contains timestamped duplicate versions of the training and test scripts. The goal of the refactor is to keep one canonical script per step and document the retained files clearly.