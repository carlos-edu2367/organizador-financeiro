import os
import sys
import getpass
from sqlalchemy.orm import Session

# Adiciona o diretório raiz ao path para permitir a importação dos módulos da aplicação
sys.path.append(os.path.abspath(os.path.dirname(__file__)))

from app import models, security, database
from app.models import Colaborador, CargoColaboradorEnum

def create_admin_user():
    """
    Script interativo para criar um novo colaborador com cargo de administrador.
    """
    print("--- Criação de Usuário Administrador Clarify ---")
    
    db: Session = next(database.get_db())

    try:
        # --- Coleta de Informações ---
        nome = input("Nome completo do administrador: ").strip()
        email = input("E-mail do administrador: ").strip().lower()
        cpf = input("CPF do administrador (apenas números): ").strip()

        if not all([nome, email, cpf]):
            print("\n[ERRO] Nome, e-mail e CPF são campos obrigatórios.")
            return

        # --- Validação de Existência ---
        existing_user = db.query(Colaborador).filter(
            (Colaborador.email == email) | (Colaborador.cpf == cpf)
        ).first()
        
        if existing_user:
            print(f"\n[ERRO] Já existe um colaborador com este e-mail ou CPF.")
            return

        # --- Coleta e Confirmação de Senha ---
        while True:
            senha = getpass.getpass("Digite a senha do administrador: ")
            confirmar_senha = getpass.getpass("Confirme a senha: ")
            
            if senha == confirmar_senha:
                if len(senha) < 6:
                    print("\n[AVISO] A senha deve ter no mínimo 6 caracteres.")
                else:
                    break
            else:
                print("\n[ERRO] As senhas não coincidem. Tente novamente.")

        # --- Criação do Colaborador ---
        hashed_password = security.get_password_hash(senha)

        novo_admin = Colaborador(
            nome=nome,
            email=email,
            cpf=cpf,
            senha=hashed_password,
            cargo=CargoColaboradorEnum.adm,
            sexo="Não informado",
            endereco="Não informado"
        )

        db.add(novo_admin)
        db.commit()

        print("\n[SUCESSO] Usuário administrador criado com sucesso!")
        print(f"  Nome: {novo_admin.nome}")
        print(f"  E-mail: {novo_admin.email}")
        print(f"  Cargo: {novo_admin.cargo.value}")

    except Exception as e:
        print(f"\n[ERRO FATAL] Ocorreu um erro inesperado: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    create_admin_user()
