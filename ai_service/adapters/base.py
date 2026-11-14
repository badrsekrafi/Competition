from __future__ import annotations

from dataclasses import dataclass
from importlib.util import find_spec


@dataclass(frozen=True)
class AdapterStatus:
    id: str
    name: str
    role: str
    source: str
    required_packages: tuple[str, ...]
    available: bool
    dependencies_ready: bool
    implemented: bool
    status: str
    next_step: str

    def to_dict(self) -> dict[str, object]:
        return {
            "id": self.id,
            "name": self.name,
            "role": self.role,
            "source": self.source,
            "requiredPackages": list(self.required_packages),
            "available": self.available,
            "dependenciesReady": self.dependencies_ready,
            "implemented": self.implemented,
            "status": self.status,
            "nextStep": self.next_step,
        }


class ModelAdapter:
    id = ""
    name = ""
    role = ""
    source = ""
    required_packages: tuple[str, ...] = ()
    next_step = ""
    implemented = False

    def dependencies_ready(self) -> bool:
        return all(find_spec(package) is not None for package in self.required_packages)

    def available(self) -> bool:
        return self.implemented and self.dependencies_ready()

    def status(self) -> AdapterStatus:
        ready = self.available()
        deps_ready = self.dependencies_ready()
        status = "ready" if ready else "adapter-scaffold" if deps_ready else "not-installed"
        return AdapterStatus(
            id=self.id,
            name=self.name,
            role=self.role,
            source=self.source,
            required_packages=self.required_packages,
            available=ready,
            dependencies_ready=deps_ready,
            implemented=self.implemented,
            status=status,
            next_step="Adapter can be wired to inference." if ready else self.next_step,
        )
