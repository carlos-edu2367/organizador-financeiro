from sqlalchemy.orm import Session
from sqlalchemy import func, extract
from decimal import Decimal
from datetime import datetime, timezone
from dateutil.relativedelta import relativedelta

from .. import models

def check_monthly_balance_achievements(db: Session):
    """
    Verifica e atribui medalhas de Bronze e Prata para todos os grupos.
    Esta função deve ser executada uma vez por mês (ex: no dia 1).
    """
    
    # Pega o ano e o mês anterior para análise
    today = datetime.now(timezone.utc)
    first_day_of_current_month = today.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    last_day_of_previous_month = first_day_of_current_month - relativedelta(days=1)
    previous_month = last_day_of_previous_month.month
    previous_month_year = last_day_of_previous_month.year

    all_groups = db.query(models.Grupo).all()
    results = {"checked": 0, "awarded_bronze": 0, "awarded_silver": 0}

    for group in all_groups:
        results["checked"] += 1
        
        # Calcula o saldo total do grupo até o final do mês anterior
        total_ganhos = db.query(func.sum(models.Movimentacao.valor)).filter(
            models.Movimentacao.grupo_id == group.id,
            models.Movimentacao.tipo == 'ganho',
            models.Movimentacao.data_transacao <= last_day_of_previous_month
        ).scalar() or Decimal('0.0')

        total_gastos = db.query(func.sum(models.Movimentacao.valor)).filter(
            models.Movimentacao.grupo_id == group.id,
            models.Movimentacao.tipo == 'gasto',
            models.Movimentacao.data_transacao <= last_day_of_previous_month
        ).scalar() or Decimal('0.0')

        saldo_final_mes = total_ganhos - total_gastos

        if saldo_final_mes > 0:
            # Mês positivo, incrementa a contagem
            group.meses_positivos_consecutivos += 1
            
            # --- Lógica da Medalha de Bronze ---
            data_limite_cooldown = today - relativedelta(months=3)
            ultima_conquista_bronze = db.query(models.Conquista).filter(
                models.Conquista.grupo_id == group.id,
                models.Conquista.tipo_medalha == models.TipoMedalhaEnum.bronze,
                models.Conquista.data_conquista > data_limite_cooldown
            ).first()

            if not ultima_conquista_bronze:
                nova_conquista = models.Conquista(
                    grupo_id=group.id,
                    tipo_medalha=models.TipoMedalhaEnum.bronze,
                    descricao=f"Parabéns! Vocês terminaram {last_day_of_previous_month.strftime('%B de %Y')} com saldo positivo."
                )
                db.add(nova_conquista)
                results["awarded_bronze"] += 1

            # --- Lógica da Medalha de Prata ---
            if group.meses_positivos_consecutivos >= 3:
                ultima_conquista_prata = db.query(models.Conquista).filter(
                    models.Conquista.grupo_id == group.id,
                    models.Conquista.tipo_medalha == models.TipoMedalhaEnum.prata,
                    models.Conquista.data_conquista > data_limite_cooldown
                ).first()

                if not ultima_conquista_prata:
                    nova_conquista = models.Conquista(
                        grupo_id=group.id,
                        tipo_medalha=models.TipoMedalhaEnum.prata,
                        descricao="Incrível! 3 meses seguidos terminando com saldo positivo."
                    )
                    db.add(nova_conquista)
                    results["awarded_silver"] += 1
                    # Opcional: resetar a contagem para o desafio começar de novo
                    group.meses_positivos_consecutivos = 0

        else:
            # Mês negativo, quebra a sequência
            group.meses_positivos_consecutivos = 0

    db.commit()
    return results
