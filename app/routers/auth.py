from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from datetime import datetime, timedelta, timezone
import secrets

from .. import database, schemas, models, security
from ..utils import send_email_with_template # Importa a nova função de envio de e-mail

router = APIRouter(
    prefix="/api",
    tags=['Authentication']
)

def generate_recovery_code():
    """Gera um código numérico seguro de 6 dígitos."""
    return str(secrets.randbelow(1_000_000)).zfill(6)

@router.post("/register", response_model=schemas.User)
def create_user(user: schemas.UserCreate, db: Session = Depends(database.get_db)):
    # ... (código de registro existente, sem alterações)
    db_user = db.query(models.Usuario).filter(models.Usuario.email == user.email).first()
    if db_user:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="E-mail já registado.")
    hashed_password = security.get_password_hash(user.senha)
    db_user = models.Usuario(email=user.email, nome=user.nome, senha=hashed_password)
    new_group = models.Grupo(nome=f"Grupo de {user.nome}")
    association = models.GrupoMembro(grupo=new_group, papel='dono')
    db_user.associacoes_grupo.append(association)
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user

@router.post("/token", response_model=schemas.Token)
def login_for_access_token(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(database.get_db)):
    # ... (código de login existente, sem alterações)
    user = db.query(models.Usuario).filter(models.Usuario.email == form_data.username).first()
    if not user or not security.verify_password(form_data.password, user.senha):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="E-mail ou senha incorretos", headers={"WWW-Authenticate": "Bearer"})
    access_token = security.create_access_token(data={"sub": user.email})
    return {"access_token": access_token, "token_type": "bearer"}

# --- INÍCIO DA ALTERAÇÃO: Endpoints de recuperação de senha ---

@router.post("/forgot-password")
def forgot_password(
    request: schemas.ForgotPasswordRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(database.get_db)
):
    user = db.query(models.Usuario).filter(models.Usuario.email == request.email).first()
    if user:
        recovery_code = generate_recovery_code()
        
        user.reset_token = recovery_code
        user.reset_token_expires = datetime.now(timezone.utc) + timedelta(minutes=30)
        db.commit()
        
        background_tasks.add_task(
            send_email_with_template,
            to_email=user.email,
            template_id="d-071823dc7d8f4f029320139679a5a977",
            template_data={
                "nome_usuario": user.nome,
                "codigo_recuperacao": recovery_code,
                "tempo_expiracao": "30 minutos"
            }
        )
    return {"message": "Se um usuário com este e-mail existir, um código de recuperação será enviado."}

@router.post("/verify-code")
def verify_code(request: schemas.VerifyCodeRequest, db: Session = Depends(database.get_db)):
    user = db.query(models.Usuario).filter(models.Usuario.email == request.email).first()
    if not user or user.reset_token != request.code or user.reset_token_expires < datetime.now(timezone.utc):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Código inválido ou expirado.")
    return {"message": "Código verificado com sucesso."}

@router.post("/reset-password")
def reset_password(request: schemas.ResetPasswordRequest, db: Session = Depends(database.get_db)):
    user = db.query(models.Usuario).filter(models.Usuario.email == request.email).first()
    if not user or user.reset_token != request.code or user.reset_token_expires < datetime.now(timezone.utc):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Código inválido ou expirado.")

    user.senha = security.get_password_hash(request.new_password)
    user.reset_token = None
    user.reset_token_expires = None
    db.commit()

    return {"message": "Senha redefinida com sucesso."}

# --- FIM DA ALTERAÇÃO ---
