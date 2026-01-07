# Pokémon Bank — Sistema Bancario Simulado
Proyecto académico que simula el funcionamiento básico de un sistema bancario.
Este mismo incluye backend con reglas de negocio y un frontend sencillo para la interfaz.


## Tecnologías

**Backend**
- Node.js
- Express
- MySQL / MariaDB
- JWT

**Frontend**
- HTML
- CSS
- JavaScript


## Requisitos

- Node.js 18+
- MySQL o MariaDB
- Navegador web

---------------------------------------

## Instalación

### 1. Clonar repositorio
git clone <repositorio>
cd backend


### 2. Instalar dependencias
npm install


### 3. Configurar variables de entorno
Crear backend/.env:

    PORT=4000
    JWT_SECRET=mi_secreto_super_seguro
    DB_HOST=localhost
    DB_USER=root
    DB_PASSWORD=
    DB_NAME=pokemon_bank
    DB_PORT=3306


### 4. Ejecutar Backend
npm run dev

API disponible en:
http://localhost:4000


### 5. Ejecutar Frontend
El frontend se encuentra en /frontend y se ejecuta con Live Server.

- Configura en app.js:
    const API_BASE = "http://localhost:4000";

---------------------------------------

Autenticación:
- Los endpoints privados requieren:

    Authorization: Bearer <token>
    ** El token expira en 10 minutos.**

Funcionalidades:
- Registro e inicio de sesión
- Manejo de cuenta y saldo
- Transferencias con validaciones
- Beneficiarios
- Historial de movimientos

Reglas de negocio:
- Saldo máximo: 120,000
- Transferencias con saldo suficiente
- No transferencias a la misma cuenta
- Beneficiarios únicos por usuario

---------------------------------------

## Notas
    Proyecto ejecutado en entorno local

Lógica central en backend

Frontend solo consume la API
