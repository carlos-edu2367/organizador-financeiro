from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func, extract # CORREÇÃO: 'func' é importado do pacote principal sqlalchemy
from typing import List
from decimal import Decimal
from datetime import datetime
from dateutil.relativedelta import relativedelta

from .. import database, schemas, models
from ..security import get_current_user_from_token

router = APIRouter(
    prefix="/groups",
    tags=['Groups, Goals & Charts'],
    dependencies=[Depends(get_current_user_from_token)]
)

@router.get("/{group_id}/dashboard", response_model=schemas.DashboardData)
def get_dashboard_data(group_id: str, db: Session = Depends(database.get_db), current_user: models.Usuario = Depends(get_current_user_from_token)):
    """
    Endpoint principal para obter todos os dados necessários para o dashboard.
    """
    group = db.query(models.Grupo).options(joinedload(models.Grupo.associacoes_membros).joinedload(models.GrupoMembro.usuario)).filter(models.Grupo.id == group_id).first()
    if not group:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Grupo não encontrado.")
    
    if current_user not in group.membros:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Acesso não permitido a este grupo.")

    movimentacoes = db.query(models.Movimentacao).filter(models.Movimentacao.grupo_id == group_id).order_by(models.Movimentacao.data_transacao.desc()).limit(30).all()
    movimentacoes_com_responsavel = []
    for mov in movimentacoes:
        movimentacoes_com_responsavel.append({
            "id": mov.id, "tipo": mov.tipo, "descricao": mov.descricao, "valor": mov.valor,
            "data_transacao": mov.data_transacao, "responsavel_nome": mov.responsavel.nome
        })

    meta_ativa = db.query(models.Meta).filter(models.Meta.grupo_id == group_id, models.Meta.status == 'ativa').first()

    def get_total_for_type(tipo: str) -> Decimal:
        total = db.query(func.sum(models.Movimentacao.valor)).filter(
            models.Movimentacao.grupo_id == group_id,
            models.Movimentacao.tipo == tipo
        ).scalar()
        return total or Decimal('0.0')

    total_ganhos = get_total_for_type('ganho')
    total_gastos = get_total_for_type('gasto')
    total_investido = get_total_for_type('investimento')
    saldo_total = total_ganhos - total_gastos - total_investido

    dashboard_data = {
        "nome_utilizador": current_user.nome, "nome_grupo": group.nome, "plano": group.plano,
        "membros": group.membros, "movimentacoes_recentes": movimentacoes_com_responsavel,
        "meta_ativa": meta_ativa,
        "total_investido": total_investido,
        "saldo_total": saldo_total
    }
    return dashboard_data

@router.get("/{group_id}/chart_data", response_model=List[schemas.ChartMonthData])
def get_chart_data(group_id: str, db: Session = Depends(database.get_db), current_user: models.Usuario = Depends(get_current_user_from_token)):
    """
    Calcula e retorna os dados agregados para o gráfico dos últimos 3 meses.
    """
    group = db.query(models.Grupo).filter(models.Grupo.id == group_id).first()
    if not group or current_user not in group.membros:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Acesso não permitido.")

    today = datetime.now()
    chart_data = []
    meses_pt = {1: "Jan", 2: "Fev", 3: "Mar", 4: "Abr", 5: "Mai", 6: "Jun", 7: "Jul", 8: "Ago", 9: "Set", 10: "Out", 11: "Nov", 12: "Dez"}

    for i in range(3):
        target_date = today - relativedelta(months=i)
        year, month = target_date.year, target_date.month
        
        def get_total_for_type(tipo: str) -> Decimal:
            total = db.query(func.sum(models.Movimentacao.valor)).filter(
                models.Movimentacao.grupo_id == group_id, models.Movimentacao.tipo == tipo,
                extract('year', models.Movimentacao.data_transacao) == year,
                extract('month', models.Movimentacao.data_transacao) == month
            ).scalar()
            return total or Decimal('0.0')

        ganhos = get_total_for_type('ganho')
        gastos = get_total_for_type('gasto')
        investimentos = get_total_for_type('investimento')
        saldo = ganhos - gastos - investimentos

        chart_data.append({
            "mes": f"{meses_pt[month]}/{str(year)[2:]}",
            "ganhos": float(ganhos),
            "gastos": float(gastos),
            "investimentos": float(investimentos),
            "saldo": float(saldo)
        })

    return chart_data[::-1]

@router.get("/{group_id}/goals", response_model=List[schemas.Meta])
def get_all_goals_for_group(group_id: str, db: Session = Depends(database.get_db), current_user: models.Usuario = Depends(get_current_user_from_token)):
    """Lista todas as metas de um grupo."""
    group = db.query(models.Grupo).filter(models.Grupo.id == group_id).first()
    if not group or current_user not in group.membros:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Acesso não permitido.")
    return group.metas

@router.post("/{group_id}/goals", response_model=schemas.Meta, status_code=status.HTTP_201_CREATED)
def create_goal_for_group(group_id: str, goal: schemas.GoalCreate, db: Session = Depends(database.get_db), current_user: models.Usuario = Depends(get_current_user_from_token)):
    """Cria uma nova meta para um grupo, com validação de plano."""
    group = db.query(models.Grupo).options(joinedload(models.Grupo.metas)).filter(models.Grupo.id == group_id).first()
    if not group or current_user not in group.membros:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Acesso não permitido.")
    if group.plano == 'gratuito' and len([m for m in group.metas if m.status == 'ativa']) > 0:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="O plano gratuito permite apenas uma meta ativa.")
    
    db_goal = models.Meta(titulo=goal.titulo, valor_meta=Decimal(str(goal.valor_meta)), data_limite=goal.data_limite, grupo_id=group_id)
    db.add(db_goal)
    db.commit()
    db.refresh(db_goal)
    return db_goal

@router.put("/goals/{goal_id}", response_model=schemas.Meta)
def update_goal(goal_id: str, goal_update: schemas.GoalUpdate, db: Session = Depends(database.get_db), current_user: models.Usuario = Depends(get_current_user_from_token)):
    """Atualiza uma meta existente."""
    db_goal = db.query(models.Meta).options(joinedload(models.Meta.grupo)).filter(models.Meta.id == goal_id).first()
    if not db_goal or current_user not in db_goal.grupo.membros:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Acesso não permitido.")
    
    db_goal.titulo = goal_update.titulo
    db_goal.valor_meta = Decimal(str(goal_update.valor_meta))
    db_goal.data_limite = goal_update.data_limite
    db.commit()
    db.refresh(db_goal)
    return db_goal

@router.delete("/goals/{goal_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_goal(goal_id: str, db: Session = Depends(database.get_db), current_user: models.Usuario = Depends(get_current_user_from_token)):
    """Apaga uma meta."""
    db_goal = db.query(models.Meta).options(joinedload(models.Meta.grupo)).filter(models.Meta.id == goal_id).first()
    if not db_goal or current_user not in db_goal.grupo.membros:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Acesso não permitido.")
    if db_goal.valor_atual > 0:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Não é possível apagar uma meta com fundos. Por favor, retire os fundos primeiro.")
    
    db.delete(db_goal)
    db.commit()
    return

@router.post("/goals/{goal_id}/add_funds", response_model=schemas.Meta)
def add_funds_to_goal(goal_id: str, funds: schemas.GoalAddFunds, db: Session = Depends(database.get_db), current_user: models.Usuario = Depends(get_current_user_from_token)):
    """Adiciona um valor a uma meta e cria uma transação de 'investimento' correspondente."""
    db_goal = db.query(models.Meta).options(joinedload(models.Meta.grupo)).filter(models.Meta.id == goal_id).first()
    if not db_goal or current_user not in db_goal.grupo.membros:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Acesso não permitido a esta meta.")

    db_goal.valor_atual += Decimal(str(funds.valor))
    db_transaction = models.Movimentacao(grupo_id=db_goal.grupo_id, responsavel_id=current_user.id, tipo='investimento', descricao=f"Aporte para a meta: {db_goal.titulo}", valor=Decimal(str(funds.valor)))
    db.add(db_transaction)
    db.commit()
    db.refresh(db_goal)
    return db_goal

@router.post("/goals/{goal_id}/withdraw_funds", response_model=schemas.Meta)
def withdraw_funds_from_goal(goal_id: str, funds: schemas.GoalWithdrawFunds, db: Session = Depends(database.get_db), current_user: models.Usuario = Depends(get_current_user_from_token)):
    """Retira fundos de uma meta e cria uma transação de 'ganho'."""
    db_goal = db.query(models.Meta).options(joinedload(models.Meta.grupo)).filter(models.Meta.id == goal_id).first()
    if not db_goal or current_user not in db_goal.grupo.membros:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Acesso não permitido.")
    
    valor_a_retirar = Decimal(str(funds.valor))
    if valor_a_retirar > db_goal.valor_atual:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Valor de retirada excede os fundos na meta.")

    db_goal.valor_atual -= valor_a_retirar
    db_transaction = models.Movimentacao(grupo_id=db_goal.grupo_id, responsavel_id=current_user.id, tipo='ganho', descricao=f"Retirada da meta: {db_goal.titulo}", valor=valor_a_retirar)
    db.add(db_transaction)
    db.commit()
    db.refresh(db_goal)
    return db_goal
