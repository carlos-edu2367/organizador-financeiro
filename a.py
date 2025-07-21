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
    comando = """-- Cria a enumeração para o status do pagamento, se ainda não existir.
        -- Este bloco garante que o comando não falhe se o tipo já tiver sido criado.
        DO $$
        BEGIN
            IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'statuspagamentoenum') THEN
                CREATE TYPE statuspagamentoenum AS ENUM ('pendente', 'pago', 'atrasado');
            END IF;
        END$$;

        -- Cria a nova tabela para armazenar os pagamentos agendados
        CREATE TABLE pagamentos_agendados (
            id UUID PRIMARY KEY,
            grupo_id UUID NOT NULL REFERENCES grupos(id) ON DELETE CASCADE,
            titulo VARCHAR(100) NOT NULL,
            descricao TEXT,
            valor NUMERIC(10, 2),
            data_vencimento DATE NOT NULL,
            status statuspagamentoenum NOT NULL DEFAULT 'pendente',
            data_criacao TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            data_pagamento TIMESTAMP WITH TIME ZONE
        );

        -- Adiciona um índice na coluna grupo_id para otimizar as buscas
        CREATE INDEX ix_pagamentos_agendados_grupo_id ON pagamentos_agendados (grupo_id);
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
