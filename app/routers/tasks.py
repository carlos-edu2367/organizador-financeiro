from fastapi import APIRouter, Depends, HTTPException, status, Header
from sqlalchemy.orm import Session

from .. import database
from ..services import achievements_service
from ..config import settings # Importa as configurações para a chave secreta

router = APIRouter(
    prefix="/tasks",
    tags=['Tasks']
)

# Pega a chave secreta do ficheiro de configuração.
# Adicione uma linha no seu ficheiro .env: TASK_SECRET_KEY="uma-chave-muito-secreta"
TASK_SECRET_KEY = settings.SECRET_KEY # Reutilizando a SECRET_KEY por simplicidade

@router.post("/check-monthly-achievements", summary="Verifica e atribui medalhas de saldo")
def run_check_monthly_achievements(
    x_task_secret: str = Header(None), 
    db: Session = Depends(database.get_db)
):
    """
    Endpoint para ser chamado por um Cron Job (tarefa agendada) para verificar
    e atribuir as medalhas de Bronze e Prata.
    
    Requer um cabeçalho 'x-task-secret' para segurança.
    """
    if not x_task_secret or x_task_secret != TASK_SECRET_KEY:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Chave secreta da tarefa inválida ou em falta."
        )
        
    results = achievements_service.check_monthly_balance_achievements(db)
    
    return {"status": "success", "details": results}

