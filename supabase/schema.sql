-- ============================================================
-- SALON POS - Supabase Database Schema v2
-- Incluye tabla de participaciones de empleadas por transacción
-- Seguro para re-ejecutar (idempotente)
-- ============================================================
-- MIGRACIÓN (si la BD ya existe, ejecutar esto primero):
-- ALTER TABLE public.transacciones ADD COLUMN IF NOT EXISTS banco_transferencia text;
-- ALTER TABLE public.transacciones DROP CONSTRAINT IF EXISTS transacciones_metodo_pago_check;
-- ALTER TABLE public.transacciones ADD CONSTRAINT transacciones_metodo_pago_check CHECK (metodo_pago IN ('efectivo','tarjeta','transferencia','fiado'));
-- ============================================================

create extension if not exists "uuid-ossp";

-- ============================================================
-- TABLA: empleadas
-- ============================================================
create table if not exists public.empleadas (
  id             uuid primary key default uuid_generate_v4(),
  nombre         text not null,
  fecha_registro date not null default current_date,
  activa         boolean not null default true,
  created_at     timestamptz not null default now()
);
alter table public.empleadas enable row level security;
drop policy if exists "Allow all on empleadas" on public.empleadas;
create policy "Allow all on empleadas" on public.empleadas for all using (true) with check (true);

-- ============================================================
-- TABLA: resumen_diario
-- ============================================================
create table if not exists public.resumen_diario (
  id                       uuid primary key default uuid_generate_v4(),
  fecha                    date not null unique,
  monto_inicial            numeric(12,2) not null default 0,
  total_efectivo           numeric(12,2) not null default 0,
  total_transferencias     numeric(12,2) not null default 0,
  total_devuelto           numeric(12,2) not null default 0,
  total_gastos_imprevistos numeric(12,2) not null default 0,
  saldo_final              numeric(12,2) not null default 0,
  total_general            numeric(12,2) not null default 0,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);
alter table public.resumen_diario enable row level security;
drop policy if exists "Allow all on resumen_diario" on public.resumen_diario;
create policy "Allow all on resumen_diario" on public.resumen_diario for all using (true) with check (true);

create or replace function public.handle_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

drop trigger if exists resumen_diario_updated_at on public.resumen_diario;
create trigger resumen_diario_updated_at
  before update on public.resumen_diario
  for each row execute procedure public.handle_updated_at();

-- ============================================================
-- TABLA: transacciones
-- ============================================================
create table if not exists public.transacciones (
  id               uuid primary key default uuid_generate_v4(),
  fecha            date not null default current_date,
  hora             time not null default current_time,
  cliente          text not null,
  metodo_pago      text not null check (metodo_pago in ('efectivo','tarjeta','transferencia','fiado')),
  banco_transferencia text,
  monto_recibido   numeric(12,2) not null default 0,
  monto_servicio   numeric(12,2) not null default 0,
  cambio_entregado numeric(12,2) not null default 0,
  observaciones    text not null default '',
  created_at       timestamptz not null default now()
);
alter table public.transacciones enable row level security;
drop policy if exists "Allow all on transacciones" on public.transacciones;
create policy "Allow all on transacciones" on public.transacciones for all using (true) with check (true);
create index if not exists transacciones_fecha_idx on public.transacciones(fecha);

-- ============================================================
-- TABLA: participaciones_empleadas
-- Registra qué hizo cada empleada en cada transacción
-- y calcula su comisión individual
-- ============================================================
create table if not exists public.participaciones_empleadas (
  id               uuid primary key default uuid_generate_v4(),
  transaccion_id   uuid not null references public.transacciones(id) on delete cascade,
  empleada_nombre  text not null,
  servicio         text not null,   -- 'todo','lava_rolo','lavado_secado','lavado','secado','rolo'
  porcentaje       numeric(5,2) not null,
  monto_base       numeric(12,2) not null,  -- monto_servicio / total_empleadas
  comision         numeric(12,2) not null,  -- monto_base * porcentaje / 100
  fecha            date not null,
  created_at       timestamptz not null default now()
);
alter table public.participaciones_empleadas enable row level security;
drop policy if exists "Allow all on participaciones_empleadas" on public.participaciones_empleadas;
create policy "Allow all on participaciones_empleadas" on public.participaciones_empleadas for all using (true) with check (true);
create index if not exists participaciones_tx_idx on public.participaciones_empleadas(transaccion_id);
create index if not exists participaciones_fecha_idx on public.participaciones_empleadas(fecha);

-- ============================================================
-- TABLA: gastos_imprevistos
-- ============================================================
create table if not exists public.gastos_imprevistos (
  id          uuid primary key default uuid_generate_v4(),
  fecha       date not null default current_date,
  hora        time not null default current_time,
  monto       numeric(12,2) not null,
  descripcion text not null,
  created_at  timestamptz not null default now()
);
alter table public.gastos_imprevistos enable row level security;
drop policy if exists "Allow all on gastos_imprevistos" on public.gastos_imprevistos;
create policy "Allow all on gastos_imprevistos" on public.gastos_imprevistos for all using (true) with check (true);
create index if not exists gastos_fecha_idx on public.gastos_imprevistos(fecha);

-- ============================================================
-- FUNCIÓN: recalcular_resumen_diario
-- ============================================================
create or replace function public.recalcular_resumen_diario(p_fecha date)
returns void language plpgsql as $$
declare
  v_monto_inicial        numeric(12,2);
  v_total_efectivo       numeric(12,2);
  v_total_transferencias numeric(12,2);
  v_total_devuelto       numeric(12,2);
  v_total_gastos         numeric(12,2);
  v_saldo_final          numeric(12,2);
  v_total_general        numeric(12,2);
begin
  select coalesce(monto_inicial,0) into v_monto_inicial
  from public.resumen_diario where fecha = p_fecha;
  if not found then v_monto_inicial := 0; end if;

  select
    coalesce(sum(case when metodo_pago='efectivo' then monto_recibido else 0 end),0),
    coalesce(sum(case when metodo_pago in ('tarjeta','transferencia') then monto_recibido else 0 end),0),
    coalesce(sum(cambio_entregado),0)
  into v_total_efectivo, v_total_transferencias, v_total_devuelto
  from public.transacciones where fecha = p_fecha;

  select coalesce(sum(monto),0) into v_total_gastos
  from public.gastos_imprevistos where fecha = p_fecha;

  v_saldo_final   := v_monto_inicial + v_total_efectivo - v_total_devuelto - v_total_gastos;
  v_total_general := v_saldo_final + v_total_transferencias;

  insert into public.resumen_diario (
    fecha, monto_inicial, total_efectivo, total_transferencias,
    total_devuelto, total_gastos_imprevistos, saldo_final, total_general
  ) values (
    p_fecha, v_monto_inicial, v_total_efectivo, v_total_transferencias,
    v_total_devuelto, v_total_gastos, v_saldo_final, v_total_general
  )
  on conflict (fecha) do update set
    total_efectivo=excluded.total_efectivo,
    total_transferencias=excluded.total_transferencias,
    total_devuelto=excluded.total_devuelto,
    total_gastos_imprevistos=excluded.total_gastos_imprevistos,
    saldo_final=excluded.saldo_final,
    total_general=excluded.total_general,
    updated_at=now();
end; $$;

-- ============================================================
-- SEED: empleadas de ejemplo (solo si la tabla está vacía)
-- ============================================================
insert into public.empleadas (nombre)
select nombre from (values ('Ana García'),('Laura Pérez'),('María Santos')) as v(nombre)
where not exists (select 1 from public.empleadas limit 1);

-- ============================================================
-- TABLA: pagos_comisiones
-- Registra cada pago quincenal de comisiones a empleadas
-- ============================================================
create table if not exists public.pagos_comisiones (
  id               uuid primary key default uuid_generate_v4(),
  empleada_nombre  text not null,
  fecha_desde      date not null,
  fecha_hasta      date not null,
  monto_total      numeric(12,2) not null,
  fecha_pago       date not null default current_date,
  notas            text not null default '',
  created_at       timestamptz not null default now()
);
alter table public.pagos_comisiones enable row level security;
drop policy if exists "Allow all on pagos_comisiones" on public.pagos_comisiones;
create policy "Allow all on pagos_comisiones" on public.pagos_comisiones for all using (true) with check (true);
create index if not exists pagos_com_empleada_idx on public.pagos_comisiones(empleada_nombre);
create index if not exists pagos_com_fecha_idx on public.pagos_comisiones(fecha_pago);

-- ============================================================
-- TABLA: fiados
-- Registra deudas de clientes (crédito/fiado)
-- ============================================================
create table if not exists public.fiados (
  id               uuid primary key default uuid_generate_v4(),
  cliente_nombre   text not null,
  descripcion      text not null default '',
  monto_total      numeric(12,2) not null,
  monto_pagado     numeric(12,2) not null default 0,
  fecha            date not null default current_date,
  saldado          boolean not null default false,
  fecha_saldado    date,
  notas            text not null default '',
  created_at       timestamptz not null default now()
);
alter table public.fiados enable row level security;
drop policy if exists "Allow all on fiados" on public.fiados;
create policy "Allow all on fiados" on public.fiados for all using (true) with check (true);
create index if not exists fiados_cliente_idx on public.fiados(cliente_nombre);
create index if not exists fiados_saldado_idx on public.fiados(saldado);

-- ============================================================
-- TABLA: abonos_fiados
-- Registra cada abono parcial a un fiado
-- ============================================================
create table if not exists public.abonos_fiados (
  id        uuid primary key default uuid_generate_v4(),
  fiado_id  uuid not null references public.fiados(id) on delete cascade,
  monto     numeric(12,2) not null,
  fecha     date not null default current_date,
  notas     text not null default '',
  created_at timestamptz not null default now()
);
alter table public.abonos_fiados enable row level security;
drop policy if exists "Allow all on abonos_fiados" on public.abonos_fiados;
create policy "Allow all on abonos_fiados" on public.abonos_fiados for all using (true) with check (true);
create index if not exists abonos_fiado_idx on public.abonos_fiados(fiado_id);

-- Variables de entorno en .env.local:
-- NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
-- NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJxxxxxx
