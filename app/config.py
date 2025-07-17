import os
from dotenv import load_dotenv

# Carrega as variáveis de ambiente do arquivo .env
# Isso permite que você mantenha dados sensíveis (como a URL do banco)
# fora do seu código e do controle de versão.
load_dotenv()

class Settings:
    """
    Classe para centralizar as configurações da aplicação.
    Ela lê as variáveis do ambiente, garantindo que as configurações
    estejam disponíveis de forma organizada em todo o projeto.
    """
    # URL de conexão com o banco de dados PostgreSQL.
    # O formato esperado é: "postgresql://usuario:senha@host:porta/nome_do_banco"
    DATABASE_URL: str = os.getenv("DATABASE_URL")

    # Chave secreta para a criação e validação de tokens JWT (JSON Web Tokens).
    # É crucial para a segurança da autenticação.
    # Você pode gerar uma chave forte usando: openssl rand -hex 32
    SECRET_KEY: str = os.getenv("SECRET_KEY")
    
    # Algoritmo usado para assinar o JWT. HS256 é o padrão.
    ALGORITHM: str = "HS256"
    
    # Tempo de expiração do token de acesso em minutos.
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 # 24 horas

# Instancia as configurações para que possam ser importadas em outros arquivos.
# Ex: from .config import settings
settings = Settings()

# Verificação simples para garantir que a DATABASE_URL foi carregada.
# Em uma aplicação real, Pydantic (ou outra biblioteca) faria essa validação de forma mais robusta.
if settings.DATABASE_URL is None:
    print("⚠️  Atenção: A variável de ambiente DATABASE_URL não foi definida.")
    print("Crie um arquivo .env na raiz do projeto e adicione a linha:")
    print('DATABASE_URL="postgresql://user:password@host:port/database_name"')

