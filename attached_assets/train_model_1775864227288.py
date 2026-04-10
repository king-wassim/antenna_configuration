import os
import numpy as np
import torch
import torch.nn as nn
import torch.optim as optim
from torch.utils.data import Dataset, DataLoader
import torchvision.models as models
import torch.nn.functional as F
import matplotlib.pyplot as plt

# === Affichage visuel de démarcation ===
def clear_console():
    print("\n" + "="*80 + "\n" + " "*30 + "NOUVELLE EXÉCUTION\n" + "="*80 + "\n")

clear_console()

# === Base directory of this script ===
script_dir = os.path.dirname(os.path.abspath(__file__))
print("script_dir =", script_dir)

# -----------------------
# Utilities for encoding / decoding targets
# -----------------------
RING_COUNT = 5
VALUE_MIN = 2
VALUE_MAX = 8
VALUES = list(range(VALUE_MIN, VALUE_MAX + 1))  # [2..8]
VALUES_PER_RING = len(VALUES)  # 7
OUTPUT_SIZE = RING_COUNT * VALUES_PER_RING  # 35

def config_to_multi_hot(config):
    arr = np.zeros(OUTPUT_SIZE, dtype=np.float32)
    for ring_idx, val in enumerate(config):
        value_pos = val - VALUE_MIN
        arr[ring_idx * VALUES_PER_RING + value_pos] = 1.0
    return arr

def multi_hot_to_config(vec):
    vec = np.asarray(vec).reshape(-1)
    config = []
    for ring_idx in range(RING_COUNT):
        s = ring_idx * VALUES_PER_RING
        e = s + VALUES_PER_RING
        chosen_idx = int(np.argmax(vec[s:e]))
        config.append(VALUES[chosen_idx])
    return config

# -----------------------
# Dataset with fixed paths
# -----------------------
class AntennaConfigDataset(Dataset):
    def __init__(self, dataset_folder, split='train'):
        
        dataset_folder = os.path.join(script_dir, dataset_folder)  # <-- FIX
        if not os.path.isdir(dataset_folder):
            raise FileNotFoundError(f"Dataset folder not found: {dataset_folder}")

        # Les fichiers sont dans dataset/train/ ou dataset/test/
        split_folder = os.path.join(dataset_folder, split)
        if not os.path.isdir(split_folder):
            raise FileNotFoundError(f"Split folder not found: {split_folder}")

        print("Using dataset folder:", split_folder)

        self.X = np.load(os.path.join(split_folder, f'X_{split}.npy'))
        self.Y = np.load(os.path.join(split_folder, f'Y_{split}.npy'))

        self.X = self.X.astype(np.float32) / 255.0

        print(f"[Dataset] Loaded {split}: X {self.X.shape}, Y {self.Y.shape}")

    def __len__(self):
        return len(self.X)

    def __getitem__(self, idx):
        img = self.X[idx]
        if img.ndim == 2:
            img = np.repeat(img[np.newaxis, :, :], 3, axis=0)
        elif img.ndim == 3 and img.shape[-1] in (1, 3):
            img = img.transpose(2, 0, 1)
            if img.shape[0] == 1:
                img = np.repeat(img, 3, axis=0)

        img_tensor = torch.tensor(img, dtype=torch.float32)

        multi_hot = config_to_multi_hot(self.Y[idx])
        target_tensor = torch.tensor(multi_hot, dtype=torch.float32)

        return img_tensor, target_tensor

# -----------------------
# Model
# -----------------------
class AntennaConfigCNN(nn.Module):
    def __init__(self, output_size=OUTPUT_SIZE, pretrained=True):
        super().__init__()
        mobilenet = models.mobilenet_v2(pretrained=pretrained)
        self.features = mobilenet.features
        self.pool = nn.AdaptiveAvgPool2d((1,1))
        self.fc = nn.Linear(1280, output_size)
        #all layers trainable
        for p in self.features.parameters():
            p.requires_grad = True

    def forward(self, x):
        x = self.features(x)
        x = self.pool(x)
        x = torch.flatten(x, 1)
        return self.fc(x)

# -----------------------
# Training
# -----------------------
def train_model(dataset_folder='dataset', batch_size=16, epochs=30, lr=1e-4, device=None, pretrained=True):
    device = device or (torch.device('cuda') if torch.cuda.is_available() else torch.device('cpu'))
    print(f"[Train] Using device: {device}")

    train_ds = AntennaConfigDataset(dataset_folder, 'train')
    test_ds  = AntennaConfigDataset(dataset_folder, 'test')

    train_loader = DataLoader(train_ds, batch_size=batch_size, shuffle=True)
    test_loader  = DataLoader(test_ds, batch_size=batch_size)

    model = AntennaConfigCNN(pretrained=pretrained).to(device)
    criterion = nn.BCEWithLogitsLoss()
    optimizer = optim.Adam(model.parameters(), lr=lr)

    history = {'train_loss': [], 'val_loss': [], 'train_elem_acc': [], 'val_elem_acc': []}

    for epoch in range(1, epochs+1):
        model.train()
        running_loss = 0.0
        running_correct = 0
        running_total = 0

        for images, targets in train_loader:
            images = images.to(device)
            targets = targets.to(device)

            optimizer.zero_grad()
            logits = model(images)
            loss = criterion(logits, targets)
            loss.backward()
            optimizer.step()

            running_loss += loss.item() * images.size(0)

            # Compute element-wise accuracy using sigmoid threshold 0.5
            probs = torch.sigmoid(logits)
            preds = (probs >= 0.5).float()
            running_correct += (preds == targets).sum().item()
            running_total += targets.numel()

        epoch_train_loss = running_loss / len(train_loader.dataset)
        epoch_train_elem_acc = running_correct / running_total

        # Validation
        model.eval()
        val_loss = 0.0
        val_correct = 0
        val_total = 0
        with torch.no_grad():
            for images, targets in test_loader:
                images = images.to(device)
                targets = targets.to(device)

                logits = model(images)
                loss = criterion(logits, targets)
                val_loss += loss.item() * images.size(0)

                probs = torch.sigmoid(logits)
                preds = (probs >= 0.5).float()
                val_correct += (preds == targets).sum().item()
                val_total += targets.numel()

        epoch_val_loss = val_loss / len(test_loader.dataset)
        epoch_val_elem_acc = val_correct / val_total

        history['train_loss'].append(epoch_train_loss)
        history['val_loss'].append(epoch_val_loss)
        history['train_elem_acc'].append(epoch_train_elem_acc)
        history['val_elem_acc'].append(epoch_val_elem_acc)

        print(f"Epoch {epoch}/{epochs}: train_loss={epoch_train_loss:.6f}, val_loss={epoch_val_loss:.6f}, "
              f"train_elem_acc={epoch_train_elem_acc:.4f}, val_elem_acc={epoch_val_elem_acc:.4f}")

    # Save model & history in script directory
    model_save_path = os.path.join(script_dir, 'antenna_config_model_35.pth')
    history_save_path = os.path.join(script_dir, 'training_history_35.npy')
    
    torch.save(model.state_dict(), model_save_path)
    np.save(history_save_path, history)
    
    print(f"\n[Training Complete] Model saved to: {model_save_path}")
    print(f"[Training Complete] History saved to: {history_save_path}")
    
    return model, history
# -----------------------
# Load model with absolute path
# -----------------------
def load_model(model_path='antenna_config_model_35.pth', device=None, pretrained=False):

    model_path = os.path.join(script_dir, model_path)   # <-- FIXED
    if not os.path.isfile(model_path):
        raise FileNotFoundError(f"Model not found: {model_path}")

    device = device or (torch.device('cuda') if torch.cuda.is_available() else torch.device('cpu'))
    model = AntennaConfigCNN(pretrained=pretrained)
    model.load_state_dict(torch.load(model_path, map_location=device))
    model.to(device)
    model.eval()
    return model

# -----------------------
# Prediction helper
# -----------------------
def predict_from_image(model, image_path, device=None, threshold=0.5):

    image_path = os.path.join(script_dir, image_path)  # <-- FIXED

    if not os.path.isfile(image_path):
        raise FileNotFoundError(f"Image not found: {image_path}")

    img = plt.imread(image_path)
    img = np.mean(img, axis=2) if img.ndim == 3 else img
    img = img.astype(np.float32) / 255.0
    img = np.repeat(img[np.newaxis, :, :], 3, axis=0)

    x = torch.tensor(img).unsqueeze(0)
    x = x.to(device or torch.device('cpu'))

    with torch.no_grad():
        logits = model(x)
        probs = torch.sigmoid(logits).cpu().numpy().squeeze()

    return {
        "probs": probs,
        "multi_hot": (probs >= threshold).astype(np.float32),
        "decoded_config": multi_hot_to_config(probs)
    }

if __name__ == "__main__":
    model,history=train_model(batch_size=16, epochs=10, lr=1e-5)
