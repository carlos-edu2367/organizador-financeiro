from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func, extract
from datetime import datetime, timedelta, date
from typing import List

from .. import database, schemas, models, security

router = APIRouter(
    prefix="/collaborators",
    tags=['Collaborators']
)

# Helper para verificar se o colaborador é um administrador
def require_admin(current_user: models.Colaborador = Depends(security.get_current_collaborator)):
    """
    Verifica se o usuário autenticado é um administrador.
    Levanta uma HTTPException 403 se o cargo não for 'adm'.
    """
    if current_user.cargo != models.CargoColaboradorEnum.adm:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Acesso restrito a administradores.")
    return current_user

@router.post("/token", response_model=schemas.Token)
def login_for_access_token(form_data: schemas.ColaboradorLogin, db: Session = Depends(database.get_db)):
    """
    Endpoint para login de colaboradores.
    Autentica o colaborador e retorna um token JWT.
    """
    colaborador = db.query(models.Colaborador).filter(
        (models.Colaborador.email == form_data.login) | (models.Colaborador.cpf == form_data.login)
    ).first()

    # Verifica se o colaborador existe e se a senha está correta
    if not colaborador or not security.verify_password(form_data.senha, colaborador.senha):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Login ou senha incorretos",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Adiciona o cargo ao payload do token para uso no frontend e em validações futuras no backend
    # INÍCIO DA ALTERAÇÃO: Passando is_collaborator=True para usar o tempo de expiração correto
    access_token = security.create_access_token(
        data={"sub": str(colaborador.id), "scope": "collaborator", "cargo": colaborador.cargo.value},
        is_collaborator=True
    )
    # FIM DA ALTERAÇÃO
    
    return {"access_token": access_token, "token_type": "bearer"}


@router.get("/dashboard/stats", response_model=schemas.DashboardStats)
def get_dashboard_stats(db: Session = Depends(database.get_db), admin: models.Colaborador = Depends(require_admin)):
    """ 
    Retorna as estatísticas gerais para os cards do topo do dashboard do administrador.
    Requer privilégios de administrador.
    """
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
    Filtra por período: semana (últimos 7 dias), mês (últimos 30 dias), ano (últimos 12 meses).
    Requer privilégios de administrador.
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
            # Lógica para iterar sobre os últimos 12 meses
            target_date = today - timedelta(days=i*30) # Aproximação
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

# --- Endpoints de Suporte ---

@router.get("/support/tickets", response_model=List[schemas.SuporteChamado])
def get_all_tickets(db: Session = Depends(database.get_db), current_user: models.Colaborador = Depends(security.get_current_collaborator)):
    """ 
    Lista todos os chamados de suporte abertos.
    Acessível por qualquer colaborador, mas a lógica de atribuição pode ser adicionada aqui.
    """
    tickets = db.query(models.SuporteChamado).options(
        joinedload(models.SuporteChamado.usuario),
        joinedload(models.SuporteChamado.atribuido_a)
    ).filter(models.SuporteChamado.status == 'aberto').order_by(models.SuporteChamado.criado_em.asc()).all()
    
    # Formata a resposta para corresponder ao schema
    response = []
    for ticket in tickets:
        response.append({
            "id": ticket.id, "titulo": ticket.titulo, "descricao": ticket.descricao,
            "status": ticket.status, "prioridade": ticket.prioridade, "criado_em": ticket.criado_em,
            "nome_usuario": ticket.usuario.nome, "email_usuario": ticket.usuario.email,
            "resolvido_por": ticket.atribuido_a.nome if ticket.atribuido_a else None
        })
    return response

@router.put("/support/tickets/{ticket_id}/complete", response_model=schemas.SuporteChamado)
def complete_ticket(
    ticket_id: str, 
    db: Session = Depends(database.get_db), 
    current_user: models.Colaborador = Depends(security.get_current_collaborator)
):
    """ 
    Marca um chamado de suporte como concluído.
    Qualquer colaborador pode concluir um chamado.
    """
    ticket = db.query(models.SuporteChamado).options(joinedload(models.SuporteChamado.usuario)).filter(models.SuporteChamado.id == ticket_id).first()
    if not ticket:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Chamado não encontrado.")
    
    ticket.status = 'concluido'
    ticket.colaborador_id = current_user.id # Atribui o chamado ao colaborador que o concluiu
    ticket.atualizado_em = datetime.utcnow()
    db.commit()
    db.refresh(ticket)
    
    return {
        "id": ticket.id, "titulo": ticket.titulo, "descricao": ticket.descricao,
        "status": ticket.status, "prioridade": ticket.prioridade, "criado_em": ticket.criado_em,
        "nome_usuario": ticket.usuario.nome, "email_usuario": ticket.usuario.email,
        "resolvido_por": current_user.nome
    }

@router.get("/support/stats", response_model=List[schemas.SuporteStats])
def get_support_stats(db: Session = Depends(database.get_db), admin: models.Colaborador = Depends(require_admin)):
    """ 
    Retorna estatísticas de chamados resolvidos por cada colaborador.
    Requer privilégios de administrador.
    """
    collaborators = db.query(models.Colaborador).options(
        joinedload(models.Colaborador.chamados_atribuidos)
    ).all()
    
    stats = []
    for c in collaborators:
        # Filtra apenas os chamados concluídos e ordena pelos mais recentes
        resolved_tickets = [t for t in c.chamados_atribuidos if t.status == 'concluido']
        sorted_tickets = sorted(resolved_tickets, key=lambda x: x.atualizado_em, reverse=True)
        
        tickets_info = [
            {"id": t.id, "titulo": t.titulo, "data_resolucao": t.atualizado_em} 
            for t in sorted_tickets
        ]
        stats.append({
            "colaborador_id": c.id,
            "nome_colaborador": c.nome,
            "tickets_resolvidos": tickets_info
        })
    return stats

