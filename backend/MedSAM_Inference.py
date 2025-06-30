# -*- coding: utf-8 -*-

"""
usage example:
python MedSAM_Inference.py -i assets/img_demo.png -o ./ --box "[95,255,190,350]"

- Carga el modelo MedSAM desde un checkpoint (medsam_vit_b.pth).
- Preprocesa la imagen (normalización, redimensionado a 1024x1024).
- Genera la máscara a partir de la caja proporcionada.
- Guarda la segmentación en la carpeta correspondiente

"""

import numpy as np
import torch
import torch.nn.functional as F
from skimage import io, transform
import os
from segment_anything import sam_model_registry
import argparse
import json
import pydicom
from pydicom.pixel_data_handlers.util import apply_voi_lut

def cargar_modelo(checkpoint_path, device="cpu"):
    # Usar map_location='cpu' para forzar el modelo a cargarse en la CPU (pq yo no tengo CUDA)
    # Para que no de error por seguridad PyTorch, se necesita añadir weights_only=True al cargar el modelo para cargar solo los pesos.
    checkpoint = torch.load(checkpoint_path, map_location=torch.device('cpu'), weights_only=True)

    modelo = sam_model_registry["vit_b"]() # Cargar la arquitectura del modelo
    modelo.load_state_dict(checkpoint)
    modelo.eval()
    return modelo

# Adapta si son imagenes dicom a RGB para pasarlas en formato compatible al modelo

def dicom_to_rgb_array(path):
    dicom = pydicom.dcmread(path) #leer dicom original
    pixel_array = dicom.pixel_array

    # Aplica VOI LUT si es posible (contraste clínico)
    if 'VOILUTSequence' in dicom or ('WindowCenter' in dicom and 'WindowWidth' in dicom):
        pixel_array = apply_voi_lut(pixel_array, dicom)

    # Escalar a rango 0-255
    pixel_array = pixel_array - np.min(pixel_array)
    pixel_array = (pixel_array / np.max(pixel_array) * 255).astype(np.uint8)

    # Convertir a RGB si es monocromo
    if len(pixel_array.shape) == 2:
        pixel_array = np.stack([pixel_array] * 3, axis=-1)

    return pixel_array


def preprocesar_imagen(ruta_imagen, device):
    extension = os.path.splitext(ruta_imagen)[1].lower()
    
    if extension in ['.dcm', '.dicom']:
        # img_3c: imagen con 3 canales (RGB)
        img_3c = dicom_to_rgb_array(ruta_imagen)
    else:
        img_np = io.imread(ruta_imagen)
        # Si la imagen es monocroma, la convierten a RGB
        img_3c = np.repeat(img_np[:, :, None], 3, axis=-1) if len(img_np.shape) == 2 else img_np

    H, W, _ = img_3c.shape

    # Redimensionar a 1024x1024 para el modelo
    img_1024 = transform.resize(
        img_3c, (1024, 1024), order=3, preserve_range=True, anti_aliasing=True
    ).astype(np.uint8)
    
    # Normalizar los valores al rango [0,1] y convertir a tensor de PyTorch con .permute(2, 0, 1).unsqueeze(0)
    img_1024 = (img_1024 - img_1024.min()) / np.clip(img_1024.max() - img_1024.min(), a_min=1e-8, a_max=None)
    img_tensor = torch.tensor(img_1024).float().permute(2, 0, 1).unsqueeze(0).to(device)

    return img_tensor, (H, W)

def ejecutar_segmentacion(modelo, imagen_tensor, box, H, W):
    #Convierte la caja de entrada en un array y la ajusta a la escala 1024x1024
    box_np = np.array([[int(x) for x in box[1:-1].split(',')]]) 
    box_1024 = box_np / np.array([W, H, W, H]) * 1024

    #Convierten la caja en tensor de PyTorch box_torch
    with torch.no_grad():
        # Obtener la representación de la imagen
        img_embed = modelo.image_encoder(imagen_tensor)

        # Procesar la caja de entrada
        box_torch = torch.as_tensor(box_1024, dtype=torch.float, device=img_embed.device)
        if len(box_torch.shape) == 2:
            box_torch = box_torch[:, None, :]  # (B, 1, 4)
            
        #Generan sparse_embeddings, dense_embeddings usando prompt_encoder().
        sparse_emb, dense_emb = modelo.prompt_encoder(
            points=None, boxes=box_torch, masks=None
        )

        low_res_logits, _ = modelo.mask_decoder(
            image_embeddings=img_embed,
            image_pe=modelo.prompt_encoder.get_dense_pe(),
            sparse_prompt_embeddings=sparse_emb,
            dense_prompt_embeddings=dense_emb,
            multimask_output=False,
        )

        # Ajustar al tamaño original, aplican torch.sigmoid() para normalizar
        # Usan F.interpolate() para escalar la máscara al tamaño original (H, W)
        low_res_pred = torch.sigmoid(low_res_logits)
        low_res_pred = F.interpolate(low_res_pred, size=(H, W), mode="bilinear", align_corners=False)
        mask = (low_res_pred.squeeze().cpu().numpy() > 0.5).astype(np.uint8)

    return mask
    

def procesar_imagen(ruta_imagen, box, checkpoint_path, device="cpu"):  #cpu por defecto
    modelo = cargar_modelo(checkpoint_path, device)
    img_tensor, (H, W) = preprocesar_imagen(ruta_imagen, device)
    mask = ejecutar_segmentacion(modelo, img_tensor, box, H, W)
    
    # Escalar máscara a 0-255 y convertir a uint8
    mask = (mask * 255).astype(np.uint8)
    # Obtener el nombre original del archivo sin la extensión
    nombre_archivo_sin_ext = os.path.splitext(os.path.basename(ruta_imagen))[0]

    # Crear el nombre de salida añadiendo '_mask' al final y asegurando la extensión
    archivo_mascara = f"{nombre_archivo_sin_ext}_mask.png"  # Forzar extensión .png (asi permitira transparencias en interfaz luego)
    
    return mask.tolist(), archivo_mascara # Convertimos el array NumPy a lista para poder enviarlo en JSON


# Flujo de ejecución
def main():
    parser = argparse.ArgumentParser(description="Segmentación de imágenes usando MedSAM")
    parser.add_argument("-i", "--input", type=str, required=True, help="Ruta de la imagen de entrada")
    parser.add_argument("--box", type=str, required=True, help="Caja delimitadora para la segmentación")
    parser.add_argument("--checkpoint", type=str, default="medsam_vit_b.pth", help="Ruta al checkpoint del modelo")

    args = parser.parse_args()

    try:
        # Llamar a la función de procesamiento de la imagen
        mascara, nombreArchivoMascara = procesar_imagen(args.input, args.box, args.checkpoint)
        # Devuelve el resultado como JSON
        print(json.dumps({"status": "ok", "mascara": mascara, "nombreArchivo": nombreArchivoMascara}, ensure_ascii=False), flush=True)
    except Exception as e:
        import traceback
        traceback.print_exc()
        print(f"ERROR INTERNO. Fallo al procesar imagen: {str(e)}")


if __name__ == "__main__":
    main()
