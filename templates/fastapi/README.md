# {{projectName}}

Modern Python API built with FastAPI, SQLAlchemy, and Pydantic.

## Getting Started

```bash
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload
```

## Features

- ⚡ FastAPI for high performance
- 🔐 JWT authentication
- 📝 Automatic API documentation
- 🗄️ SQLAlchemy ORM
- ✅ Pydantic data validation
- 🧪 Pytest for testing
- 🔄 Alembic for migrations

## API Documentation

Once running, visit:
- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

## Project Structure

```
app/
  ├── api/          # API endpoints
  ├── core/         # Core functionality
  ├── crud/         # Database operations
  ├── db/           # Database config
  ├── models/       # SQLAlchemy models
  └── schemas/      # Pydantic schemas
```
