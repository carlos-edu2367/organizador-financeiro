import sys
from sqlalchemy.exc import OperationalError, ProgrammingError
from sqlalchemy import text

# Adiciona a pasta raiz do projeto ao path do Python.
# Isto permite que o script encontre e importe os módulos da pasta 'app'.
sys.path.append('.')

# Importa o 'engine' da base de dados e a 'Base' dos modelos.
# É crucial que estes imports aconteçam depois de adicionar o path acima.
from app.database import engine
from app.models import Base

def reset_schema():
    """
    Apaga todo o schema 'public' em cascata e o recria.
    Esta é a forma mais robusta de garantir um reset completo.
    """
    print("A tentar apagar o schema 'public' em cascata...")
    try:
        # Conecta-se à base de dados para executar comandos SQL diretos.
        with engine.connect() as connection:
            # Inicia uma transação.
            trans = connection.begin()
            try:
                # Executa os comandos SQL para apagar e recriar o schema.
                connection.execute(text("DROP SCHEMA public CASCADE;"))
                connection.execute(text("CREATE SCHEMA public;"))
                # Confirma a transação.
                trans.commit()
                print("✅ Schema 'public' reiniciado com sucesso.")
            except (OperationalError, ProgrammingError) as e:
                # Se der erro, desfaz a transação.
                trans.rollback()
                print(f"⚠️  Não foi possível reiniciar o schema. Erro: {e}")

    except Exception as e:
        print(f"❌ Ocorreu um erro inesperado ao conectar-se à base de dados: {e}")

def create_tables():
    """Cria todas as tabelas de novo, com a estrutura mais recente dos seus modelos."""
    print("A tentar criar todas as tabelas...")
    try:
        Base.metadata.create_all(bind=engine)
        print("✅ Tabelas criadas com sucesso.")
    except Exception as e:
        print(f"❌ Ocorreu um erro inesperado ao criar as tabelas: {e}")

if __name__ == "__main__":
    print("--------------------------------------------------")
    print("  SCRIPT PARA REINICIAR A BASE DE DADOS CLARIFY   ")
    print("--------------------------------------------------")
    print("\n⚠️  ATENÇÃO: Este script irá apagar TODOS os dados")
    print("   da sua base de dados (usuários, grupos, transações, etc.).")
    print("   Esta ação é IRREVERSÍVEL.\n")
    
    # Pede a confirmação do utilizador para continuar.
    choice = input("Você tem certeza absoluta que quer continuar? (digite 'sim' para confirmar): ")
    
    if choice.lower() == 'sim':
        print("\n--- Iniciando processo de reinicialização ---")
        # Chama a nova função de reset.
        reset_schema()
        # A função de criar tabelas continua a ser necessária para recriá-las no schema limpo.
        create_tables()
        print("\n🎉 Base de dados reiniciada com sucesso!")
    else:
        print("\n❌ Operação cancelada pelo usuário.")
