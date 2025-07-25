import httpx
import json
from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session, joinedload

from ..config import settings
from .. import schemas, database, models
from ..security import get_current_user_from_token
from ..models import Usuario, Grupo # Importa Grupo para usar no joinedload

router = APIRouter(
    prefix="/ai",
    tags=['AI'],
    dependencies=[Depends(get_current_user_from_token)]
)

class ParseTransactionRequest(BaseModel):
    text: str = Field(..., min_length=3, max_length=280)

async def call_gemini_api(user_text: str) -> dict:
    """
    Chama a API do Gemini para extrair uma ou mais transações de um texto.
    """
    if not settings.GEMINI_API_KEY or settings.GEMINI_API_KEY == "SUA_CHAVE_AQUI":
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="A chave da API do Gemini não está configurada no servidor."
        )

    api_url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key={settings.GEMINI_API_KEY}"
    
    prompt = f"""
    Analise o seguinte texto de um usuário brasileiro e extraia TODAS as transações financeiras mencionadas.
    O texto é: "{user_text}"

    Para cada transação encontrada, extraia as seguintes informações:
    1. "tipo": Deve ser "ganho", "gasto" ou "investimento". Se não estiver claro, use "gasto".
    2. "valor": O valor numérico da transação.
    3. "descricao": Uma breve descrição da transação.

    Responda APENAS com um objeto JSON que contenha uma única chave "transactions",
    cujo valor seja uma lista de objetos, onde cada objeto representa uma transação encontrada.
    Se nenhuma transação for encontrada, retorne uma lista vazia.

    Exemplo de resposta para "gastei 30 reais de uber e investi 50 reais hoje":
    {{
      "transactions": [
        {{
          "tipo": "gasto",
          "valor": 30.0,
          "descricao": "uber"
        }},
        {{
          "tipo": "investimento",
          "valor": 50.0,
          "descricao": "investimento de hoje"
        }}
      ]
    }}
    """

    payload = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {
            "response_mime_type": "application/json",
        }
    }

    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(api_url, json=payload, timeout=20.0)
            response.raise_for_status()
            
            json_text = response.json()["candidates"][0]["content"]["parts"][0]["text"]
            return json.loads(json_text)

    except httpx.RequestError as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Erro ao comunicar com o serviço de IA: {e}"
        )
    except (KeyError, IndexError, json.JSONDecodeError):
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="A resposta do serviço de IA foi inválida ou não pôde ser processada."
        )

@router.post("/parse-transaction", response_model=schemas.ParsedTransactionResponse)
async def parse_transaction_from_text(
    request: ParseTransactionRequest,
    db: Session = Depends(database.get_db),
    current_user: Usuario = Depends(get_current_user_from_token)
):
    """
    Recebe um texto do frontend, envia para a API do Gemini e retorna os dados extraídos.
    Limita o uso a 2 vezes por dia para grupos do plano gratuito.
    """
    # INÍCIO DA ALTERAÇÃO: Usar o grupo ativo do usuário para verificar o plano e o limite de IA
    if not current_user.grupo_ativo_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Usuário não tem um grupo ativo.")

    group = db.query(models.Grupo).options(
        joinedload(models.Grupo.ai_usages) # Carrega os usos de IA para o grupo
    ).filter(models.Grupo.id == current_user.grupo_ativo_id).first()

    if not group:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Grupo ativo não encontrado.")
    # FIM DA ALTERAÇÃO
    
    print(f"--- Verificando Limite de IA para o Grupo: {group.id}, Plano: {group.plano} ---")

    if group.plano == 'gratuito':
        twenty_four_hours_ago = datetime.now(timezone.utc) - timedelta(days=1)
        
        # (ALTERADO) Conta o número de usos nas últimas 24h para o grupo ATIVO
        usage_count = db.query(models.AIUsage).filter(
            models.AIUsage.grupo_id == group.id,
            models.AIUsage.timestamp >= twenty_four_hours_ago
        ).count()

        # (ALTERADO) Verifica se o limite de 2 usos foi atingido
        if usage_count >= 2:
            print(f"!!! Limite de IA atingido para o grupo {group.id}. Usos hoje: {usage_count}")
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Você já usou a IA 2 vezes hoje. O limite para o plano gratuito é de 2 usos por dia. Faça upgrade para uso ilimitado."
            )
        print(f"--- Limite de IA OK. Usos hoje: {usage_count}/2. Prosseguindo com a análise. ---")

    parsed_data = await call_gemini_api(request.text)
    
    if group.plano == 'gratuito':
        print(f"--- Registrando uso de IA para o grupo gratuito {group.id} ---")
        new_usage = models.AIUsage(grupo_id=group.id)
        db.add(new_usage)
        db.commit()

    if "transactions" not in parsed_data:
        parsed_data = {"transactions": []}
        
    return parsed_data
