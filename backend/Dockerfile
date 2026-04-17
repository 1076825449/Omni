FROM python:3.11-slim

WORKDIR /app

# 安装依赖
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# psycopg2 for PostgreSQL support
RUN pip install --no-cache-dir psycopg2-binary

# 复制代码
COPY . .

# 创建数据目录
RUN mkdir -p /app/uploads /app/backups

EXPOSE 3000

# 默认使用 SQLite，DATABASE_URL 为空时回退
ENV DATABASE_URL=""
ENV SECRET_KEY=dev-secret-key
ENV CORS_ORIGINS=http://localhost:5173,http://localhost:3000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "3000"]
