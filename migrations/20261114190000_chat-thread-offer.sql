-- -----------------------------------------------------------------------------
-- Contexto de compra del chat
-- La conversación comprador↔comercio se reutiliza entre ofertas, así que se
-- guarda la última oferta desde la que se abrió. Al confirmar la compra esa
-- oferta es la fuente real de productos, importe y moneda del pedido.
-- -----------------------------------------------------------------------------
alter table public.chat_threads
  add column if not exists offer_id uuid references public.purchase_offers(id) on delete set null;

create index if not exists chat_threads_offer_idx
  on public.chat_threads (offer_id);

-- El pedido creado desde el chat se busca por comercio y oferta; el índice
-- evita escaneos al cargar ventas/pedidos.
create index if not exists purchase_orders_offer_idx
  on public.purchase_orders (offer_id);
