import sys
from sqlalchemy.exc import OperationalError

# Adiciona a pasta raiz do projeto ao path do Python.
# Isto permite que o script encontre e importe os módulos da pasta 'app'.
sys.path.append('.')

# Importa o 'engine' da base de dados e a 'Base' dos modelos.
# É crucial que estes imports aconteçam depois de adicionar o path acima.
from app.database import engine
from app.models import Base




def drop_tables():
    """Apaga todas as tabelas definidas nos seus modelos (Base.metadata)."""
    print("A tentar apagar todas as tabelas...")
    try:
        Base.metadata.drop_all(bind=engine)
        print("✅ Tabelas apagadas com sucesso.")
    except OperationalError as e:
        print(f"⚠️  Não foi possível apagar as tabelas. Pode ser que não existam. Erro: {e}")
    except Exception as e:
        print(f"❌ Ocorreu um erro inesperado ao apagar as tabelas: {e}")

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
    print("   da sua base de dados (utilizadores, grupos, transações, etc.).")
    print("   Esta ação é IRREVERSÍVEL.\n")
    
    # Pede a confirmação do utilizador para continuar.
    choice = input("Tem a certeza absoluta que quer continuar? (digite 'sim' para confirmar): ")
    
    if choice.lower() == 'sim':
        print("\n--- A iniciar processo de reinicialização ---")
        drop_tables()
        print("\n🎉 Base de dados reiniciada com sucesso!")
    else:
        print("\n❌ Operação cancelada pelo utilizador.")

