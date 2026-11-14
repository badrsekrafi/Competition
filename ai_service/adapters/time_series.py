from __future__ import annotations

from .base import ModelAdapter


class Chronos2Adapter(ModelAdapter):
    id = "chronos-2"
    name = "Amazon Chronos-2"
    role = "Zero-shot multivariate forecasting for vital signs over 5/10/15 minutes."
    source = "https://huggingface.co/amazon/chronos-2"
    required_packages = ("torch", "transformers")
    next_step = "Install torch + transformers, then load amazon/chronos-2 for forecast replacement."


class MomentAdapter(ModelAdapter):
    id = "moment"
    name = "MOMENT"
    role = "Time-series forecasting, imputation, classification and anomaly detection."
    source = "https://github.com/moment-timeseries-foundation-model/moment"
    required_packages = ("torch", "transformers")
    next_step = "Install MOMENT dependencies and map telemetry windows to model channels."
