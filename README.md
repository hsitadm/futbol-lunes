# ⚽ Fútbol de los Lunes

Sistema de gestión de asistencia para partidos de fútbol semanales.

## Características

- **Jugadores**: Confirman o cancelan asistencia al partido del lunes
- **Administradores**: Registran jugadores, gestionan el listado, resetean la semana
- **Tope de 24 jugadores** con lista de espera automática
- **Promoción automática** cuando alguien cancela
- **Compartir listado** por WhatsApp con un clic

## Stack Tecnológico

| Componente | Tecnología | Costo |
|---|---|---|
| Frontend | HTML/CSS/JS vanilla | Gratis |
| Hosting | Netlify | Gratis |
| Base de datos | Supabase (PostgreSQL) | Gratis |
| Autenticación | Supabase Auth | Gratis |
| WhatsApp | Deep link + clipboard | Gratis |

## Configuración

### 1. Crear proyecto en Supabase

1. Ve a [supabase.com](https://supabase.com) y crea una cuenta (puedes usar GitHub)
2. Crea un nuevo proyecto (elige una región cercana, ej: South America)
3. Espera a que se inicialice (~2 minutos)
4. Ve a **SQL Editor** y ejecuta el contenido de `database/schema.sql`
5. Ve a **Settings > API** y copia:
   - `Project URL` → será tu `SUPABASE_URL`
   - `anon public` key → será tu `SUPABASE_ANON_KEY`

### 2. Configurar el frontend

1. Abre `js/config.js`
2. Reemplaza los valores de `SUPABASE_URL` y `SUPABASE_ANON_KEY` con los de tu proyecto

### 3. Crear usuario administrador

1. En Supabase, ve a **Authentication > Users**
2. Haz clic en **Add User > Create New User**
3. Ingresa email y contraseña para el admin
4. Marca "Auto Confirm User"

### 4. Deploy en Netlify

1. Ve a [netlify.com](https://netlify.com) y crea una cuenta
2. Arrastra la carpeta del proyecto al dashboard de Netlify (drag & drop deploy)
3. O conecta tu repositorio de GitHub para deploys automáticos

## Uso

### Como Jugador
1. Entra al sitio
2. Selecciona tu nombre de la lista
3. Haz clic en "Confirmar Asistencia" o "Cancelar"

### Como Administrador
1. Haz clic en "Admin" e inicia sesión
2. Puedes:
   - Registrar nuevos jugadores
   - Ver el listado completo con estados
   - Copiar listado para WhatsApp
   - Compartir directamente en WhatsApp
   - Resetear la semana (limpiar confirmaciones)

## Estructura del Proyecto

```
futbol-lunes/
├── index.html          # Página principal (vista jugador)
├── admin.html          # Panel de administración
├── css/
│   └── styles.css      # Estilos del sitio
├── js/
│   ├── config.js       # Configuración de Supabase
│   ├── app.js          # Lógica principal (jugador)
│   ├── admin.js        # Lógica del panel admin
│   └── whatsapp.js     # Generación de mensajes WhatsApp
├── database/
│   └── schema.sql      # Script SQL para crear tablas
└── README.md           # Este archivo
```

## Licencia

Uso privado.
