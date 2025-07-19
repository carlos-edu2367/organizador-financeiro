from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func, extract
from typing import List
from decimal import Decimal
from datetime import datetime, timezone, timedelta
from dateutil.relativedelta import relativedelta

from .. import database, schemas, models
from ..models import Conquista, TipoMedalhaEnum
from ..security import get_current_user_from_token

router = APIRouter(
    prefix="/groups",
    tags=['Groups, Goals & Charts'],
    dependencies=[Depends(get_current_user_from_token)]
)

@router.get("/{group_id}/dashboard", response_model=schemas.DashboardData)
def get_dashboard_data(group_id: str, db: Session = Depends(database.get_db), current_user: models.Usuario = Depends(get_current_user_from_token)):
    group = db.query(models.Grupo).options(
        joinedload(models.Grupo.associacoes_membros).joinedload(models.GrupoMembro.usuario),
        joinedload(models.Grupo.conquistas)
    ).filter(models.Grupo.id == group_id).first()

    if not group:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Grupo não encontrado.")
    
    if current_user not in group.membros:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Acesso não permitido a este grupo.")

    membros_com_papel = [{"id": assoc.usuario.id, "nome": assoc.usuario.nome, "papel": assoc.papel} for assoc in group.associacoes_membros]
    
    movimentacoes = db.query(models.Movimentacao).filter(models.Movimentacao.grupo_id == group_id).order_by(models.Movimentacao.data_transacao.desc()).limit(30).all()
    movimentacoes_com_responsavel = [{"id": mov.id, "tipo": mov.tipo, "descricao": mov.descricao, "valor": mov.valor, "data_transacao": mov.data_transacao, "responsavel_nome": mov.responsavel.nome} for mov in movimentacoes]
    
    meta_ativa = db.query(models.Meta).filter(models.Meta.grupo_id == group_id, models.Meta.status == 'ativa').first()

    def get_total_for_type(tipo: str) -> Decimal:
        total = db.query(func.sum(models.Movimentacao.valor)).filter(models.Movimentacao.grupo_id == group_id, models.Movimentacao.tipo == tipo).scalar()
        return total or Decimal('0.0')

    total_ganhos = get_total_for_type('ganho')
    total_gastos = get_total_for_type('gasto')
    total_investido = get_total_for_type('investimento')
    saldo_total = total_ganhos - total_gastos

    today = datetime.now(timezone.utc)
    
    def get_total_for_current_month(tipo: str) -> Decimal:
        total = db.query(func.sum(models.Movimentacao.valor)).filter(
            models.Movimentacao.grupo_id == group_id,
            models.Movimentacao.tipo == tipo,
            extract('year', models.Movimentacao.data_transacao) == today.year,
            extract('month', models.Movimentacao.data_transacao) == today.month
        ).scalar()
        return total or Decimal('0.0')

    ganhos_mes_atual = get_total_for_current_month('ganho')
    gastos_mes_atual = get_total_for_current_month('gasto')

    conquistas_recentes = group.conquistas[:3]

    # (ALTERADO) Lógica para buscar o status de uso da IA
    ai_usage_count_today = 0
    ai_first_usage_timestamp_today = None
    if group.plano == 'gratuito':
        twenty_four_hours_ago = datetime.now(timezone.utc) - timedelta(days=1)
        # Busca todos os usos nas últimas 24h, ordenando pelo mais antigo primeiro
        recent_usages = db.query(models.AIUsage).filter(
            models.AIUsage.grupo_id == group.id,
            models.AIUsage.timestamp >= twenty_four_hours_ago
        ).order_by(models.AIUsage.timestamp.asc()).all()

        ai_usage_count_today = len(recent_usages)
        if ai_usage_count_today > 0:
            # Pega o timestamp do primeiro uso para basear o cronômetro
            ai_first_usage_timestamp_today = recent_usages[0].timestamp

    dashboard_data = {
        "current_user_id": current_user.id,
        "nome_utilizador": current_user.nome, "nome_grupo": group.nome, "plano": group.plano,
        "membros": membros_com_papel, "movimentacoes_recentes": movimentacoes_com_responsavel,
        "meta_ativa": meta_ativa,
        "total_investido": total_investido,
        "saldo_total": saldo_total,
        "conquistas_recentes": conquistas_recentes,
        "ganhos_mes_atual": ganhos_mes_atual,
        "gastos_mes_atual": gastos_mes_atual,
        "ai_usage_count_today": ai_usage_count_today,
        "ai_first_usage_timestamp_today": ai_first_usage_timestamp_today
    }
    return dashboard_data

# ... (o resto do ficheiro groups.py permanece o mesmo)
@router.get("/{group_id}/chart_data", response_model=List[schemas.ChartMonthData])
def get_chart_data(group_id: str, db: Session = Depends(database.get_db), current_user: models.Usuario = Depends(get_current_user_from_token)):
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
        saldo = ganhos - gastos
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
    group = db.query(models.Grupo).filter(models.Grupo.id == group_id).first()
    if not group or current_user not in group.membros:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Acesso não permitido.")
    return group.metas
@router.post("/{group_id}/goals", response_model=schemas.Meta, status_code=status.HTTP_201_CREATED)
def create_goal_for_group(group_id: str, goal: schemas.GoalCreate, db: Session = Depends(database.get_db), current_user: models.Usuario = Depends(get_current_user_from_token)):
    group = db.query(models.Grupo).options(joinedload(models.Grupo.metas)).filter(models.Grupo.id == group_id).first()
    if not group or current_user not in group.membros:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Acesso não permitido.")
    if group.plano == 'gratuito' and len([m for m in group.metas if m.status == 'ativa']) > 0:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="O plano gratuito permite apenas uma meta ativa.")
    db_goal = models.Meta(titulo=goal.titulo, valor_meta=goal.valor_meta, data_limite=goal.data_limite, grupo_id=group_id)
    db.add(db_goal)
    db.commit()
    db.refresh(db_goal)
    return db_goal
@router.put("/goals/{goal_id}", response_model=schemas.Meta)
def update_goal(goal_id: str, goal_update: schemas.GoalUpdate, db: Session = Depends(database.get_db), current_user: models.Usuario = Depends(get_current_user_from_token)):
    db_goal = db.query(models.Meta).options(joinedload(models.Meta.grupo)).filter(models.Meta.id == goal_id).first()
    if not db_goal or current_user not in db_goal.grupo.membros:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Acesso não permitido.")
    db_goal.titulo = goal_update.titulo
    db_goal.valor_meta = goal_update.valor_meta
    db_goal.data_limite = goal_update.data_limite
    db.commit()
    db.refresh(db_goal)
    return db_goal
@router.delete("/goals/{goal_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_goal(goal_id: str, db: Session = Depends(database.get_db), current_user: models.Usuario = Depends(get_current_user_from_token)):
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
    db_goal = db.query(models.Meta).options(joinedload(models.Meta.grupo)).filter(models.Meta.id == goal_id).first()
    if not db_goal or current_user not in db_goal.grupo.membros:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Acesso não permitido a esta meta.")
    db_goal.valor_atual += funds.valor
    if db_goal.valor_atual >= db_goal.valor_meta and db_goal.status == 'ativa':
        db_goal.status = 'concluida'
        medalhas_por_valor = {
            TipoMedalhaEnum.diamante: (Decimal('1000000.00'), "Atingiu a incrível marca de R$ 1.000.000 em uma meta!"),
            TipoMedalhaEnum.platina: (Decimal('100000.00'), "Parabéns por atingir uma meta de mais de R$ 100.000!"),
            TipoMedalhaEnum.ouro: (Decimal('10000.00'), "Vocês atingiram uma meta de mais de R$ 10.000! Excelente!")
        }
        for tipo, (valor_minimo, descricao) in medalhas_por_valor.items():
            if db_goal.valor_meta >= valor_minimo:
                data_limite_cooldown = datetime.now(timezone.utc) - relativedelta(months=3)
                ultima_conquista_do_tipo = db.query(models.Conquista).filter(
                    models.Conquista.grupo_id == db_goal.grupo_id,
                    models.Conquista.tipo_medalha == tipo,
                    models.Conquista.data_conquista > data_limite_cooldown
                ).first()
                if not ultima_conquista_do_tipo:
                    nova_conquista = models.Conquista(
                        grupo_id=db_goal.grupo_id,
                        tipo_medalha=tipo,
                        descricao=descricao
                    )
                    db.add(nova_conquista)
                break 
    db_transaction = models.Movimentacao(grupo_id=db_goal.grupo_id, responsavel_id=current_user.id, tipo='investimento', descricao=f"Aporte para a meta: {db_goal.titulo}", valor=funds.valor)
    db.add(db_transaction)
    db.commit()
    db.refresh(db_goal)
    return db_goal
@router.post("/goals/{goal_id}/withdraw_funds", response_model=schemas.Meta)
def withdraw_funds_from_goal(goal_id: str, funds: schemas.GoalWithdrawFunds, db: Session = Depends(database.get_db), current_user: models.Usuario = Depends(get_current_user_from_token)):
    db_goal = db.query(models.Meta).options(joinedload(models.Meta.grupo)).filter(models.Meta.id == goal_id).first()
    if not db_goal or current_user not in db_goal.grupo.membros:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Acesso não permitido.")
    valor_a_retirar = funds.valor
    if valor_a_retirar > db_goal.valor_atual:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Valor de retirada excede os fundos na meta.")
    db_goal.valor_atual -= valor_a_retirar
    db_transaction = models.Movimentacao(grupo_id=db_goal.grupo_id, responsavel_id=current_user.id, tipo='ganho', descricao=f"Retirada da meta: {db_goal.titulo}", valor=valor_a_retirar)
    db.add(db_transaction)
    db.commit()
    db.refresh(db_goal)
    return db_goal
@router.post("/{group_id}/invites", response_model=schemas.InviteLink)
def create_invite_link(group_id: str, db: Session = Depends(database.get_db), current_user: models.Usuario = Depends(get_current_user_from_token)):
    group = db.query(models.Grupo).options(joinedload(models.Grupo.associacoes_membros)).filter(models.Grupo.id == group_id).first()
    if not group:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Grupo não encontrado.")
    user_role = next((assoc.papel for assoc in group.associacoes_membros if assoc.usuario_id == current_user.id), None)
    if user_role != 'dono':
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Apenas o dono do grupo pode gerar convites.")
    if len(group.membros) >= 4 or (group.plano == 'gratuito' and len(group.membros) >= 2):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="O grupo atingiu o limite máximo de membros.")
    new_invite = models.Convite(grupo_id=group.id)
    db.add(new_invite)
    db.commit()
    db.refresh(new_invite)
    invite_link = f"/pages/auth/accept_invite.html?token={new_invite.token}"
    return {"invite_link": invite_link}
@router.post("/invites/{invite_token}/accept")
def accept_invite(invite_token: str, db: Session = Depends(database.get_db), current_user: models.Usuario = Depends(get_current_user_from_token)):
    invite = db.query(models.Convite).filter(models.Convite.token == invite_token, models.Convite.status == 'pendente').first()
    if not invite:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Convite inválido, expirado ou já utilizado.")
    group = invite.grupo
    if current_user in group.membros:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Você já é membro deste grupo.")
    association = models.GrupoMembro(usuario_id=current_user.id, grupo_id=group.id, papel='membro')
    db.add(association)
    invite.status = 'aceito'
    db.commit()
    return {"message": "Convite aceite com sucesso! Você foi adicionado ao grupo.", "group_id": group.id}
@router.delete("/{group_id}/members/{member_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_group_member(group_id: str, member_id: str, db: Session = Depends(database.get_db), current_user: models.Usuario = Depends(get_current_user_from_token)):
    group = db.query(models.Grupo).options(joinedload(models.Grupo.associacoes_membros)).filter(models.Grupo.id == group_id).first()
    if not group:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Grupo não encontrado.")
    user_role = next((assoc.papel for assoc in group.associacoes_membros if assoc.usuario_id == current_user.id), None)
    if user_role != 'dono':
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Apenas o dono do grupo pode remover membros.")
    if str(current_user.id) == member_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="O dono não pode sair do grupo.")
    association_to_delete = db.query(models.GrupoMembro).filter(
        models.GrupoMembro.grupo_id == group_id,
        models.GrupoMembro.usuario_id == member_id
    ).first()
    if not association_to_delete:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Membro não encontrado no grupo.")
    db.delete(association_to_delete)
    db.commit()
    return
@router.get("/{group_id}/achievements", response_model=List[schemas.Conquista])
def get_all_achievements_for_group(group_id: str, db: Session = Depends(database.get_db), current_user: models.Usuario = Depends(get_current_user_from_token)):
    """Lista todas as conquistas (medalhas) de um grupo."""
    group = db.query(models.Grupo).filter(models.Grupo.id == group_id).first()
    if not group or current_user not in group.membros:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Acesso não permitido.")
    return group.conquistas
