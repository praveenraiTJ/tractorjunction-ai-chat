@echo off
echo Starting ChromaDB server...

REM Check if Docker is available
docker --version >nul 2>&1
if %errorlevel% neq 0 (
    echo Docker not found. Trying to start ChromaDB with Python...
    python -m chromadb run --host localhost --port 8000
) else (
    echo Starting ChromaDB with Docker...
    docker-compose -f docker-compose.chromadb.yml up -d
    echo ChromaDB started. You can check status with: docker-compose -f docker-compose.chromadb.yml ps
)

echo.
echo ChromaDB should be available at http://localhost:8000
echo To stop ChromaDB, run: docker-compose -f docker-compose.chromadb.yml down
pause
