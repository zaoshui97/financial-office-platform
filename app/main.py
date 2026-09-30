"""ASGI 入口：仅暴露由应用工厂创建的 FastAPI 实例。"""

from app.bootstrap import create_app

app = create_app()
