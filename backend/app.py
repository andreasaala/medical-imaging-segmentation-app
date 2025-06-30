"""
Servidor Flask que conecta la aplicación web con los algoritmos de segmentación.

Funcionalidades:
- Segmentación con MedSAM o Region Growing.
- Generación de archivos DICOM SEG.
- Cálculo de IoU y superposición visual con ground truth.
"""

from flask import Flask, request, jsonify, send_file, send_from_directory
from flask_cors import CORS 
import shutil
#El servidor Flask esta en : http://127.0.0.1:5000 y la app web: http://127.0.0.1:5500
#Por seguridad, el navegador bloquea las peticiones entre diferentes orígenes (puertos o dominios distintos) si no están autorizadas explícitamente.
#Debemos permitir el acceso CORS en el servidor Flask. Lo haremos con la librería flask-cors.
import subprocess
import json
import logging
logging.getLogger('werkzeug').setLevel(logging.ERROR)  # evita que Flask escanee resultados/ si genera archivos nuevos. y se recargue

import os
os.environ['FLASK_RUN_FROM_CLI'] = 'false'  # Evita reinicio automático de Flask

import pydicom
import numpy as np
from PIL import Image
from regionGrowing import segment_with_region_growing, dicom_to_grayscale_array
import matplotlib.pyplot as plt

from highdicom.seg.sop import Segmentation
from highdicom.seg import SegmentDescription
from highdicom.content import CodedConcept
from pydicom.dataset import Dataset
from pydicom.uid import generate_uid



app = Flask(__name__, static_folder="../frontend")
app.config['MAX_CONTENT_LENGTH'] = 100 * 1024 * 1024  # 50 MB, para que permita enviar datos más grandes
CORS(app)  # Habilita CORS para todas las rutas

# Ruta base de resultados
BASE_RESULTADOS = os.path.abspath(os.path.join(os.path.dirname(__file__), "../resultados")) # Ruta absoluta desde el directorio donde está el script
# Subcarpetas de resultados
TEMP_FOLDER = os.path.join(BASE_RESULTADOS, "temp")
OVERLAY_FOLDER = os.path.join(BASE_RESULTADOS, "overlays")

# Crear carpetas si no existen
for carpeta in [BASE_RESULTADOS, TEMP_FOLDER, OVERLAY_FOLDER]:
    os.makedirs(carpeta, exist_ok=True)

# Limpiar todas las carpetas de resultados al iniciar el servidor
for carpeta in [TEMP_FOLDER, OVERLAY_FOLDER]:
    if os.path.exists(carpeta):
        for archivo in os.listdir(carpeta):
            ruta = os.path.join(carpeta, archivo)
            try:
                if os.path.isfile(ruta):
                    os.remove(ruta)
                elif os.path.isdir(ruta):
                    shutil.rmtree(ruta)
            except Exception as e:
                print(f"[WARNING] No se pudo eliminar {ruta}: {e}")
    else:
        os.makedirs(carpeta)


@app.route("/")
def index():
    return send_from_directory(app.static_folder, "index.html")

@app.route("/<path:path>")
def static_files(path):
    return send_from_directory(app.static_folder, path)


@app.route('/segmentar_medsam', methods=['POST'])
def segmentar_medsam(): 
    if 'imagen' not in request.files or 'box' not in request.form:
        return jsonify({'error': 'Faltan datos (imagen o box)'}), 400

    # Obtener los parametros recibidos desde el formulario
    imagen = request.files['imagen']
    box = request.form['box']  # Este será un string JSON

    # Guardar la imagen ORIGINAL en la carpeta de TEMPORAL, usa ruta absoluta
    ruta_imagen = os.path.abspath(os.path.join(TEMP_FOLDER, imagen.filename))
    imagen.save(ruta_imagen)

    # Obtener la ruta del entorno de Python de Conda
    ruta_python = os.path.join(os.environ['CONDA_PREFIX'], 'python.exe')

    # Obtener la ruta del script MedSAM y del checkponit donde están los valores de los pesos
    ruta_medsam = os.path.abspath(os.path.join(os.path.dirname(__file__), 'MedSAM_Inference.py'))
    ruta_checkpoint = os.path.abspath(os.path.join(os.path.dirname(__file__), "work_dir", "MedSAM", "medsam_vit_b.pth"))

    # Verificar que los archivos existen antes de ejecutar
    if not os.path.exists(ruta_python):
        return jsonify({'error': f'No se encontró el intérprete de Python en {ruta_python}'}), 500
    if not os.path.exists(ruta_medsam):
        return jsonify({'error': f'No se encontró el script MedSAM en {ruta_medsam}'}), 500
    
    # Comando para ejecutar MedSAM, equivale a escribir en la terminal
    comando = [
        ruta_python, ruta_medsam,
        '-i', ruta_imagen,
        '--box', box, 
        '--checkpoint', ruta_checkpoint,
    ]
    
    # Para comprobar valores
    print(f"Ejecutando MedSAM con el entorno apptfg: {comando}")
    print(f"Python utilizado: {ruta_python}")
    print(f"La ruta del archivo MedSAM_Inference.py es: {ruta_medsam}")
    print(f"La ruta del checkpoint es: {ruta_checkpoint}")
    
    try:
        # Ejecuta MedSAM sin bloquear Flask
        proceso = subprocess.Popen(comando, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)

        # Espera a que termine y obtiene la salida
        stdout, stderr = proceso.communicate()

        if proceso.returncode != 0:
            print("Error ejecutando MedSAM:", stderr)
            print("Devuelve estado: 500")
            return jsonify({'error': f'Error ejecutando MedSAM: {stderr}'}), 500

        try:
            data = json.loads(stdout)
            mascara = data.get("mascara")  # Mejor usar.get() para evitar KeyError
            nombreArchivo = data.get("nombreArchivo")
            
            # Guardar la máscara segmentada como imagen PNG en TEMP_FOLDER (COMO DEBUG)
            ruta_mascara = os.path.join(TEMP_FOLDER, nombreArchivo)
            Image.fromarray(np.array(mascara, dtype=np.uint8)).save(ruta_mascara)
            
            if mascara is None or not isinstance(mascara, list):
                print("Devuelve estado: 500")
                return jsonify({'error': 'No se generó la máscara'}), 500

            print("Enviando respuesta al frontend...")
            print("Devuelve estado: 200")
            return jsonify({'mascara': mascara, 'nombreArchivo': nombreArchivo}), 200

        except json.JSONDecodeError as e:
            print("Error al decodificar JSON:", e)
            print("Salida de MedSAM (posible error en JSON):", stdout)
            print("Devuelve estado: 500")
            return jsonify({'error': 'Error al procesar la respuesta de MedSAM'}), 500

    except Exception as e:
        print("Error general ejecutando MedSAM:", e)
        print("Devuelve estado: 500")
        return jsonify({'error': f'Error general: {str(e)}'}), 500
    
    

@app.route('/segmentar_region_growing', methods=['POST'])
def segmentar_rg():
    if 'imagen' not in request.files or 'semilla' not in request.form:
        return jsonify({'error': 'Faltan datos (imagen o semilla)'}), 400

    try:
        imagen_file = request.files['imagen']
        nombre_imagen_original = os.path.splitext(imagen_file.filename)[0]
        extension = os.path.splitext(imagen_file.filename)[1].lower()

        # Guardar imagen ORIGINAL en la carpeta de TEMPORAL
        ruta_imagen = os.path.abspath(os.path.join(TEMP_FOLDER, imagen_file.filename))
        imagen_file.save(ruta_imagen)

        # Leer la imagen
        if extension in ['.dcm', '.dicom']:
            imagen_np = dicom_to_grayscale_array(ruta_imagen)
        else:
            imagen_pil = Image.open(ruta_imagen).convert('L')
            imagen_np = np.array(imagen_pil)

        # Obtener semilla y tolerancia
        semilla = json.loads(request.form['semilla'])  # [x, y]
        tolerancia = int(request.form.get('tolerancia'))

        if not isinstance(semilla, list) or len(semilla) != 2:
            return jsonify({'error': 'Semilla no válida'}), 400

        print(f"Aplicando Region Growing en punto {semilla} con tolerancia {tolerancia}")
        mask = segment_with_region_growing(imagen_np, tuple(semilla), tolerancia)

        nombre_archivo_mascara = f"{nombre_imagen_original}_rg_mask.png"
        
        # Guardar la máscara segmentada como imagen PNG en TEMP_FOLDER (COMO DEBUG)
        #ruta_mascara = os.path.join(TEMP_FOLDER, nombre_archivo_mascara)
        # Image.fromarray((mask * 255).astype(np.uint8)).save(ruta_mascara)

        print(f"[DEBUG] Mínimo valor de imagen: {imagen_np.min()}")
        print(f"[DEBUG] Máximo valor de imagen: {imagen_np.max()}")
        print(f"[DEBUG] Valor semilla: {imagen_np[semilla[1], semilla[0]]}")

        return jsonify({
            'mascara': mask.tolist(),
            'nombreArchivo': nombre_archivo_mascara
        })

    except Exception as e:
        print("Error al procesar Region Growing:", e)
        return jsonify({'error': f'Error al procesar la segmentación: {str(e)}'}), 500


def crear_seg(ruta_imagen_original, mask_array, ruta_salida_seg):
    ds_original = pydicom.dcmread(ruta_imagen_original)
    mask_array = np.asarray(mask_array, dtype=bool)

    # Crear algoritmo de segmentación y se pone la info relevante
    algorithm_identification = Dataset()
    algorithm_identification.AlgorithmName = 'AplicacionTFGAndreaSala'
    algorithm_identification.AlgorithmVersion = '1.0'
    algorithm_identification.AlgorithmSource = 'INTERNAL'
    
    segment_label_usuario = request.form.get('segment_label')  # Valor por defecto
    # Se definen  las etiquetas clínicas de la segmentación
    segmento = SegmentDescription(
        segment_number=1,
        segment_label=segment_label_usuario,
        segmented_property_category=CodedConcept("T-D000A", "SRT", "Anatomical Structure"),
        segmented_property_type=CodedConcept("T-04000", "SRT", "Tissue"),
        algorithm_type="AUTOMATIC",
        algorithm_identification=[algorithm_identification]
    )

    # Crear el objeto SEG con todos los parámetros requeridos
    seg = Segmentation(
        source_images=[ds_original],  # referencia al archivo original, debe tener todos los UIDs correctamente definidos
        pixel_array=np.expand_dims(mask_array, axis=0),
        segmentation_type="BINARY",
        segment_descriptions=[segmento],
        series_instance_uid=generate_uid(), #Genera un identificador único para la serie DICOM que contiene este archivo SEG
        series_number=301, #para diferenciar entre series distintas dentro del mismo estudio (num típico para segmentaciones automáticas o manuales 300-399),solo va a haber una serie SEG por estudio en este caso.
        sop_instance_uid=generate_uid(), #UID único para esta instancia DICOM concreta (el propio archivo SEG)
        instance_number=1,
        manufacturer="AplicacionTFGAndreaSala",
        manufacturer_model_name="BioSegApp",
        device_serial_number="DEMO-001",
        software_versions="1.0.0"
    )

    
    seg.save_as(ruta_salida_seg)
    print(f"[INFO] Archivo DICOM SEG guardado: {ruta_salida_seg}")


@app.route('/guardar_dicom_seg', methods=['POST'])
def guardar_dicom_seg():
    try:
        imagen_nombre = request.form.get('nombre_imagen')
        archivo_mascara = request.files.get('mascara_archivo')

        if not imagen_nombre or not archivo_mascara:
            return jsonify({'error': 'Faltan datos'}), 400

        nombre_base = os.path.splitext(imagen_nombre)[0]
        ruta_imagen_original = os.path.abspath(os.path.join(TEMP_FOLDER, imagen_nombre))
        ruta_seg = os.path.join(TEMP_FOLDER, f"{nombre_base}_SEG.dcm")

        # Cargar la máscara desde el archivo JSON recibido
        mascara_lista = json.load(archivo_mascara)
        mask_array = np.array(mascara_lista, dtype=bool)

        crear_seg(ruta_imagen_original, mask_array, ruta_seg)
        print(f"[INFO] DICOM SEG creado tras guardar: {ruta_seg}")

        return send_file(ruta_seg, as_attachment=True)

    except Exception as e:
        print("Error al generar SEG:", e)
        return jsonify({'error': f'Error al generar SEG: {str(e)}'}), 500
    
    
    
@app.route('/calcular_iou', methods=['POST'])
def calcular_iou():
    try:
        if 'imagen' not in request.files or 'ground_truth' not in request.files or 'mascara' not in request.files or 'metodo' not in request.form:
            return jsonify({'error': 'Faltan datos requeridos'}), 400

        imagen = request.files['imagen']
        gt_file = request.files['ground_truth']
        mascara_file = request.files['mascara']
        metodo = request.form['metodo'].upper()

        if metodo not in ["M", "R"]:
            return jsonify({'error': 'Método inválido. Usa M o R.'}), 400

        # Leer ground truth desde la carpeta TEMPORAL
        ruta_gt = os.path.join(TEMP_FOLDER, "gt_temp.png")
        gt_file.save(ruta_gt)
        imagen_gt = Image.open(ruta_gt).convert("L")
        gt_array = np.array(imagen_gt)
        gt_binaria = (gt_array > 127).astype(np.uint8)

        # Leer máscara generada
        mascara = json.load(mascara_file)
        mascara_array = np.array(mascara, dtype=np.uint8)

        # Leer imagen original (DICOM o normal) como numpy
        extension = os.path.splitext(imagen.filename)[1].lower()
        if extension in [".dcm", ".dicom"]:
            ruta_dcm = os.path.join(TEMP_FOLDER, imagen.filename)
            imagen.save(ruta_dcm)
            imagen_np = dicom_to_grayscale_array(ruta_dcm)
            imagen_np = (imagen_np / imagen_np.max() * 255).astype(np.uint8)
            imagen_np = np.stack([imagen_np]*3, axis=-1)  # convertir a RGB
        else:
            imagen_original = Image.open(imagen).convert("RGB")
            imagen_np = np.array(imagen_original)

        # Recorte en caso de MedSAM
        if metodo == "M":
            if 'box' not in request.form:
                return jsonify({'error': 'Falta la bbox para el método MedSAM'}), 400

            box = json.loads(request.form['box'])  # [x1, y1, x2, y2]
            x1, y1, x2, y2 = box

            # Validar límites de recorte según ancho y alto
            h_img, w_img = mascara_array.shape
            x1 = max(0, min(x1, w_img))
            x2 = max(0, min(x2, w_img))
            y1 = max(0, min(y1, h_img))
            y2 = max(0, min(y2, h_img))

            # Recorte con slicing NumPy (todos a la vez)
            imagen_np = imagen_np[y1:y2, x1:x2]
            mascara_array = mascara_array[y1:y2, x1:x2]
            gt_binaria = gt_binaria[y1:y2, x1:x2]

        # Verificar coincidencia de tamaños
        if imagen_np.shape[:2] != mascara_array.shape or mascara_array.shape != gt_binaria.shape:
            return jsonify({'error': 'Las dimensiones de la imagen, máscara y ground truth no coinciden'}), 400

        # Calcular IoU
        interseccion = np.logical_and(mascara_array, gt_binaria).sum()
        union = np.logical_or(mascara_array, gt_binaria).sum()
        iou = interseccion / union if union > 0 else 1.0 if interseccion == 0 else 0.0

        print(f"[INFO] IoU calculado: {iou:.4f}")

        # Crear overlay
        overlay = imagen_np.copy()
        rojo = np.array([255, 0, 0], dtype=np.uint8)
        verde = np.array([0, 255, 0], dtype=np.uint8)
        alpha = 0.4

        for y in range(mascara_array.shape[0]):
            for x in range(mascara_array.shape[1]):
                if gt_binaria[y, x]:
                    overlay[y, x] = (1 - alpha) * overlay[y, x] + alpha * verde
                if mascara_array[y, x]:
                    overlay[y, x] = (1 - alpha) * overlay[y, x] + alpha * rojo

        overlay_img = Image.fromarray(overlay.astype(np.uint8))
        nombre_overlay = f"{os.path.splitext(imagen.filename)[0]}_fusion_iou.png"
        ruta_overlay = os.path.join(OVERLAY_FOLDER, nombre_overlay)
        overlay_img.save(ruta_overlay)

        return jsonify({'iou': float(iou)})

    except Exception as e:
        print("Error en /calcular_iou:", e)
        return jsonify({'error': f'Error interno al calcular IoU: {str(e)}'}), 500


if __name__ == '__main__':
    app.run(debug=False, use_reloader=False, port=5000) # debug False para ver si no se recarga la pagina
