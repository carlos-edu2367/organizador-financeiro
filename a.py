import os
import psycopg2
from dotenv import load_dotenv

# Carregar .env
load_dotenv()
db_url = os.getenv("DATABASE_URL")

if not db_url:
    raise ValueError("DATABASE_URL não encontrado no .env")

try:
    conn = psycopg2.connect(db_url)
    cursor = conn.cursor()

    comando = """
    ALTER TABLE usuarios
    ADD COLUMN failed_login_attempts INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN locked_until TIMESTAMPTZ;
    """
    cursor.execute(comando)
    conn.commit()

    print("Colunas adicionadas com sucesso à tabela 'usuarios'.")

except Exception as e:
    print("Erro ao alterar a tabela:", e)

finally:
    if cursor:
        cursor.close()
    if conn:
        conn.close()
