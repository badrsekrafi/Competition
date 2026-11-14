from __future__ import annotations

from .signals import EcgFmAdapter, PapageiAdapter
from .tabular import TabPfnAdapter
from .time_series import Chronos2Adapter, MomentAdapter


ADAPTERS = (
    Chronos2Adapter(),
    MomentAdapter(),
    EcgFmAdapter(),
    PapageiAdapter(),
    TabPfnAdapter(),
)


def adapter_summaries() -> list[dict[str, object]]:
    return [adapter.status().to_dict() for adapter in ADAPTERS]


def active_adapter_ids() -> list[str]:
    return [status["id"] for status in adapter_summaries() if status["available"]]


def recommended_stack() -> list[str]:
    return [
        "chronos-2 or moment for vital-sign forecasting",
        "ecg-fm or hubert-ecg for ECG windows",
        "papagei for MAX30102 PPG windows",
        "tabpfn for final risk fusion after labelled scenario collection",
        "NEWS2/TCCC rules for explainable medical escalation",
    ]
