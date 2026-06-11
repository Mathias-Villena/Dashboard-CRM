import os
import sqlite3
from typing import Dict, Any, Optional

# Determinar la ruta absoluta del directorio data
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(BASE_DIR, "data")
DB_PATH = os.path.join(DATA_DIR, "users.db")

def init_db():
    """Inicializa la base de datos y crea la tabla de usuarios con datos semilla si está vacía."""
    # Asegurar que el directorio de datos existe
    os.makedirs(DATA_DIR, exist_ok=True)
    
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    # Crear la tabla de usuarios
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            role TEXT NOT NULL,
            name TEXT NOT NULL
        )
    """)
    
    # Comprobar si hay usuarios existentes
    cursor.execute("SELECT COUNT(*) FROM users")
    count = cursor.fetchone()[0]
    
    if count == 0:
        print("[DB] La base de datos está vacía. Insertando usuarios semilla...")
        seed_users = [
            ("jefe_ti", "RomolJefe2026", "Jefe de TI", "Jefe_ti"),
            ("josue", "RomolJosue2026", "Desarrollador TI 1", "Josue"),
            ("colaborador", "RomolColab2026", "Desarrollador TI 2", "Colaborador")
        ]
        cursor.executemany("""
            INSERT INTO users (username, password, role, name)
            VALUES (?, ?, ?, ?)
        """, seed_users)
        conn.commit()
        print("[DB] Usuarios semilla insertados exitosamente.")
        
    conn.close()

def verify_user(username: str, password_raw: str) -> Optional[Dict[str, Any]]:
    """
    Verifica las credenciales de un usuario.
    Devuelve un diccionario con los datos del usuario si las credenciales son válidas,
    o None en caso contrario.
    """
    conn = sqlite3.connect(DB_PATH)
    # Configurar row_factory para obtener resultados como diccionarios
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    cursor.execute(
        "SELECT username, role, name, password FROM users WHERE username = ?",
        (username.strip(),)
    )
    row = cursor.fetchone()
    conn.close()
    
    if row and row["password"] == password_raw.strip():
        return {
            "username": row["username"],
            "role": row["role"],
            "name": row["name"]
        }
        
    return None
