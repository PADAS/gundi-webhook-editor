FROM python:3.12-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    libjq-dev gcc libonig-dev && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

ARG APP_VERSION=dev
ARG BUILD_SHA=local
ARG BUILD_TIME=unknown
ENV APP_VERSION=$APP_VERSION
ENV BUILD_SHA=$BUILD_SHA
ENV BUILD_TIME=$BUILD_TIME

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

CMD uvicorn app:app --host 0.0.0.0 --port ${PORT:-8080} --proxy-headers --forwarded-allow-ips='*'
