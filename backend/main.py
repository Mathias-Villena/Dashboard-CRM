import os
import io
from datetime import datetime
import pandas as pd
from typing import Dict, Any
# pyrefly: ignore [missing-import]
from fastapi import FastAPI, HTTPException, status, Depends
# pyrefly: ignore [missing-import]
from fastapi.middleware.cors import CORSMiddleware
# pyrefly: ignore [missing-import]
from fastapi.responses import StreamingResponse
# pyrefly: ignore [missing-import]
from pydantic import BaseModel
from dotenv import load_dotenv

load_dotenv()

from ghl_client import get_ghl_data
from report_generator import generate_excel_report, generate_pdf_report
from db import init_db, verify_user

app = FastAPI(title="Futura Perú CRM API", version="1.0.0")

# Inicialización de la base de datos al arrancar la aplicación
@app.on_event("startup")
def startup_event():
    init_db()

# Permitir CORS para desarrollo local y producción
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # En producción se puede restringir al origen del frontend
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class LoginRequest(BaseModel):
    username: str
    password: str

@app.post("/api/login")
def login(req: LoginRequest):
    user = verify_user(req.username, req.password)
    if user:
        return {
            "status": "success",
            "user": {
                "username": user["username"],
                "name": user["name"],
                "role": user["role"]
            }
        }
    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Usuario o contraseña incorrectos"
    )

@app.get("/api/dashboard/metrics")
def get_metrics():
    try:
        data = get_ghl_data()
        df = pd.DataFrame(data)
        
        # Si no hay datos, devolver valores vacíos estructurados
        if df.empty:
            return {
                "summary": {"total": 0, "en_aprobacion": 0, "pendiente_carta": 0, "en_construccion": 0, "liquidado": 0},
                "opportunities": []
            }
            
        # Mapear etapas y stages
        stages_mapping = {
            os.getenv("STAGE_ESPERANDO_WIN"): "EN APROBACION WIN",
            os.getenv("STAGE_FICHA_DATOS_ENVIADA_WIN"): "PENDIENTE CARTA",
            os.getenv("STAGE_PENDIENTE_INICIO_HABILITACION"): "EN CONSTRUCCION",
            os.getenv("STAGE_EN_HABILITACION_TECNICA"): "EN CONSTRUCCION",
            os.getenv("STAGE_HABILITACION_COMPLETA"): "PROYECTO LIQUIDADO"
        }
        
        df["categoria_etapa"] = df["pipelineStageId"].apply(lambda s: stages_mapping.get(s, "OTROS"))
        
        counts = df["categoria_etapa"].value_counts().to_dict()
        total_opps = len(df)
        en_aprobacion = counts.get("EN APROBACION WIN", 0)
        pendiente_carta = counts.get("PENDIENTE CARTA", 0)
        en_construccion = counts.get("EN CONSTRUCCION", 0)
        liquidado = counts.get("PROYECTO LIQUIDADO", 0)
        
        return {
            "summary": {
                "total": int(total_opps),
                "en_aprobacion": int(en_aprobacion),
                "pendiente_carta": int(pendiente_carta),
                "en_construccion": int(en_construccion),
                "liquidado": int(liquidado)
            },
            "opportunities": data
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al procesar métricas de GHL: {str(e)}"
        )

@app.get("/api/dashboard/export/excel")
def export_excel():
    try:
        data = get_ghl_data()
        df = pd.DataFrame(data)
        if df.empty:
            raise HTTPException(status_code=404, detail="No hay datos para exportar")
            
        excel_bytes = bytes(generate_excel_report(df))
        return StreamingResponse(
            io.BytesIO(excel_bytes),
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": f"attachment; filename=Reporte_CRM_{datetime.now().strftime('%Y%m%d')}.xlsx"}
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al generar reporte Excel: {str(e)}"
        )

@app.get("/api/dashboard/export/pdf")
def export_pdf():
    try:
        data = get_ghl_data()
        df = pd.DataFrame(data)
        if df.empty:
            raise HTTPException(status_code=404, detail="No hay datos para exportar")
            
        # Calcular sumario para PDF
        stages_mapping = {
            os.getenv("STAGE_ESPERANDO_WIN"): "EN APROBACION WIN",
            os.getenv("STAGE_FICHA_DATOS_ENVIADA_WIN"): "PENDIENTE CARTA",
            os.getenv("STAGE_PENDIENTE_INICIO_HABILITACION"): "EN CONSTRUCCION",
            os.getenv("STAGE_EN_HABILITACION_TECNICA"): "EN CONSTRUCCION",
            os.getenv("STAGE_HABILITACION_COMPLETA"): "PROYECTO LIQUIDADO"
        }
        df["categoria_etapa"] = df["pipelineStageId"].apply(lambda s: stages_mapping.get(s, "OTROS"))
        counts = df["categoria_etapa"].value_counts().to_dict()
        
        pdf_summary = {
            "total": len(df),
            "en_aprobacion": counts.get("EN APROBACION WIN", 0),
            "pendiente_carta": counts.get("PENDIENTE CARTA", 0),
            "en_construccion": counts.get("EN CONSTRUCCION", 0),
            "liquidado": counts.get("PROYECTO LIQUIDADO", 0)
        }
        
        pdf_bytes = bytes(generate_pdf_report(df, pdf_summary))
        return StreamingResponse(
            io.BytesIO(pdf_bytes),
            media_type="application/pdf",
            headers={"Content-Disposition": f"attachment; filename=Reporte_Ejecutivo_{datetime.now().strftime('%Y%m%d')}.pdf"}
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al generar reporte PDF: {str(e)}"
        )
