from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from starlette.staticfiles import StaticFiles # Adicionado
from starlette.responses import FileResponse # Adicionado

from . import models
from .database import engine
from .routers import auth, users, groups, transactions, tasks, ai

models.Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="Clarify API",
    description="API para o organizador financeiro Clarify.",
    version="0.1.0",
)

# Configuração de CORS mais permissiva para o deploy
origins = [
    "*" # Permite todas as origens
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Inclui as rotas da API.
# O prefixo /api ajuda a diferenciar os endpoints da API dos ficheiros do site.
app.include_router(auth.router, prefix="/api")
app.include_router(users.router, prefix="/api")
app.include_router(groups.router, prefix="/api")
app.include_router(transactions.router, prefix="/api")
app.include_router(tasks.router, prefix="/api")
app.include_router(ai.router, prefix="/api")


# (NOVO) Monta a pasta 'frontend' para servir os ficheiros estáticos (HTML, JS, CSS)
# Esta deve ser a ÚLTIMA coisa a ser montada na aplicação.
app.mount("/", StaticFiles(directory="frontend", html=True), name="static")

@app.exception_handler(404)
async def not_found_handler(request, exc):
    """Garante que o index.html seja servido para qualquer rota não encontrada."""
    return FileResponse('frontend/index.html')
