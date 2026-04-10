import os
import json
import numpy as np
import scipy.io
import shutil

# === Affichage visuel de démarcation ===
def clear_console():
    print("\n" + "="*80 + "\n" + " "*30 + "NOUVELLE EXÉCUTION\n" + "="*80 + "\n")

clear_console()

# === Base directory of this script ===
script_dir = os.path.dirname(os.path.abspath(__file__))
print("script_dir =", script_dir)

def split_dataset(folder='dataset', test_ratio=0.15, random_seed=46):
    """Divise le dataset en training et test"""

    print("\n" + "="*50)
    print("SPLIT DATASET - IMAGES → CONFIGURATIONS")
    print("="*50)

    #With seed → same random numbers every run
    # Fixer la seed
    np.random.seed(random_seed)

    # Chargement des données
    dataset_dir = os.path.join(script_dir, folder)
    
    if not os.path.isdir(dataset_dir):
        raise FileNotFoundError(f"Dataset folder not found: {dataset_dir}")

    X_images = np.load(os.path.join(dataset_dir, 'X_images.npy'))
    Y_configs = np.load(os.path.join(dataset_dir, 'Y_configs.npy'))

    print("✓ Chargement des données réussi")
    print(f"  - Images: {X_images.shape}")
    print(f"  - Configurations: {Y_configs.shape}")

    # Charger les indices des images depuis le dossier images
    images_folder = os.path.join(dataset_dir, 'images')
    if not os.path.isdir(images_folder):
        raise FileNotFoundError(f"Images folder not found: {images_folder}")

    # Mélange aléatoire
    n_samples = len(X_images)
    indices = np.random.permutation(n_samples)

    # Séparation
    n_test = int(test_ratio * n_samples)
    test_indices = indices[:n_test]
    train_indices = indices[n_test:]

    # Création des splits
    X_train = X_images[train_indices]
    Y_train = Y_configs[train_indices]
    X_test = X_images[test_indices]
    Y_test = Y_configs[test_indices]

    # Créer les dossiers train et test
    train_dir = os.path.join(dataset_dir, 'train')
    test_dir = os.path.join(dataset_dir, 'test')
    
    train_images_dir = os.path.join(train_dir, 'images')
    test_images_dir = os.path.join(test_dir, 'images')
    
    os.makedirs(train_images_dir, exist_ok=True)
    os.makedirs(test_images_dir, exist_ok=True)
    
    print(f"\n✓ Création des dossiers train et test")

    # Copier les images correspondantes
    all_images = sorted([f for f in os.listdir(images_folder) if f.endswith('.png')])
    
    for idx, img_idx in enumerate(train_indices):
        src = os.path.join(images_folder, all_images[img_idx])
        dst = os.path.join(train_images_dir, all_images[img_idx])
        shutil.copy2(src, dst)
    
    for idx, img_idx in enumerate(test_indices):
        src = os.path.join(images_folder, all_images[img_idx])
        dst = os.path.join(test_images_dir, all_images[img_idx])
        shutil.copy2(src, dst)
    
    print(f"✓ Images copiées: {len(train_indices)} en train, {len(test_indices)} en test")

    # Sauvegarde des fichiers npy
    np.save(os.path.join(train_dir, 'X_train.npy'), X_train)
    np.save(os.path.join(train_dir, 'Y_train.npy'), Y_train)
    np.save(os.path.join(test_dir, 'X_test.npy'), X_test)
    np.save(os.path.join(test_dir, 'Y_test.npy'), Y_test)
    
    # Transposer pour avoir les configurations en colonnes (comme FFNN)
    Moutput_training = Y_train.T  # Shape: (5, n_train)
    Moutput_test = Y_test.T  # Shape: (5, n_test)
    
    # Sauvegarde des matrices Moutput au format .mat (comme FFNN)
    fichier_path_Moutput_training_mat = os.path.join(train_dir, 'Moutput_training.mat')
    scipy.io.savemat(fichier_path_Moutput_training_mat, {'Moutput_training': Moutput_training})
    
    fichier_path_Moutput_test_mat = os.path.join(test_dir, 'Moutput_test.mat')
    scipy.io.savemat(fichier_path_Moutput_test_mat, {'Moutput_test': Moutput_test})
    
    # Sauvegarde des matrices Moutput au format .npy (comme FFNN)
    np.save(os.path.join(train_dir, 'Moutput_training.npy'), Moutput_training)
    np.save(os.path.join(test_dir, 'Moutput_test.npy'), Moutput_test)

    # Affichage
    print("\n✓ Split complété:")
    print(f"  Training: {len(X_train)} exemples")
    print(f"  Test: {len(X_test)} exemples")
    print(f"  Moutput_training: {Moutput_training.shape}")
    print(f"  Moutput_test: {Moutput_test.shape}")
    print(f"  Exemple config train: {Y_train[0]}")
    print(f"  Exemple config test: {Y_test[0]}")
    print(f"\n✓ Fichiers sauvegardés:")
    print(f"  - {train_dir}/X_train.npy")
    print(f"  - {train_dir}/Y_train.npy")
    print(f"  - {train_dir}/Moutput_training.mat")
    print(f"  - {train_dir}/Moutput_training.npy")
    print(f"  - {train_dir}/images/")
    print(f"  - {test_dir}/X_test.npy")
    print(f"  - {test_dir}/Y_test.npy")
    print(f"  - {test_dir}/Moutput_test.mat")
    print(f"  - {test_dir}/Moutput_test.npy")
    print(f"  - {test_dir}/images/")
    print(f"\n✅ Matrices Moutput_training et Moutput_test ont été enregistrées")

    return {
        'X_train': X_train, 'Y_train': Y_train,
        'X_test': X_test, 'Y_test': Y_test
    }

if __name__ == "__main__":
    split_dataset(folder='dataset', test_ratio=0.15)