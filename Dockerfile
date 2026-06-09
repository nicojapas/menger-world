FROM python:3.12-slim

WORKDIR /app

# Install system dependencies (including those for piper-tts)
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libespeak-ng1 \
    && rm -rf /var/lib/apt/lists/*

# Copy and install Python requirements
COPY agent/requirements.txt .
# Install deps, but don't fail if piper-tts has issues (optional)
RUN pip install --no-cache-dir -r requirements.txt || \
    (grep -v piper-tts requirements.txt > requirements-fallback.txt && \
     pip install --no-cache-dir -r requirements-fallback.txt)

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
