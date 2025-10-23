from abc import ABC, abstractmethod

class BaseDriver(ABC):

    @abstractmethod
    def read(self, config: dict) -> dict | None:
        pass