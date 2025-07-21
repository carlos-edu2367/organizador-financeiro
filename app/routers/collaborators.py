from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from sqlalchemy import or_, func
from datetime import datetime, timedelta

# CORREÇÃO: A importação relativa foi ajustada de '...' para '..'
from .. import database, schemas, models, security

router = APIRouter(
    prefix="/collaborators",
    tags=['Collaborators']
)

@router.post("/token", response_model=schemas.Token)
def login_for_access_token(form_data: schemas.ColaboradorLogin, db: Session = Depends(database.get_db)):
    colaborador = db.query(models.Colaborador).filter(
        or_(models.Colaborador.email == form_data.login, models.Colaborador.cpf == form_data.login)
    ).first()

    if not colaborador or not security.verify_password(form_data.senha, colaborador.senha):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Login ou senha incorretos",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    access_token = security.create_access_token(
        data={"sub": str(colaborador.id), "scope": "collaborator"}
    )
    
    return {"access_token": access_token, "token_type": "bearer"}

@router.get("/dashboard/stats", response_model=schemas.DashboardStats)
def get_dashboard_stats(db: Session = Depends(database.get_db), current_user: models.Colaborador = Depends(security.get_current_collaborator)):
    if current_user.cargo != models.CargoColaboradorEnum.adm:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Acesso não permitido.")

    total_usuarios = db.query(models.Usuario).count()
    total_premium = db.query(models.Grupo).filter(models.Grupo.plano == 'premium').count()
    
    today = datetime.utcnow().date()
    start_of_week = today - timedelta(days=today.weekday())
    start_of_month = today.replace(day=1)

    novos_hoje = db.query(models.Usuario).filter(func.date(models.Usuario.criado_em) == today).count()
    novos_semana = db.query(models.Usuario).filter(func.date(models.Usuario.criado_em) >= start_of_week).count()
    novos_mes = db.query(models.Usuario).filter(func.date(models.Usuario.criado_em) >= start_of_month).count()

    return {
        "total_usuarios": total_usuarios,
        "total_premium": total_premium,
        "novos_hoje": novos_hoje,
        "novos_semana": novos_semana,
        "novos_mes": novos_mes
    }
