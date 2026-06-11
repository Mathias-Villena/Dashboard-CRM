import os
import requests
from requests.adapters import HTTPAdapter
from urllib3.util import Retry
from dotenv import load_dotenv

load_dotenv()

# Configuración de URLs y Versiones
SEARCH_OPPORTUNITIES_URL = "https://services.leadconnectorhq.com/opportunities/search"
CONTACTS_URL = "https://services.leadconnectorhq.com/contacts/"

def obtener_session_con_retries():
    """Crea una sesión requests robusta con reintentos para evitar fallos de conexión."""
    session = requests.Session()
    retries = Retry(
        total=3,
        backoff_factor=0.5,
        status_forcelist=[500, 502, 503, 504, 429],
        raise_on_status=False
    )
    adapter = HTTPAdapter(max_retries=retries)
    session.mount("https://", adapter)
    session.mount("http://", adapter)
    return session

def fetch_opportunities(token, location_id, pipeline_id):
    """
    Trae todas las oportunidades del pipeline filtradas en memoria.
    Endpoint: POST /opportunities/search (no acepta pipelineId en el cuerpo)
    """
    session = obtener_session_con_retries()
    headers = {
        "Authorization": f"Bearer {token}",
        "Version": "2021-04-15",
        "Accept": "application/json",
        "Content-Type": "application/json"
    }
    
    all_opps = []
    search_after = None
    
    while True:
        payload = {
            "locationId": location_id,
            "limit": 100
        }
        if search_after:
            payload["searchAfter"] = search_after
            
        print(f"[GHL CLIENT] Buscando oportunidades... (Pagina actual, total acumulado filtrado: {len(all_opps)})")
        try:
            res = session.post(SEARCH_OPPORTUNITIES_URL, headers=headers, json=payload, timeout=20)
            if res.status_code not in [200, 201]:
                print(f"[ERROR] Error al consultar oportunidades GHL (Status: {res.status_code}): {res.text}")
                break
                
            data = res.json()
            opps = data.get("opportunities", [])
            if not opps:
                break
                
            # Filtramos por el pipelineId especificado
            opps_filtradas = [o for o in opps if o.get("pipelineId") == pipeline_id]
            all_opps.extend(opps_filtradas)
            
            # Obtener el cursor para la siguiente página
            meta = data.get("meta", {})
            search_after = meta.get("searchAfter")
            
            # Si se trajeron menos elementos del límite, o no hay cursor, terminamos
            if not search_after or len(opps) < 100:
                break
        except Exception as e:
            print(f"[ERROR] Excepcion durante la consulta de oportunidades: {e}")
            break
            
    return all_opps

def fetch_contacts(token, location_id):
    """
    Trae todos los contactos de la locación utilizando paginación cursor-based.
    Endpoint: GET /contacts/
    """
    session = obtener_session_con_retries()
    headers = {
        "Authorization": f"Bearer {token}",
        "Version": "2021-07-28",
        "Accept": "application/json"
    }
    
    all_contacts = []
    start_after = None
    
    while True:
        params = {
            "locationId": location_id,
            "limit": 100
        }
        if start_after:
            params["startAfter"] = start_after
            
        print(f"[GHL CLIENT] Obteniendo contactos... (Pagina actual, total acumulado: {len(all_contacts)})")
        try:
            res = session.get(CONTACTS_URL, headers=headers, params=params, timeout=20)
            if res.status_code != 200:
                print(f"[ERROR] Error al consultar contactos GHL (Status: {res.status_code}): {res.text}")
                break
                
            data = res.json()
            contacts = data.get("contacts", [])
            if not contacts:
                break
                
            all_contacts.extend(contacts)
            
            # Obtener el cursor para la siguiente página
            meta = data.get("meta", {})
            start_after = meta.get("startAfter")
            
            # Si se trajeron menos del límite, o no hay cursor, terminamos
            if not start_after or len(contacts) < 100:
                break
        except Exception as e:
            print(f"[ERROR] Excepcion durante la consulta de contactos: {e}")
            break
            
    return all_contacts

def get_ghl_data():
    """
    Función principal que trae oportunidades y contactos de GHL,
    y realiza un join en memoria procesando las reglas de distrito y gestor.
    """
    token = os.getenv("GHL_ACCESS_TOKEN")
    location_id = os.getenv("GHL_LOCATION_ID")
    pipeline_id = os.getenv("PIPELINE_ID")
    
    if not token or not location_id or not pipeline_id:
        raise ValueError("Faltan credenciales clave (GHL_ACCESS_TOKEN, GHL_LOCATION_ID, PIPELINE_ID) en el archivo .env")
        
    # 1. Fetch de datos en paralelo / secuencial
    opps = fetch_opportunities(token, location_id, pipeline_id)
    contacts = fetch_contacts(token, location_id)
    
    print(f"[GHL CLIENT] Finalizado fetch. Oportunidades: {len(opps)}, Contactos: {len(contacts)}")
    
    # 2. Mapear contactos por ID para hacer join rápido en memoria
    contacts_map = {}
    for c in contacts:
        cid = c.get("id")
        if cid:
            contacts_map[cid] = c
            
    # Mapeo de IDs de Custom Fields y Usuarios
    CF_DISTRITO_ID = "H9m1fipzTYGn6xB4ocxZ"
    USER_JP_ID = "UzEVMjDvEHlw6YUAj3aJ"
    USER_YESEN_ID = "bVGkAziqy6vwDoFbqvr6"
    
    # 3. Join en memoria y mapeos fallback
    data_consolidated = []
    
    for opp in opps:
        contact_id = opp.get("contactId")
        contact = contacts_map.get(contact_id, {})
        
        # --- EXTRACCIÓN DE DISTRITO ---
        distrito = None
        # Regla 1: Campo personalizado del contacto
        cfs = contact.get("customFields", [])
        cf_dict = {cf.get("id"): cf.get("value") for cf in cfs if isinstance(cf, dict)}
        distrito_val = cf_dict.get(CF_DISTRITO_ID)
        
        if distrito_val:
            distrito = str(distrito_val).strip().upper()
            
        # Regla 2: Analizar etiquetas del contacto buscando distrito:XXXX
        if not distrito:
            tags = contact.get("tags", [])
            for tag in tags:
                tag_lower = str(tag).lower().strip()
                if tag_lower.startswith("distrito:"):
                    parts = tag_lower.split(":", 1)
                    if len(parts) > 1 and parts[1].strip():
                        distrito = parts[1].strip().upper()
                        break
                        
        # Regla 3: Clasificación fallback por defecto
        if not distrito:
            distrito = "SIN DISTRITO"
            
        # --- EXTRACCIÓN DE GESTOR (HUNTER) ---
        gestor = "OTROS"
        assigned_to = opp.get("assignedTo")
        
        # Regla 1: assignedTo de la oportunidad
        if assigned_to == USER_JP_ID:
            gestor = "JP"
        elif assigned_to == USER_YESEN_ID:
            gestor = "YESEN"
        else:
            # Regla 2: Buscar en las etiquetas del contacto
            tags = contact.get("tags", [])
            for tag in tags:
                tag_lower = str(tag).lower().strip()
                if tag_lower.startswith("hunter:"):
                    parts = tag_lower.split(":", 1)
                    val = parts[1].strip() if len(parts) > 1 else ""
                    if "jean" in val or "pierre" in val:
                        gestor = "JP"
                        break
                    elif "yasmin" in val or "yesenia" in val:
                        gestor = "YESEN"
                        break
                # Fallback: buscar coincidencia directa de nombre en la etiqueta
                if "jean" in tag_lower or "pierre" in tag_lower:
                    gestor = "JP"
                    break
                elif "yasmin" in tag_lower or "yesenia" in tag_lower:
                    gestor = "YESEN"
                    break
                    
        # Consolidar datos de la oportunidad
        opp_info = {
            "id": opp.get("id"),
            "name": opp.get("name"),
            "contactId": contact_id,
            "contactName": contact.get("fullName") or f"{contact.get('firstName', '')} {contact.get('lastName', '')}".strip() or "Contacto Sin Nombre",
            "pipelineId": opp.get("pipelineId"),
            "pipelineStageId": opp.get("pipelineStageId"),
            "status": opp.get("status"),
            "createdAt": opp.get("createdAt"),
            "monetaryValue": opp.get("monetaryValue") or 0.0,
            "distrito": distrito,
            "gestor": gestor,
            "contactEmail": contact.get("email"),
            "contactPhone": contact.get("phone")
        }
        data_consolidated.append(opp_info)
        
    return data_consolidated
