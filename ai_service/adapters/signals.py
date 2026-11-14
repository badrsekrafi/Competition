from __future__ import annotations

from .base import ModelAdapter


class EcgFmAdapter(ModelAdapter):
    id = "ecg-fm"
    name = "ECG-FM / HuBERT-ECG"
    role = "ECG representation and abnormal rhythm detection from AD8232 windows."
    source = "https://github.com/bowang-lab/ECG-FM/"
    required_packages = ("torch", "transformers")
    next_step = "Collect fixed-length ECG windows, then connect ECG-FM or HuBERT-ECG embeddings."


class PapageiAdapter(ModelAdapter):
    id = "papagei"
    name = "PaPaGei"
    role = "PPG foundation model for optical pulse and SpO2-related features."
    source = "https://github.com/Nokia-Bell-Labs/papagei-foundation-model"
    required_packages = ("torch",)
    next_step = "Store MAX30102 PPG windows and feed them to PaPaGei feature extraction."
