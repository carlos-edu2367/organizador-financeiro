from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from starlette.responses import FileResponse, JSONResponse
from starlette.staticfiles import StaticFiles
from starlette.exceptions import HTTPException

from . import models
from .database import engine
# INÍCIO DA ALTERAÇÃO: Importar o router de pagamentos que estava faltando
from .routers import auth, users, support, groups, transactions, tasks, ai, collaborators, admin_users, pagamentos
# FIM DA ALTERAÇÃO

models.Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="Clarify API",
    description="API para o organizador financeiro Clarify.",
    version="0.1.0",
)

# Configuração de CORS
origins = [
    "http://localhost:5500",
    "http://127.0.0.1:5500",
    # Adicione aqui a URL do seu frontend de produção quando tiver uma.
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Rotas da API para clientes
app.include_router(auth.router)
app.include_router(users.router, prefix="/api")
app.include_router(groups.router, prefix="/api")
app.include_router(transactions.router, prefix="/api")
app.include_router(tasks.router, prefix="/api")
app.include_router(ai.router, prefix="/api")
app.include_router(support.router, prefix="/api")
# --- INÍCIO DA ALTERAÇÃO: Adicionar o router de pagamentos ao app ---
app.include_router(pagamentos.router, prefix="/api")
# --- FIM DA ALTERAÇÃO ---

# Rotas da API para colaboradores
app.include_router(collaborators.router)
# A rota de admin de usuários deve estar sob o prefixo dos colaboradores
app.include_router(admin_users.router, prefix="/collaborators")


# Monta a pasta do frontend dos colaboradores
app.mount("/collaborators", StaticFiles(directory="collaborators", html=True), name="collaborators")

# Monta a pasta do frontend dos clientes (deve ser o último)
app.mount("/", StaticFiles(directory="frontend", html=True), name="static")

@app.exception_handler(404)
async def not_found_handler(request: Request, exc: HTTPException):
    path = request.url.path
    # Garante que as rotas da API não sejam redirecionadas para o index.html
    if not path.startswith('/api/') and not path.startswith('/collaborators/'):
        return FileResponse('frontend/index.html')
    return JSONResponse(
        status_code=404,
        content={"detail": f"O recurso em '{path}' não foi encontrado."}
    )
