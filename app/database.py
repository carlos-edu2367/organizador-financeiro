from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.ext.declarative import declarative_base

from .config import settings

# Cria a URL de conexão com o banco de dados a partir das configurações.
SQLALCHEMY_DATABASE_URL = settings.DATABASE_URL

# (ALTERADO) Adiciona uma verificação para garantir compatibilidade com o Railway
if SQLALCHEMY_DATABASE_URL and SQLALCHEMY_DATABASE_URL.startswith("postgres://"):
    SQLALCHEMY_DATABASE_URL = SQLALCHEMY_DATABASE_URL.replace("postgres://", "postgresql://", 1)


engine = create_engine(
    SQLALCHEMY_DATABASE_URL
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def get_db():
    """
    Função de dependência do FastAPI para gerenciar as sessões do banco de dados.
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
