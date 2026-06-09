FROM python:3.12-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Copy and install Python requirements
COPY agent/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy agent code
COPY agent/ ./agent/

# Copy frontend to static directory
COPY index.html config.js main.js ./static/
COPY src/ ./static/src/
COPY loops/ ./static/loops/

# Set working directory to agent
WORKDIR /app/agent

# Expose port
EXPOSE 8765

# Run server
CMD ["python", "server.py"]
