import os
import torch
import numpy as np
import matplotlib.pyplot as plt
from scipy.signal import find_peaks
from train_model import load_model, multi_hot_to_config

# === Affichage visuel de démarcation ===
def clear_console():
    print("\n" + "="*80 + "\n" + " "*30 + "NOUVELLE EXÉCUTION\n" + "="*80 + "\n")

clear_console()

# === Base directory of this script ===
script_dir = os.path.dirname(os.path.abspath(__file__))
print("script_dir =", script_dir)

# === Paramètres modifiables : ces paramètres doivent être similaires à ceux utilisés en generate_dataset.py ===
###########################
carrierFreq = 2.45e9
c = 3e8
lambda_ = c / carrierFreq
k = 2 * np.pi / lambda_
r0 = 0.2 * lambda_
delta_r = 0.5 * lambda_
max_rings = 5
###########################

# ---------------------------------------------------------
# 1. Load model
# ---------------------------------------------------------
MODEL_PATH = os.path.join(script_dir, "antenna_config_model_35.pth")
if not os.path.isfile(MODEL_PATH):
    raise FileNotFoundError(f"Model not found: {MODEL_PATH}")

model = load_model(MODEL_PATH)

device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
print(f"Using device for prediction: {device}")

model = model.to(device)
model.eval()

# ---------------------------------------------------------
# 2. Charger les données de test depuis le dossier test
# ---------------------------------------------------------
test_dir = os.path.join(script_dir, 'dataset', 'test')
X_test = np.load(os.path.join(test_dir, 'X_test.npy'))
Y_test = np.load(os.path.join(test_dir, 'Y_test.npy'))

print(f"\n✓ Données de test chargées:")
print(f"  - X_test: {X_test.shape}")
print(f"  - Y_test: {Y_test.shape}")

# ---------------------------------------------------------
# 3. Sélection de l'exemple de test depuis le dossier test/images
# ---------------------------------------------------------
indice_test = 5

if indice_test >= len(X_test):
    indice_test = 0
    print(f"⚠️ Indice {indice_test} hors limite, utilisation de l'indice 0")

# Charger l'image depuis le dossier test/images
test_images_dir = os.path.join(test_dir, 'images')
if not os.path.isdir(test_images_dir):
    raise FileNotFoundError(f"Test images folder not found: {test_images_dir}")

test_images = sorted([f for f in os.listdir(test_images_dir) if f.endswith('.png')])
test_image_path = os.path.join(test_images_dir, test_images[indice_test])

print(f"\n✓ Image de test utilisée: {test_images[indice_test]}")

# Charger l'image
test_img = plt.imread(test_image_path)
if len(test_img.shape) == 3:
    test_img = np.mean(test_img, axis=2)

# Préparer l'image pour le modèle
x_test_img = X_test[indice_test].astype(np.float32) / 255.0
if x_test_img.ndim == 2:
    x_test_img = np.repeat(x_test_img[np.newaxis, :, :], 3, axis=0)

x_test_tensor = torch.tensor(x_test_img, dtype=torch.float32).unsqueeze(0).to(device)

# Configuration de référence
architecture_reference = Y_test[indice_test].astype(int)

# ---------------------------------------------------------
# 4. Prédiction
# ---------------------------------------------------------
with torch.no_grad():
    logits = model(x_test_tensor)
    probs = torch.sigmoid(logits).cpu().numpy().squeeze()

# Conversion du multi-hot en configuration
architecture_predicted = multi_hot_to_config(probs)

print("\n" + "="*50)
print("Architecture référence  :", architecture_reference)
print("Architecture prédite    :", architecture_predicted)
print("="*50)

# ---------------------------------------------------------
# 5. Fonction : calcul du diagramme et des métriques (comme FFNN)
# ---------------------------------------------------------
def calcul_AF_performance_metrics(elements_per_ring, theta0deg):
    """Calcule le diagramme de rayonnement et les métriques de performance"""
    rings = len(elements_per_ring)
    radii = r0 + delta_r * np.arange(max_rings)
    
    theta0 = np.deg2rad(theta0deg)
    phi0 = 0
    phi = 0
    theta = np.linspace(0, 2 * np.pi, 1000)
    
    AF_az = np.zeros_like(theta, dtype=complex)
    
    for ring in range(rings):
        a = radii[ring]
        N = elements_per_ring[ring]
        if N == 0:
            continue
        phi_n = 2 * np.pi * np.arange(N) / N
        for n in range(N):
            phase = k * a * (np.sin(theta) * np.cos(phi - phi_n[n]) -
                             np.sin(theta0) * np.cos(phi0 - phi_n[n]))
            AF_az += np.exp(1j * phase)
    
    AF_norm_az = np.abs(AF_az) / (np.max(np.abs(AF_az)) + np.finfo(float).eps)
    AF_dB_az = 20 * np.log10(AF_norm_az + np.finfo(float).eps)
    AF_dB_az[AF_dB_az < -40] = -40
    theta_deg = np.rad2deg(theta)
    
    # Calcul du gain max non normalisé du lobe principale
    AF_abs_az = np.abs(AF_az)
    maxVal = np.max(AF_abs_az)
    maxVal_non_norm = 20 * np.log10(maxVal + np.finfo(float).eps)
    
    # --- HPBW ---
    maxVal_dB = np.max(AF_dB_az)
    maxIdx = np.argmax(AF_dB_az)
    halfPower = maxVal_dB - 3
    AF_dB_ext = np.concatenate((AF_dB_az, AF_dB_az, AF_dB_az))
    theta_deg_ext = np.concatenate((theta_deg - 360, theta_deg, theta_deg + 360))
    maxIdx_ext = maxIdx + len(theta_deg)
    
    leftIdx_ext = np.where(AF_dB_ext[:maxIdx_ext] <= halfPower)[0][-1] if np.any(
        AF_dB_ext[:maxIdx_ext] <= halfPower) else None
    
    rightIdx_ext = np.where(AF_dB_ext[maxIdx_ext:] <= halfPower)[0]
    rightIdx_ext = rightIdx_ext[0] + maxIdx_ext if len(rightIdx_ext) > 0 else None
    
    if leftIdx_ext is None or rightIdx_ext is None:
        HPBW = 180
    else:
        HPBW = theta_deg_ext[rightIdx_ext] - theta_deg_ext[leftIdx_ext]
    
    # --- Gain lobe principal & SSL ---
    responseLin = AF_norm_az
    peaks, _ = find_peaks(responseLin, distance=5)
    
    pk = responseLin[peaks]
    if len(pk) == 0:
        main_lobe_gain = maxVal_non_norm
        true_SSL_gain = 0
    else:
        sorted_idx = np.argsort(pk)[::-1]
        sorted_pk = pk[sorted_idx]
        
        threshold_dB = 1
        main_lobes_idx = np.where(
            20 * np.log10(sorted_pk + np.finfo(float).eps) >=
            20 * np.log10(sorted_pk[0] + np.finfo(float).eps) - threshold_dB)[0]
        side_lobe_idx = np.setdiff1d(np.arange(len(sorted_pk)), main_lobes_idx)
        
        main_lobe_gain = maxVal_non_norm
        true_SSL_gain = 20 * np.log10(sorted_pk[side_lobe_idx[0]] + np.finfo(float).eps) if len(
            side_lobe_idx) > 0 else 0
    
    return AF_dB_az, theta_deg, HPBW, main_lobe_gain, true_SSL_gain

# ---------------------------------------------------------
# 6. Générer un theta0deg aléatoire pour le test (comme dans generate_dataset)
# ---------------------------------------------------------
# Note: Dans un vrai scénario, theta0deg devrait être stocké avec chaque configuration
# Pour ce test, on utilise une valeur aléatoire fixe
np.random.seed(46)  # Pour reproduire le même résultat
theta0deg = float(np.random.uniform(0, 180))

# ---------------------------------------------------------
# 7. Calcul des performances (comme FFNN)
# ---------------------------------------------------------
AF_ref_dB, theta_deg, HPBW_ref, gain_main_ref, SSL_ref = calcul_AF_performance_metrics(
    architecture_reference, theta0deg)
AF_pred_dB, theta_deg, HPBW_pred, gain_main_pred, SSL_pred = calcul_AF_performance_metrics(
    architecture_predicted, theta0deg)

# ---------------------------------------------------------
# 8. Tracé polaire (comme FFNN)
# ---------------------------------------------------------
theta_rad = np.deg2rad(theta_deg)
plt.figure(figsize=(8, 6))
ax = plt.subplot(111, polar=True)
ax.plot(theta_rad, AF_ref_dB, label='Référence', linewidth=2)
ax.plot(theta_rad, AF_pred_dB, label='Prédiction', linewidth=2, linestyle='--')
ax.set_title("Diagramme de rayonnement (polaire)", fontsize=13)
ax.set_rlim([-40, 0])
ax.legend(loc='upper right', bbox_to_anchor=(1.1, 1.1))

# ---------------------------------------------------------
# 9. Tracé cartésien (comme FFNN)
# ---------------------------------------------------------
plt.figure(figsize=(10, 5))
plt.plot(theta_deg, AF_ref_dB, label='Référence', linewidth=2)
plt.plot(theta_deg, AF_pred_dB, label='Prédiction', linewidth=2, linestyle='--')
plt.xlabel("Azimut (°)")
plt.ylabel("Gain (dB)")
plt.title("Diagramme de rayonnement - Azimut")
plt.xlim([0, 360])
plt.ylim([-40, 0])
plt.grid(True)
plt.legend()
plt.tight_layout()

# ---------------------------------------------------------
# 10. Affichage de l'image de test
# ---------------------------------------------------------
plt.figure(figsize=(5, 5))
plt.imshow(test_img, cmap='gray')
plt.title(f"Image de test utilisée\nRéf: {architecture_reference} | Pred: {architecture_predicted}", fontsize=10)
plt.axis('off')
plt.tight_layout()
plt.show()

# ---------------------------------------------------------
# 11. Affichage des performances (comme FFNN)
# ---------------------------------------------------------
print(f"\ntheta0deg                 : {theta0deg:.2f}°")

print(f"\n--- Performances Référence ---")
print(f"Gain du lobe principal : {gain_main_ref:.2f} dB")
print(f"True Side Lobe Gain   : {SSL_ref:.2f} dB")
print(f"HPBW                  : {HPBW_ref:.2f}°")

print(f"\n--- Performances Prédiction ---")
print(f"Gain du lobe principal : {gain_main_pred:.2f} dB")
print(f"True Side Lobe Gain   : {SSL_pred:.2f} dB")
print(f"HPBW                  : {HPBW_pred:.2f}°")

# ---------------------------------------------------------
# 12. Calcul des erreurs (comme FFNN)
# ---------------------------------------------------------
mae_HPBW = abs(HPBW_pred - HPBW_ref)
mae_main_lobe_gain = abs(gain_main_pred - gain_main_ref)
mae_true_SSL_gain = abs(SSL_pred - SSL_ref)

print("\n=== Erreurs absolues (MAE) entre prédiction et référence ===")
print(f"Erreur Gain Lobe Principal : {mae_main_lobe_gain:.2f} dB")
print(f"Erreur True SSL Gain      : {mae_true_SSL_gain:.2f} dB")
print(f"Erreur HPBW               : {mae_HPBW:.2f} degrés")

# ---------------------------------------------------------
# 13. Erreurs relatives (comme FFNN)
# ---------------------------------------------------------
# Charger Moutput complet pour calculer les valeurs max (si disponible)
try:
    Moutput_complete = np.load(os.path.join(script_dir, 'dataset', 'Moutput.npy'))
    # Recalculer les valeurs max depuis toutes les configurations
    # Note: Pour être exact, il faudrait calculer les métriques pour toutes les configs
    # Ici on utilise des valeurs approximatives
    max_main_lobe_gain = 40  # Valeur typique max
    max_true_SSL_gain = 20   # Valeur typique max
    max_HPBW = 180
    
    # Coefficients de pondération
    w1 = 0.33
    w2 = 0.33
    w3 = 0.34
    
    # Calcul des erreurs relatives (en %)
    err_rel_main_lobe_gain = 100 * (abs(gain_main_pred - gain_main_ref) / (abs(max_main_lobe_gain) + 1e-8))
    err_rel_true_SSL_gain = 100 * (abs(SSL_pred - SSL_ref) / (abs(max_true_SSL_gain) + 1e-8))
    err_rel_HPBW = 100 * (abs(HPBW_pred - HPBW_ref) / (180 + 1e-8))
    
    # Calcul de l'erreur de prédiction globale pondérée
    error_pred_global = (w1 * err_rel_main_lobe_gain + w2 * err_rel_true_SSL_gain + w3 * err_rel_HPBW)
    
    print("\n=== Erreurs relatives de prédiction (%) ===")
    print(f"Erreur relative de prédiction Gain Lobe Principal : {err_rel_main_lobe_gain:.2f} %")
    print(f"Erreur relative de prédiction True SSL Gain      : {err_rel_true_SSL_gain:.2f} %")
    print(f"Erreur relative de prédiction HPBW               : {err_rel_HPBW:.2f} %")
    print(f"\nErreur globale de prédiction pondérée : {error_pred_global:.2f} %")
except:
    print("\n⚠️ Fichier Moutput.npy non trouvé, calcul des erreurs relatives ignoré")

print("\n" + "="*50)
print("Test completed successfully!")
print("="*50)
