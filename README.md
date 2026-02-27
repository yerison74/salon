# 💇 Salón Control — POS System

Sistema de punto de venta (POS) para salón de belleza, **migrado de MongoDB a Supabase**.

## ✨ Mejoras en esta versión

### 🗄️ Migración a Supabase
- **MongoDB → Supabase (PostgreSQL)** con esquema relacional optimizado
- Función SQL `recalcular_resumen_diario()` para consistencia de datos
- Row Level Security (RLS) habilitado
- UUIDs en lugar de timestamps como IDs
- Índices en columnas de fecha para búsquedas rápidas
- Campo `hora` separado de `fecha` (mejor para queries y visualización)
- Soft delete en empleadas (campo `activa`)

### 🎨 Mejoras Visuales
- Diseño limpio y moderno con paleta rosa/pink para estética de salón
- Tipografía **DM Sans** y **DM Mono** para mejor legibilidad
- Cards con gradientes suaves y sombras refinadas
- Hero card animada para el total en caja
- Indicadores visuales de método de pago con color-coding
- Barras de progreso en estadísticas de empleadas
- Toast notifications en lugar de alerts
- Loading spinner elegante
- Sidebar con navegación mejorada y selector de fecha integrado

## 🚀 Setup Rápido

### 1. Instalar dependencias
```bash
npm install
```

### 2. Configurar Supabase

1. Ve a [supabase.com](https://supabase.com) y crea una cuenta gratuita
2. Crea un nuevo proyecto
3. En el **SQL Editor**, ejecuta el contenido de `supabase/schema.sql`
4. Ve a **Settings → API** y copia tu URL y anon key

### 3. Variables de entorno
```bash
cp .env.local.example .env.local
# Edita .env.local con tus credenciales de Supabase
```

### 4. Correr en desarrollo
```bash
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000)

## 📊 Estructura de la Base de Datos

| Tabla | Descripción | Equivalente MongoDB |
|-------|-------------|---------------------|
| `empleadas` | Personal del salón | `empleadas` |
| `transacciones` | Ventas del día | `transactions` |
| `gastos_imprevistos` | Gastos inesperados | `expenses` |
| `resumen_diario` | Resumen por fecha | `dailySummaries` |

## 🗺️ Estructura del Proyecto

```
salon-pos/
├── app/
│   ├── page.tsx          # UI principal (componente único)
│   ├── layout.tsx        # Layout con fonts
│   └── globals.css       # Estilos globales
├── actions/
│   └── index.ts          # Server Actions (reemplazan API routes de MongoDB)
├── lib/
│   ├── supabase.ts       # Cliente Supabase + TypeScript types
│   └── utils.ts          # Helpers (formatCurrency, formatTime, etc.)
├── supabase/
│   └── schema.sql        # 🔑 Ejecutar esto en Supabase SQL Editor
└── .env.local.example    # Template de variables de entorno
```

## 💡 Diferencias clave vs versión MongoDB

| Aspecto | MongoDB | Supabase |
|---------|---------|----------|
| IDs | `Date.now().toString()` | UUID v4 (más seguro) |
| Fechas | String `"dd/MM/yyyy"` | `date` nativa de PostgreSQL |
| Horas | Embebido en fecha | Campo `time` separado |
| Conexión | `connectToDatabase()` cached | `createClient()` singleton |
| Recálculo | JS en cada acción | Función SQL reutilizable |
| Borrado empleadas | Físico | Soft delete (`activa: false`) |

## 📋 Funcionalidades

- ✅ **Dashboard** — Resumen financiero del día con KPIs visuales
- ✅ **Nueva Venta** — Registro con cálculo automático (tarjeta +5%, cambio en efectivo)
- ✅ **Transacciones** — Historial con filtro por fecha
- ✅ **Gastos Imprevistos** — Control de salidas de caja
- ✅ **Estadísticas** — Por método de pago y empleada
- ✅ **Empleadas** — ABM del equipo
- ✅ **Configuración** — Monto inicial por día
- ✅ **Exportar PDF** — Reporte completo del día
- ✅ **Exportar Excel** — Datos para análisis
- ✅ **Navegación por fechas** — Ver histórico de cualquier día
