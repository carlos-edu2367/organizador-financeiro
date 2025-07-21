import os
from dotenv import load_dotenv

# Carrega as variáveis de ambiente do arquivo .env
load_dotenv()

class Settings:
    """
    Classe para centralizar as configurações da aplicação.
    """
    # URL de conexão com o banco de dados PostgreSQL.
    DATABASE_URL: str = os.getenv("DATABASE_URL")

    # Chave secreta para a criação e validação de tokens JWT.
    SECRET_KEY: str = os.getenv("SECRET_KEY")
    
    # Chave da API do Gemini
    GEMINI_API_KEY: str = os.getenv("GEMINI_API_KEY")

    # --- INÍCIO DA ALTERAÇÃO ---
    # Chave da API do SendGrid e e-mail remetente
    SENDGRID_API_KEY: str = os.getenv("SENDGRID_API_KEY")
    SENDGRID_FROM_EMAIL: str = "clarifybr@gmail.com" # e-mail verificado no SendGrid
    # --- FIM DA ALTERAÇÃO ---
    
    # Algoritmo usado para assinar o JWT.
    ALGORITHM: str = "HS256"
    
    # Tempo de expiração do token de acesso em minutos.
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 # 24 horas

# Instancia as configurações para que possam ser importadas em outros arquivos.
settings = Settings()
