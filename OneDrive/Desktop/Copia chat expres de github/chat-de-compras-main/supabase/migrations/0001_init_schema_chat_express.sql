-- =====================================================
-- CHAT EXPRESS / DELTA — ESQUEMA SQL OFICIAL (MVP V1)
-- Basado en auditoria de frontend (Fase 0 - 2026-08-22)
-- =====================================================
-- ORDEN DE EJECUCION: 1) Extensiones 2) ENUMS 3) TABLAS 4) TRIGGERS 5) RLS 6) POLICIES 7) SEEDS
-- =====================================================

-- 1. Extensiones requeridas -------------------------------------------------------
create extension if not exists "pgcrypto";
create extension if not exists "uuid-ossp";

-- 2. Enums (dominios de estado del negocio extraídos del frontend ---------------
do $$ begin
  create type app_role as enum ('user', 'commerce');
exception when duplicate_object then null; end $$;

do $$ begin
  create type vehicle_type as enum ('Auto', 'Moto', 'Camioneta', 'Camión', 'Tractor', 'Otro');
exception when duplicate_object then null; end $$;

do $$ begin
  create type part_condition as enum ('Nuevo', 'Usado', 'Indistinto');
exception when duplicate_object then null; end $$;

do $$ begin
  create type request_status as enum ('open', 'matched', 'in_chat', 'negotiating', 'shipped', 'completed', 'cancelled', 'expired');
exception when duplicate_object then null; end $$;

do $$ begin
  create type chat_sender as enum ('buyer', 'seller', 'system');
exception when duplicate_object then null; end $$;

do $$ begin
  create type address_type as enum ('Casa', 'Trabajo', 'Otro');
exception when duplicate_object then null; end $$;

do $$ begin
  create type commerce_tier as enum ('FREE', 'PRO', 'PREMIUM');
exception when duplicate_object then null; end $$;

-- =====================================================
-- 3. TABLAS PRINCIPALES (orden: Perfiles primero, hijos después)
-- =====================================================

-- Tabla puente con auth.users de Supabase ---------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade not null,
  role app_role not null,
  full_name text,
  phone text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- ---------------------------------------------------------------

-- Perfil extendido de COMPRADOR / USUARIO FINAL --------------------------------
create table if not exists public.user_profiles (
  id uuid primary key references public.profiles(id) on delete cascade not null,
  birth_date date,
  total_purchases int not null default 0,
  rating numeric(3,2) not null default 5.00,
  reviews_count int not null default 0
);

-- Perfil extendido de COMERCIO ----------------------------------------------
create table if not exists public.commerce_profiles (
  id uuid primary key references public.profiles(id) on delete cascade not null,
  trade_name text not null,
  legal_name text,
  address text,
  main_category text not null default 'repuestos',
  vehicle_types text[] not null default '{}',
  inventory_systems text[] not null default '{}',
  services text[] not null default '{}',
  years_experience int,
  description text,
  schedule text,
  instagram text,
  website text,
  tier commerce_tier not null default 'FREE',
  tier_renewal_date date,
  rating numeric(3,2) not null default 5.00,
  sales_count int not null default 0,
  reviews_count int not null default 0,
  member_since date not null default current_date
);

-- Direcciones de entrega (para usuario final)------------------------------
create table if not exists public.addresses (
  id uuid primary key default gen_random_uuid() not null,
  user_id uuid references public.user_profiles(id) on delete cascade not null,
  type address_type not null default 'Casa',
  address text not null,
  city text not null,
  phone text not null,
  contact_name text,
  is_default boolean not null default false,
  created_at timestamptz not null default now()
);

-- Configuración de nichos del comercio (Automotive + subcategorías)----
create table if not exists public.commerce_niches (
  id uuid primary key default gen_random_uuid() not null,
  commerce_id uuid references public.commerce_profiles(id) on delete cascade not null,
  niche_key text not null,
  niche_name text not null,
  active boolean not null default true,
  demand text not null default 'medium',
  subcategories jsonb not null default '{}'::jsonb,
  unique (commerce_id, niche_key)
);

-- =====================================================
-- NÚCLEO DEL NEGOCIO: Solicitudes, Respuestas, Chats, Pedidos
-- =====================================================

-- Solicitud de compra creada por el usuario final --------------
create table if not exists public.requests (
  id uuid primary key default gen_random_uuid() not null,
  buyer_id uuid references public.user_profiles(id) on delete cascade not null,
  status request_status not null default 'open',
  budget numeric(12,2),
  expires_at timestamptz not null default (now() + interval '5 minutes'),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Items/productos dentro de una solicitud (una solicitud tiene N items)-------
create table if not exists public.request_items (
  id uuid primary key default gen_random_uuid() not null,
  request_id uuid references public.requests(id) on delete cascade not null,
  category text,
  item text,
  vehicle_type vehicle_type,
  vehicle_brand text,
  vehicle_model text,
  year_from int,
  year_to int,
  reference text,
  brand text,
  condition part_condition,
  quantity int not null default 1,
  notes text,
  images text[] not null default '{}'
);

-- Respuesta/Oferta de un comercio a una solicitud --------------
create table if not exists public.responses (
  id uuid primary key default gen_random_uuid() not null,
  request_id uuid references public.requests(id) on delete cascade not null,
  commerce_id uuid references public.commerce_profiles(id) on delete cascade not null,
  price numeric(12,2) not null,
  closing_message text,
  product_name text,
  product_image text,
  product_details text,
  accepted boolean,
  created_at timestamptz not null default now(),
  unique (request_id, commerce_id)
);

-- Conversación de chat (1 por solicitud + varios participantes)---------
create table if not exists public.chats (
  id uuid primary key default gen_random_uuid() not null,
  request_id uuid references public.requests(id) on delete cascade not null unique,
  buyer_id uuid references public.user_profiles(id) on delete cascade not null,
  commerce_id uuid references public.commerce_profiles(id) on delete cascade not null,
  seller_step text not null default 'initial',
  time_left_seconds int not null default 300,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Mensajes dentro de un chat -----------------------------------------
create table if not exists public.messages (
  id uuid primary key default gen_random_uuid() not null,
  chat_id uuid references public.chats(id) on delete cascade not null,
  sender chat_sender not null,
  text text not null,
  created_at timestamptz not null default now()
);

-- Datos de envío adjuntos a un chat/pedido -------------------------
create table if not exists public.shipping_data (
  chat_id uuid primary key references public.chats(id) on delete cascade not null,
  name text,
  phone text,
  street text,
  interior text,
  neighborhood text,
  city text,
  references_ text,
  photo_url text
);

-- Pedido/Order resultante tras cerrar un acuerdo -------------------
create table if not exists public.orders (
  id uuid primary key default gen_random_uuid() not null,
  chat_id uuid references public.chats(id) on delete set null,
  request_id uuid references public.requests(id) on delete set null,
  buyer_id uuid references public.user_profiles(id) not null,
  commerce_id uuid references public.commerce_profiles(id) not null,
  total_amount numeric(12,2) not null,
  status text not null default 'pending',
  buyer_rating int,
  buyer_review text,
  commerce_rating int,
  commerce_review text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Notificaciones push / bandeja --------------------------------
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid() not null,
  user_id uuid references public.profiles(id) on delete cascade not null,
  title text not null,
  body text,
  read boolean not null default false,
  link text,
  created_at timestamptz not null default now()
);

-- Historial de reviews (calificaciones entre usuarios) --------
create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid() not null,
  order_id uuid references public.orders(id) on delete set null,
  reviewer_id uuid references public.profiles(id) on delete cascade not null,
  reviewee_id uuid references public.profiles(id) on delete cascade not null,
  stars int not null check (stars between 1 and 5),
  comment text,
  created_at timestamptz not null default now()
);

-- =====================================================
-- 4. TRIGGERS de updated_at automático y perfiles automáticos
-- =====================================================
create or replace function public.handle_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_role app_role := coalesce((new.raw_user_meta_data ->> 'role')::app_role, 'user');
begin
  insert into public.profiles (id, role, full_name, phone, avatar_url)
  values (
    new.id,
    coalesce(v_role, 'user'),
    new.raw_user_meta_data ->> 'full_name',
    new.raw_user_meta_data ->> 'phone',
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do nothing;

  if coalesce(v_role, 'user') = 'user' then
    insert into public.user_profiles (id) values (new.id) on conflict (id) do nothing;
  elsif v_role = 'commerce' then
    insert into public.commerce_profiles (id, trade_name)
    values (new.id, coalesce(new.raw_user_meta_data ->> 'trade_name', 'Sin nombre'))
    on conflict (id) do nothing;
  end if;

  return new;
end; $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

do $$ declare t text; begin
  foreach t in array array['profiles','requests','chats','orders'] loop
    execute format('drop trigger if exists %I_updated_at on %I', t, t);
    execute format('create trigger %I_updated_at before update on %I for each row execute function handle_updated_at()', t, t, t, t);
  end loop;
end $$;

-- Trigger: set first address default por usuario
create or replace function public.ensure_single_default_address()
returns trigger language plpgsql as $$
begin
  if new.is_default then
    update public.addresses set is_default = false where user_id = new.user_id and id <> new.id;
  end if;
  return new;
end; $$;

drop trigger if exists ensure_single_default on public.addresses;
create trigger ensure_single_default before insert or update on public.addresses
  for each row execute function public.ensure_single_default_address();

-- =====================================================
-- 5. INDICES de performance
-- =====================================================
create index if not exists idx_requests_buyer_status on public.requests(buyer_id, status);
create index if not exists idx_requests_expires on public.requests(expires_at);
create index if not exists idx_request_items_request on public.request_items(request_id);
create index if not exists idx_responses_request on public.responses(request_id, commerce_id);
create index if not exists idx_chats_users on public.chats(buyer_id, commerce_id);
create index if not exists idx_messages_chat on public.messages(chat_id, created_at);
create index if not exists idx_addresses_user on public.addresses(user_id);
create index if not exists idx_commerce_niches_commerce on public.commerce_niches(commerce_id);
create index if not exists idx_orders_buyer_commerce on public.orders(buyer_id, commerce_id);
create index if not exists idx_notifications_user on public.notifications(user_id, read);
create index if not exists idx_reviews_reviewee on public.reviews(reviewee_id);

-- =====================================================
-- 6. ROW LEVEL SECURITY (RLS)
-- =====================================================
alter table public.profiles enable row level security;
alter table public.user_profiles enable row level security;
alter table public.commerce_profiles enable row level security;
alter table public.addresses enable row level security;
alter table public.commerce_niches enable row level security;
alter table public.requests enable row level security;
alter table public.request_items enable row level security;
alter table public.responses enable row level security;
alter table public.chats enable row level security;
alter table public.messages enable row level security;
alter table public.shipping_data enable row level security;
alter table public.orders enable row level security;
alter table public.notifications enable row level security;
alter table public.reviews enable row level security;

-- Helper: el usuario es dueño del perfil
create policy "Perfiles - lectura publica basica" on public.profiles
  for select using (true);
create policy "Perfiles - escritura propio" on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

create policy "User profile - ver todo" on public.user_profiles for select using (true);
create policy "User profile - editar propio" on public.user_profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

create policy "Commerce profile - ver todo" on public.commerce_profiles for select using (true);
create policy "Commerce profile - editar propio" on public.commerce_profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);
create policy "Commerce profile - insert propio" on public.commerce_profiles
  for insert with check (auth.uid() = id);

-- Direcciones: solo el dueño
create policy "Direcciones - full propio" on public.addresses
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Nichos del comercio: solo el comercio escribe, todos leen
create policy "Niches - lectura publica" on public.commerce_niches for select using (true);
create policy "Niches - full comercio" on public.commerce_niches
  for all using (auth.uid() = commerce_id) with check (auth.uid() = commerce_id);

-- Requests: comprador escribe/lee; comercios leen solicitudes abiertas
create policy "Requests - comprador full" on public.requests
  for all using (auth.uid() = buyer_id) with check (auth.uid() = buyer_id);
create policy "Requests - comercios leen abiertas" on public.requests
  for select using (status in ('open','matched','in_chat'));

create policy "Items - leen relacion request" on public.request_items
  for select using (exists (select 1 from public.requests r where r.id = request_id and (r.buyer_id = auth.uid() or r.status in ('open','matched','in_chat'))));
create policy "Items - escribe comprador" on public.request_items
  for insert with check (exists (select 1 from public.requests r where r.id = request_id and r.buyer_id = auth.uid()));

-- Responses: comercio escribe su respuesta; comprador/comercio leen
create policy "Responses - lectura participantes" on public.responses
  for select using (
    auth.uid() = commerce_id
    or exists (select 1 from public.requests r where r.id = request_id and r.buyer_id = auth.uid())
  );
create policy "Responses - comercio escribe la suya" on public.responses
  for insert with check (auth.uid() = commerce_id);
create policy "Responses - comercio actualiza la suya" on public.responses
  for update using (auth.uid() = commerce_id) with check (auth.uid() = commerce_id);

-- Chats: solo participantes
create policy "Chats - participantes full" on public.chats
  for all using (auth.uid() = buyer_id or auth.uid() = commerce_id)
  with check (auth.uid() = buyer_id or auth.uid() = commerce_id);

create policy "Messages - participantes full" on public.messages
  for all using (exists (select 1 from public.chats c where c.id = chat_id and (c.buyer_id = auth.uid() or c.commerce_id = auth.uid())))
  with check (exists (select 1 from public.chats c where c.id = chat_id and (c.buyer_id = auth.uid() or c.commerce_id = auth.uid())));

create policy "Shipping data - participantes" on public.shipping_data
  for all using (exists (select 1 from public.chats c where c.id = chat_id and (c.buyer_id = auth.uid() or c.commerce_id = auth.uid())))
  with check (exists (select 1 from public.chats c where c.id = chat_id and c.buyer_id = auth.uid()));

-- Orders: participantes
create policy "Orders - participantes full" on public.orders
  for all using (auth.uid() = buyer_id or auth.uid() = commerce_id)
  with check (auth.uid() = buyer_id or auth.uid() = commerce_id);

-- Notificaciones
create policy "Notificaciones - propio" on public.notifications
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Reviews
create policy "Reviews - lectura publica" on public.reviews for select using (true);
create policy "Reviews - escribe revisor" on public.reviews
  for insert with check (auth.uid() = reviewer_id);

-- Storage buckets ACL helper: buckets storage.objects (los buckets se crean en Supabase dashboard con RLS público)
