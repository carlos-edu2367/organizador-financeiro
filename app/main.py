from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from starlette.staticfiles import StaticFiles
from starlette.responses import FileResponse

from . import models
from .database import engine
from .routers import auth, users, groups, transactions, tasks, ai, collaborators # Adicionado collaborators

models.Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="Clarify API",
    description="API para o organizador financeiro Clarify.",
    version="0.1.0",
)

origins = ["*"]

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

# NOVAS Rotas da API para colaboradores
app.include_router(collaborators.router)

# Monta a pasta do frontend dos colaboradores
app.mount("/colaboradores", StaticFiles(directory="collaborators", html=True), name="collaborators")

# Monta a pasta do frontend dos clientes (deve ser o último)
app.mount("/", StaticFiles(directory="frontend", html=True), name="static")

@app.exception_handler(404)
async def not_found_handler(request, exc):
    # Se a rota não for da API nem de colaboradores, serve o index do cliente.
    if not request.url.path.startswith('/api') and not request.url.path.startswith('/collaborators'):
        return FileResponse('frontend/index.html')
    # Para rotas de API não encontradas, mantém o 404 padrão.
    return await app.router.default(request, exc)
