import os
from dotenv import load_dotenv

# Carrega as variáveis de ambiente do arquivo .env
load_dotenv()

class Settings:
    """
    Classe para centralizar as configurações da aplicação.
    Ela lê as variáveis do ambiente, garantindo que as configurações
    estejam disponíveis de forma organizada em todo o projeto.
    """
    # URL de conexão com o banco de dados PostgreSQL.
    DATABASE_URL: str = os.getenv("DATABASE_URL")

    # Chave secreta para a criação e validação de tokens JWT.
    SECRET_KEY: str = os.getenv("SECRET_KEY")
    
    # (NOVO) Adiciona a chave da API do Gemini a partir do .env
    GEMINI_API_KEY: str = os.getenv("GEMINI_API_KEY")
    
    # Algoritmo usado para assinar o JWT.
    ALGORITHM: str = "HS256"
    
    # Tempo de expiração do token de acesso em minutos.
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 # 24 horas

# Instancia as configurações para que possam ser importadas em outros arquivos.
settings = Settings()

# Verificações para ajudar na depuração
if settings.DATABASE_URL is None:
    print("⚠️  Atenção: A variável de ambiente DATABASE_URL não foi definida no seu ficheiro .env.")

if settings.GEMINI_API_KEY is None:
    print("⚠️  Atenção: A variável de ambiente GEMINI_API_KEY não foi definida no seu ficheiro .env.")
