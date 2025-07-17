from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.ext.declarative import declarative_base

# Importa as configurações, principalmente a DATABASE_URL.
# O ponto antes de 'config' indica que estamos importando de um arquivo
# no mesmo diretório (dentro da pasta 'app').
from .config import settings

# Cria a URL de conexão com o banco de dados a partir das configurações.
SQLALCHEMY_DATABASE_URL = settings.DATABASE_URL

# O 'engine' é o ponto de entrada principal para o banco de dados.
# Ele gerencia as conexões e a comunicação com o PostgreSQL.
# O argumento connect_args é específico para o SQLite, aqui está comentado
# pois estamos usando PostgreSQL.
engine = create_engine(
    SQLALCHEMY_DATABASE_URL
    # Para SQLite, seria:
    # SQLALCHEMY_DATABASE_URL = "sqlite:///./sql_app.db"
    # engine = create_engine(
    #     SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
    # )
)

# Cria uma "fábrica" de sessões. Cada instância de SessionLocal será uma
# nova sessão de banco de dados. Esta é a forma padrão de configurar
# sessões no SQLAlchemy.
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# A Base declarativa que será usada pelos nossos modelos em models.py.
# Embora já a tenhamos em models.py, é uma boa prática tê-la aqui também
# para referência e para a função de criação das tabelas.
Base = declarative_base()


def get_db():
    """
    Função de dependência do FastAPI para gerenciar as sessões do banco de dados.
    - Cria uma nova sessão para cada requisição.
    - Fornece (yield) a sessão para o endpoint.
    - Garante que a sessão seja sempre fechada ao final da requisição,
      mesmo que ocorra um erro.
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

