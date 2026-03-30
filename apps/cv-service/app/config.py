from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    uploads_path: str = "./uploads"
    model_name: str = "depth-anything-v2-small"
    opening_model_path: str = "models/door-window-yolov8n.pt"
    host: str = "0.0.0.0"
    port: int = 8000

    class Config:
        env_prefix = ""
        case_sensitive = False


settings = Settings()
