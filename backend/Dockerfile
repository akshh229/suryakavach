FROM python:3.11-slim

WORKDIR /app
COPY backend/requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r requirements.txt
COPY backend/suryakavach /app/suryakavach
COPY config.yaml /app/config.yaml

ENV PYTHONUNBUFFERED=1
ENV PYTHONPATH=/app
ENV PORT=8000
EXPOSE 8000
CMD ["sh", "-c", "exec uvicorn suryakavach.api:app --host 0.0.0.0 --port ${PORT:-8000}"]
