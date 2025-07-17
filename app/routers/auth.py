from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from .. import database, schemas, models, security

# Cria um novo "roteador". Ele funciona como uma mini-aplicação FastAPI.
router = APIRouter(
    tags=['Authentication'] # Agrupa os endpoints na documentação interativa.
)

@router.post("/register", response_model=schemas.User)
def create_user(user: schemas.UserCreate, db: Session = Depends(database.get_db)):
    """
    Endpoint para registrar um novo usuário.
    """
    # Verifica se o e-mail já existe no banco.
    db_user = db.query(models.Usuario).filter(models.Usuario.email == user.email).first()
    if db_user:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,
                            detail="E-mail já registrado.")

    # Gera o hash da senha antes de salvar.
    hashed_password = security.get_password_hash(user.senha)
    
    # Cria o novo usuário no banco de dados.
    db_user = models.Usuario(email=user.email, nome=user.nome, senha=hashed_password)
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    
    return db_user


@router.post("/token", response_model=schemas.Token)
def login_for_access_token(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(database.get_db)):
    """
    Endpoint para login. Recebe e-mail (no campo username) e senha.
    """
    user = db.query(models.Usuario).filter(models.Usuario.email == form_data.username).first()

    # Verifica se o usuário existe e se a senha está correta.
    if not user or not security.verify_password(form_data.password, user.senha):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="E-mail ou senha incorretos",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Cria o token de acesso.
    access_token = security.create_access_token(
        data={"sub": user.email}
    )
    
    return {"access_token": access_token, "token_type": "bearer"}

