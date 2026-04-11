"""
Inference script for antenna configuration prediction.
Usage: python3 infer.py <image_path> <model_path>
Outputs JSON: {"ring1": int, "ring2": int, "ring3": int, "ring4": int, "ring5": int}
"""
import sys
import json
import numpy as np

def predict(image_path, model_path):
    import torch
    import torch.nn as nn
    import torchvision.models as models
    from PIL import Image

    RING_COUNT = 5
    VALUE_MIN = 2
    VALUE_MAX = 8
    VALUES_PER_RING = VALUE_MAX - VALUE_MIN + 1  # 7
    OUTPUT_SIZE = RING_COUNT * VALUES_PER_RING   # 35
    VALUES = list(range(VALUE_MIN, VALUE_MAX + 1))

    class AntennaConfigCNN(nn.Module):
        def __init__(self, output_size=OUTPUT_SIZE):
            super().__init__()
            mobilenet = models.mobilenet_v2(weights=None)
            self.features = mobilenet.features
            self.pool = nn.AdaptiveAvgPool2d((1, 1))
            self.fc = nn.Linear(1280, output_size)

        def forward(self, x):
            x = self.features(x)
            x = self.pool(x)
            x = torch.flatten(x, 1)
            return self.fc(x)

    device = torch.device('cpu')
    model = AntennaConfigCNN()
    state_dict = torch.load(model_path, map_location=device, weights_only=True)
    model.load_state_dict(state_dict)
    model.eval()

    # Load and preprocess image
    img = Image.open(image_path).convert('L')  # grayscale
    img_array = np.array(img, dtype=np.float32) / 255.0

    # Replicate to 3 channels
    img_3ch = np.stack([img_array, img_array, img_array], axis=0)
    x = torch.tensor(img_3ch, dtype=torch.float32).unsqueeze(0)

    with torch.no_grad():
        logits = model(x)
        probs = torch.sigmoid(logits).cpu().numpy().squeeze()

    # Decode multi-hot: argmax per ring of 7 values
    config = {}
    for ring_idx in range(RING_COUNT):
        s = ring_idx * VALUES_PER_RING
        e = s + VALUES_PER_RING
        chosen_idx = int(np.argmax(probs[s:e]))
        config[f"ring{ring_idx + 1}"] = VALUES[chosen_idx]

    return config

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print(json.dumps({"error": "Usage: infer.py <image_path> <model_path>"}))
        sys.exit(1)

    image_path = sys.argv[1]
    model_path = sys.argv[2]

    try:
        result = predict(image_path, model_path)
        print(json.dumps(result))
    except Exception as e:
        print(json.dumps({"error": str(e)}))
        sys.exit(1)
