import os
import json
import numpy as np
import matplotlib.pyplot as plt
from scipy.signal import find_peaks
import scipy.io

# === Affichage visuel de démarcation ===
def clear_console():
    print("\n" + "="*80 + "\n" + " "*30 + "NOUVELLE EXÉCUTION\n" + "="*80 + "\n")

clear_console()

# === Base directory of this script ===
script_dir = os.path.dirname(os.path.abspath(__file__))
print("script_dir =", script_dir)

# Paramètres physiques pour la simulation d'antennes
carrierFreq = 2.45e9
c = 3e8
lambda_ = c / carrierFreq
k = 2 * np.pi / lambda_

def simulate_array(radii, elements_per_ring, theta0deg, phi0=0, n_theta=1024):
    """Simule le diagramme de rayonnement"""
    theta0 = np.deg2rad(theta0deg)
    theta = np.linspace(0, 2*np.pi, n_theta, endpoint=False)
    phi = 0
    AF_az = np.zeros_like(theta, dtype=complex)

    rings = len(radii)
    per_ring_contrib = np.zeros((rings, n_theta), dtype=complex)

    for ring in range(rings):
        a = radii[ring]
        N = elements_per_ring[ring]
        if N == 0:
            continue
        phi_n = 2 * np.pi * np.arange(N) / N

        for n in range(N):
            phase = k * a * (np.sin(theta) * np.cos(phi - phi_n[n]) -
                            np.sin(theta0) * np.cos(phi0 - phi_n[n]))
            contrib = np.exp(1j * phase)
            AF_az += contrib
            per_ring_contrib[ring, :] += contrib

    # Normalisation et conversion en dB
    AF_norm = np.abs(AF_az) / (np.max(np.abs(AF_az)) + np.finfo(float).eps)
    AF_dB = 20 * np.log10(AF_norm + np.finfo(float).eps)
    AF_dB[AF_dB < -60] = -60
    theta_deg = np.rad2deg(theta)

    return {'theta': theta, 'theta_deg': theta_deg, 'AF_norm': AF_norm,
            'AF_dB': AF_dB, 'per_ring_contrib': per_ring_contrib}

def save_polar_image(sim_res, out_path, dpi=100, figsize=(3,3)):
    """Sauvegarde le diagramme de rayonnement en image polaire"""
    theta = sim_res['theta']
    AF_dB = sim_res['AF_dB']
    fig = plt.figure(figsize=figsize)
    ax = fig.add_subplot(111, polar=True)
    ax.plot(theta, AF_dB, color='black')
    ax.set_ylim([-60, 0])
    #Nettoyage visuel
    ax.set_axis_off()
    plt.tight_layout(pad=0)
    fig.savefig(out_path, dpi=dpi, bbox_inches='tight', pad_inches=0)
    plt.close(fig)

def generate_dataset(folder='dataset', n_examples=2000, img_size=(128,128)):
    """Génère le dataset d'images + configurations d'antennes"""
    
    # Utiliser chemin relatif au script
    dataset_dir = os.path.join(script_dir, folder)
    os.makedirs(dataset_dir, exist_ok=True)
    
    images_folder = os.path.join(dataset_dir, 'images')
    os.makedirs(images_folder, exist_ok=True)

    # Matrices pour sauvegarde
    X_matrix = []  # Images
    Y_configs = []  # Configurations [elem_ring1, elem_ring2, ..., elem_ring5]

    # Paramètres fixes
    rings = 5  # 5 anneaux fixes
    base_radii = np.linspace(0.2*lambda_, 2.2*lambda_, rings)

    for i in range(n_examples):
        # Génération aléatoire de la configuration
        radii = base_radii * (1 + 0.12*(np.random.rand(rings)-0.5))
        # Modified: allow elements per ring from 2 to 8 (inclusive)
        elements_per_ring = [int(np.random.randint(2, 9)) for _ in range(rings)]
        theta0deg = float(np.random.uniform(0, 360))

        # Simulation
        sim = simulate_array(radii, elements_per_ring, theta0deg, n_theta=1024)

        # Sauvegarde de l'image
        img_path = os.path.join(images_folder, f'img_{i:05d}.png')
        save_polar_image(sim, img_path, figsize=(2,2))

        # Stockage
        img_array = plt.imread(img_path)
        #si il est 3 dimension ,je le convertit en 2 D
        if len(img_array.shape) == 3:
            img_array = np.mean(img_array, axis=2)
        X_matrix.append(img_array)
        Y_configs.append(elements_per_ring)

        if (i+1) % 100 == 0:
            print(f"Generated {i+1}/{n_examples}")

    # Conversion en arrays numpy
    X_matrix = np.array(X_matrix, dtype=np.float32)
    Y_configs = np.array(Y_configs, dtype=np.int32)

    # Transposer Y_configs pour avoir chaque configuration en colonne (comme FFNN)
    Moutput = Y_configs.T  # Shape: (5, n_examples)

    # Sauvegarde des fichiers npy dans le dossier du script
    np.save(os.path.join(dataset_dir, 'X_images.npy'), X_matrix)
    np.save(os.path.join(dataset_dir, 'Y_configs.npy'), Y_configs)
    
    # Sauvegarde de Moutput.mat dans le dossier du script (comme FFNN)
    fichier_path_Moutput_mat = os.path.join(dataset_dir, 'Moutput.mat')
    scipy.io.savemat(fichier_path_Moutput_mat, {'Moutput': Moutput})
    
    # Sauvegarde de Moutput.npy dans le dossier du script (comme FFNN)
    np.save(os.path.join(dataset_dir, 'Moutput.npy'), Moutput)

    # Sauvegarde des métadonnées
    metadata = {
        'total_examples': n_examples,
        'image_shape': X_matrix[0].shape,
        'num_rings': rings,
        'possible_elements': list(range(2, 9)), # Modified: reflecting new range
        'config_shape': Y_configs[0].shape,
        'images_folder': images_folder
    }

    with open(os.path.join(dataset_dir, 'metadata.json'), 'w') as f:
        json.dump(metadata, f, indent=2)

    print(f"\nDataset generated in {dataset_dir}:")
    print(f"- Images: {X_matrix.shape}")
    print(f"- Configurations: {Y_configs.shape}")
    print(f"- Moutput: {Moutput.shape}")
    print(f"- Exemple de configuration: {Y_configs[0]}")
    print(f"- Images folder: {images_folder}")
    print(f"✅ Moutput.mat et Moutput.npy ont été enregistrés")

if __name__ == "__main__":
    generate_dataset(folder='dataset', n_examples=500)