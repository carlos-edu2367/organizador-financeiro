import os
import psycopg2
from dotenv import load_dotenv

# Carrega as variáveis do .env
load_dotenv()
db_url = os.getenv("DATABASE_URL")

if not db_url:
    raise ValueError("DATABASE_URL não encontrado no .env")

try:
    # Conecta ao banco
    conn = psycopg2.connect(db_url)
    cursor = conn.cursor()

    # Comando ALTER TABLE
    comando = """
    -- Adiciona as duas novas colunas à tabela 'usuarios'
    -- Elas são criadas como NULLABLE, o que é seguro para tabelas com dados existentes.
    ALTER TABLE usuarios
    ADD COLUMN reset_token_expires TIMESTAMP WITH TIME ZONE;

    -- Adiciona um índice único na nova coluna 'reset_token' para garantir
    -- que os tokens não se repitam e para otimizar as buscas.
    CREATE UNIQUE INDEX ix_usuarios_reset_token ON usuarios (reset_token);
    """
    cursor.execute(comando)
    conn.commit()

    print("Coluna 'reset_token' adicionada com sucesso à tabela 'usuarios'.")

except Exception as e:
    print("Erro ao alterar a tabela:", e)

finally:
    if cursor:
        cursor.close()
    if conn:
        conn.close()
