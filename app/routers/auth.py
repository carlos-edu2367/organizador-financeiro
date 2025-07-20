from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from .. import database, schemas, models, security

router = APIRouter(
    # CORREÇÃO: Adicionando o prefixo diretamente aqui para maior clareza.
    prefix="/api",
    tags=['Authentication']
)

@router.post("/register", response_model=schemas.User)
def create_user(user: schemas.UserCreate, db: Session = Depends(database.get_db)):
    """
    Endpoint para registar um novo utilizador.
    Agora, também cria um grupo padrão para o utilizador e o define como 'dono'.
    """
    db_user = db.query(models.Usuario).filter(models.Usuario.email == user.email).first()
    if db_user:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,
                            detail="E-mail já registado.")

    hashed_password = security.get_password_hash(user.senha)
    
    # Cria o objeto do utilizador e do grupo
    db_user = models.Usuario(email=user.email, nome=user.nome, senha=hashed_password)
    new_group = models.Grupo(nome=f"Grupo de {user.nome}")
    
    # CORREÇÃO: Cria o objeto de associação e anexa-o explicitamente à lista
    # de associações do utilizador. Esta é a forma correta de construir o
    # relacionamento em memória antes de o guardar na base de dados.
    association = models.GrupoMembro(grupo=new_group, papel='dono')
    db_user.associacoes_grupo.append(association)

    # Adiciona o objeto principal (utilizador) à sessão.
    # Devido às configurações de 'cascade', o grupo e a associação
    # também serão guardados.
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    
    return db_user


@router.post("/token", response_model=schemas.Token)
def login_for_access_token(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(database.get_db)):
    user = db.query(models.Usuario).filter(models.Usuario.email == form_data.username).first()

    if not user or not security.verify_password(form_data.password, user.senha):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="E-mail ou senha incorretos",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    access_token = security.create_access_token(
        data={"sub": user.email}
    )
    
    return {"access_token": access_token, "token_type": "bearer"}
