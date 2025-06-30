import numpy as np
import pydicom
from pydicom.pixel_data_handlers.util import apply_voi_lut
from skimage.segmentation import flood
from skimage import exposure

# def dicom_to_grayscale_array(path):
#     dicom = pydicom.dcmread(path)
#     pixel_array = dicom.pixel_array.astype(np.float32)
#     print("[DEBUG] Rango original DICOM:", pixel_array.min(), pixel_array.max())

#     if 'VOILUTSequence' in dicom or ('WindowCenter' in dicom and 'WindowWidth' in dicom):
#         pixel_array = apply_voi_lut(pixel_array, dicom)

#     pixel_array = exposure.rescale_intensity(pixel_array, in_range='image', out_range=(0, 255))
#     pixel_array = pixel_array.astype(np.uint8)

#     return pixel_array


# def dicom_to_grayscale_array(path):
#     dicom = pydicom.dcmread(path)
#     pixel_array = dicom.pixel_array.astype(np.float32)
#     print("[DEBUG] Rango original DICOM:", pixel_array.min(), pixel_array.max())

#     # APLICAR ESCALA HOUNSFIELD SI EXISTE
#     slope = float(dicom.get('RescaleSlope', 1))
#     intercept = float(dicom.get('RescaleIntercept', 0))
#     pixel_array = pixel_array * slope + intercept
#     print(f"[DEBUG] HU range: {pixel_array.min()} to {pixel_array.max()}")

#     # Recorte a rango típico en CT (ej: -1000 a 400)
#     pixel_array = np.clip(pixel_array, -1000, 400)

#     # Normalizar a 0-255
#     pixel_array = (pixel_array + 1000) / 1400  # pasa de [-1000, 400] a [0, 1]
#     pixel_array = np.clip(pixel_array, 0, 1)
#     pixel_array = (pixel_array * 255).astype(np.uint8)

#     # Guardar imagen para revisar
#     from PIL import Image
#     import os
#     debug_path = os.path.join(os.path.dirname(path), os.path.splitext(os.path.basename(path))[0] + "_debugHU.png")
#     Image.fromarray(pixel_array).save(debug_path)
#     print(f"[DEBUG] Imagen con escala HU guardada en: {debug_path}")

#     return pixel_array

def dicom_to_grayscale_array(path):
    dicom = pydicom.dcmread(path)
    pixel_array = dicom.pixel_array.astype(np.float32)
    print("[DEBUG] Rango original DICOM:", pixel_array.min(), pixel_array.max())

    # Detectar modalidad: solo aplicar HU si es CT
    modality = dicom.get("Modality", "")
    print(f"[DEBUG] Modalidad DICOM: {modality}")

    if modality == "CT":
        slope = float(dicom.get("RescaleSlope", 1))
        intercept = float(dicom.get("RescaleIntercept", 0))
        pixel_array = pixel_array * slope + intercept
        print(f"[DEBUG] HU range (CT): {pixel_array.min()} to {pixel_array.max()}")

        # Rango típico para tejidos blandos en TC
        pixel_array = np.clip(pixel_array, -1000, 400)
        pixel_array = (pixel_array + 1000) / 1400
        pixel_array = np.clip(pixel_array, 0, 1)
        pixel_array = (pixel_array * 255).astype(np.uint8)

    else:
        # Para RX y otras modalidades: solo rescalado básico
        if 'VOILUTSequence' in dicom or ('WindowCenter' in dicom and 'WindowWidth' in dicom):
            pixel_array = apply_voi_lut(pixel_array, dicom)

        pixel_array = exposure.rescale_intensity(pixel_array, in_range='image', out_range=(0, 255))
        pixel_array = pixel_array.astype(np.uint8)

    # Guardar imagen debug
    from PIL import Image
    import os
    debug_path = os.path.join(os.path.dirname(path), os.path.splitext(os.path.basename(path))[0] + f"_debug_{modality}.png")
    Image.fromarray(pixel_array).save(debug_path)
    print(f"[DEBUG] Imagen procesada guardada: {debug_path}")

    return pixel_array



def segment_with_region_growing(image_array, seed_point, tolerance):
    valor_semilla = image_array[seed_point[1], seed_point[0]]
    print(f"[DEBUG] Valor del píxel en la semilla ({seed_point}): {valor_semilla}")
    mask = flood(image_array, seed_point[::-1], tolerance=tolerance)
    return mask.astype(np.uint8)
