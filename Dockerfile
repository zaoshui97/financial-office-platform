# 后端基础镜像：Python 3.12 slim（兼容 pyproject 中 requires-python >=3.11,<3.14）
FROM python:3.12-slim AS base

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    TZ=Asia/Shanghai

# 系统依赖：default-libmysqlclient-dev + gcc 用于 PyMySQL/SQLAlchemy
# tesseract-ocr + chi_sim/eng 语言包用于 PDF 本地 OCR 回退（可选，默认关闭）
RUN sed -i 's|deb.debian.org|mirrors.aliyun.com|g; s|security.debian.org|mirrors.aliyun.com|g' /etc/apt/sources.list.d/debian.sources 2>/dev/null \
 || sed -i 's|deb.debian.org|mirrors.aliyun.com|g; s|security.debian.org|mirrors.aliyun.com|g' /etc/apt/sources.list 2>/dev/null \
 || true
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        build-essential \
        default-libmysqlclient-dev \
        pkg-config \
        tesseract-ocr \
        tesseract-ocr-chi-sim \
        tesseract-ocr-eng \
        tzdata \
    && ln -snf /usr/share/zoneinfo/$TZ /etc/localtime \
    && echo $TZ > /etc/timezone \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /srv/app

# 先装依赖，利用 Docker 层缓存
COPY requirements.txt ./
RUN pip config set global.index-url https://mirrors.aliyun.com/pypi/simple/ \
    && pip config set global.trusted-host mirrors.aliyun.com \
    && pip install --upgrade pip \
    && pip install -r requirements.txt

# 再拷代码
COPY app ./app
COPY alembic ./alembic
COPY alembic.ini ./alembic.ini
COPY pyproject.toml ./pyproject.toml

# 创建存储与日志目录
RUN mkdir -p /srv/app/storage/uploads /srv/app/logs

# 非 root 运行
RUN useradd --create-home --uid 10001 appuser \
    && chown -R appuser:appuser /srv/app
USER appuser

# 健康检查走 system 端口 readiness（依赖 MySQL，需等迁移完成才有意义）
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
    CMD python -c "import urllib.request, sys; \
sys.exit(0) if urllib.request.urlopen('http://127.0.0.1:8000/api/v1/system/health/live', timeout=3).status == 200 else -1"

EXPOSE 8000

# 默认入口：跑迁移 → 启 uvicorn。
# 如果不需要自动迁移，可启动容器时覆盖 CMD 为 ["uvicorn", "app.main:app", ...]
CMD ["sh", "./scripts/start.sh"]