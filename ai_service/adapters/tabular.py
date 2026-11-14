from __future__ import annotations

from .base import ModelAdapter


class TabPfnAdapter(ModelAdapter):
    id = "tabpfn"
    name = "TabPFN"
    role = "Final tabular risk fusion over extracted features and patient context."
    source = "https://github.com/PriorLabs/tabpfn"
    required_packages = ("tabpfn",)
    next_step = "Create labelled scenario rows, then replace heuristic fusion with TabPFN prediction."
