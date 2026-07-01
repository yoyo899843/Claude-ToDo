from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_name: str = "Claude Todo"
    database_url: str = "postgresql+psycopg://todo:todo@db:5432/todoapp"
    cors_origins: str = ""
    secret_key: str = "dev-secret-change-in-production"

    @property
    def cors_origin_list(self) -> list[str]:
        return [
            origin.strip()
            for origin in self.cors_origins.split(",")
            if origin.strip() and origin.strip() != "*"
        ]


@lru_cache
def get_settings() -> Settings:
    return Settings()