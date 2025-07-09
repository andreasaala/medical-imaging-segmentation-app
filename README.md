## Project Description
This project is a hybrid web-based tool for medical image segmentation, developed as part of a Bachelor's Thesis in Biomedical Engineering. The user interacts with the image to define a region of interest (ROI) using bounding boxes or points/seeds. Based on this input, automatic segmentation algorithms such as region growing and a deep learning model (MedSAM) are applied. The system supports common medical image formats (PNG, TIFF, JPG, DICOM) and allows exporting segmentations as binary masks or DICOM SEG files.

The MedSAM model has been integrated into this application to enable AI-assisted segmentation. More information about the original model can be found in the [MedSAM repository](https://github.com/bowang-lab/MedSAM). 

If a ground truth mask is available, the tool allows the user to calculate the Intersection over Union (IoU) metric to assess the quality of the segmentation. Additionally, a local result file is generated combining the original image with the overlaid masks: the one produced by the selected algorithm in the application (in red) and the provided ground truth n(in green), facilitating visual comparison. The user can also manually refine the segmentation using the painting and erasing tools.

## Technologies Used
- Frontend: HTML5, CSS, JavaScript
- Backend: Python, Scikit-learn, Pandas, Numpy, pydicom, PIL, highdicom, torch
- Communication: API REST using Flask framework.

## Demo
You can watch a short demo video. 
![Demo of the application](demo.gif)

Also, full demo video is available. [Full demo](https://drive.google.com/file/d/1LPyrdAs4ONOdYb40uPEIfmKPBH8K31Gx/view?usp=sharing). 
