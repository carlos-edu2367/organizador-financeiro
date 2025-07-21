from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, extract, case
from datetime import datetime, timedelta, date
from typing import List
import calendar

from .. import database, schemas, models, security

router = APIRouter(
    prefix="/collaborators",
    tags=['Collaborators']
)

# Helper para verificar se o colaborador é um administrador
def require_admin(current_user: models.Colaborador = Depends(security.get_current_collaborator)):
    if current_user.cargo != models.CargoColaboradorEnum.adm:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Acesso restrito a administradores.")
    return current_user

@router.post("/token", response_model=schemas.Token)
def login_for_access_token(form_data: schemas.ColaboradorLogin, db: Session = Depends(database.get_db)):
    # ... (código de login existente, sem alterações)
    colaborador = db.query(models.Colaborador).filter(
        (models.Colaborador.email == form_data.login) | (models.Colaborador.cpf == form_data.login)
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
def get_dashboard_stats(db: Session = Depends(database.get_db), admin: models.Colaborador = Depends(require_admin)):
    """ Retorna as estatísticas gerais para os cards do topo do dashboard. """
    total_usuarios = db.query(models.Usuario).count()
    
    # Conta assinaturas ativas
    total_premium = db.query(models.Assinatura).filter(models.Assinatura.data_fim > datetime.utcnow()).count()

    return {
        "total_usuarios": total_usuarios,
        "total_premium": total_premium,
    }

@router.get("/dashboard/chart-data", response_model=schemas.DashboardChartData)
def get_chart_data(
    period: str = Query("mes", enum=["semana", "mes", "ano"]), 
    db: Session = Depends(database.get_db), 
    admin: models.Colaborador = Depends(require_admin)
):
    """
    Retorna dados agregados para os gráficos do dashboard do colaborador.
    - semana: Últimos 7 dias.
    - mes: Últimos 30 dias.
    - ano: Últimos 12 meses.
    """
    today = date.today()
    data_points = []

    if period == "semana":
        start_date = today - timedelta(days=6)
        date_range = [start_date + timedelta(days=x) for x in range(7)]
        
        new_users = db.query(
            func.date(models.Usuario.criado_em),
            func.count(models.Usuario.id)
        ).filter(
            func.date(models.Usuario.criado_em).between(start_date, today)
        ).group_by(func.date(models.Usuario.criado_em)).all()
        
        new_premiums = db.query(
            func.date(models.Assinatura.criado_em),
            func.count(models.Assinatura.id)
        ).filter(
            func.date(models.Assinatura.criado_em).between(start_date, today)
        ).group_by(func.date(models.Assinatura.criado_em)).all()
        
        users_map = {d: c for d, c in new_users}
        premiums_map = {d: c for d, c in new_premiums}

        for day in date_range:
            data_points.append({
                "label": day.strftime("%d/%m"),
                "new_users": users_map.get(day, 0),
                "new_premiums": premiums_map.get(day, 0)
            })

    elif period == "mes":
        start_date = today - timedelta(days=29)
        date_range = [start_date + timedelta(days=x) for x in range(30)]
        
        new_users = db.query(
            func.date(models.Usuario.criado_em),
            func.count(models.Usuario.id)
        ).filter(
            func.date(models.Usuario.criado_em).between(start_date, today)
        ).group_by(func.date(models.Usuario.criado_em)).all()
        
        new_premiums = db.query(
            func.date(models.Assinatura.criado_em),
            func.count(models.Assinatura.id)
        ).filter(
            func.date(models.Assinatura.criado_em).between(start_date, today)
        ).group_by(func.date(models.Assinatura.criado_em)).all()

        users_map = {d: c for d, c in new_users}
        premiums_map = {d: c for d, c in new_premiums}

        for day in date_range:
            data_points.append({
                "label": day.strftime("%d/%m"),
                "new_users": users_map.get(day, 0),
                "new_premiums": premiums_map.get(day, 0)
            })

    elif period == "ano":
        meses_pt = {1: "Jan", 2: "Fev", 3: "Mar", 4: "Abr", 5: "Mai", 6: "Jun", 7: "Jul", 8: "Ago", 9: "Set", 10: "Out", 11: "Nov", 12: "Dez"}
        
        for i in range(11, -1, -1):
            target_date = today - timedelta(days=i*30)
            year, month = target_date.year, target_date.month

            users_count = db.query(func.count(models.Usuario.id)).filter(
                extract('year', models.Usuario.criado_em) == year,
                extract('month', models.Usuario.criado_em) == month
            ).scalar() or 0
            
            premiums_count = db.query(func.count(models.Assinatura.id)).filter(
                extract('year', models.Assinatura.criado_em) == year,
                extract('month', models.Assinatura.criado_em) == month
            ).scalar() or 0

            data_points.append({
                "label": f"{meses_pt[month]}/{str(year)[2:]}",
                "new_users": users_count,
                "new_premiums": premiums_count
            })

    return {"data": data_points}
