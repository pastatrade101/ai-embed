-- 024_inventory.sql — Products & Inventory foundation (AI BOS Phase: Inventory).
-- Money is stored in INTEGER MINOR UNITS (price_minor/cost_minor). Stock is never
-- edited directly: every change goes through the stock_movements ledger via the
-- atomic functions below, and available = on_hand - reserved. Tenant-isolated by
-- client_id. FAILS OPEN before this runs (services detect the missing table/function
-- and no-op, so Orders keeps working on the knowledge_items catalogue).

create table if not exists product_categories (
	id uuid primary key default gen_random_uuid(),
	client_id uuid not null references clients(id) on delete cascade,
	name text not null,
	parent_id uuid references product_categories(id) on delete set null,
	sort int not null default 0,
	created_at timestamptz not null default now()
);
create index if not exists product_categories_client_idx on product_categories (client_id);

create table if not exists products (
	id uuid primary key default gen_random_uuid(),
	client_id uuid not null references clients(id) on delete cascade,
	name text not null,
	description text,
	sku text,
	barcode text,
	category_id uuid references product_categories(id) on delete set null,
	brand text,
	unit text not null default 'unit',            -- bag, box, kg, piece…
	price_minor bigint not null default 0,         -- selling price, minor units
	cost_minor bigint not null default 0,          -- cost price, minor units
	currency text not null default 'USD',
	tax_rate numeric not null default 0,           -- % applied at sale
	track_inventory boolean not null default true,
	min_stock int not null default 0,
	active boolean not null default true,
	images jsonb not null default '[]'::jsonb,     -- [url,…]
	attributes jsonb not null default '{}'::jsonb, -- custom attributes
	tags jsonb not null default '[]'::jsonb,
	aliases jsonb not null default '[]'::jsonb,     -- search / WhatsApp / AI-matching keywords
	meta jsonb not null default '{}'::jsonb,
	created_at timestamptz not null default now(),
	updated_at timestamptz not null default now()
);
create index if not exists products_client_idx on products (client_id, updated_at desc);
create index if not exists products_client_active_idx on products (client_id, active);
create unique index if not exists products_client_sku_uq on products (client_id, sku) where sku is not null and sku <> '';

-- Optional variants (display + future variant-level stock). Phase-1 stock is tracked
-- at product level; variant_id rides along in the ledger for a later additive upgrade.
create table if not exists product_variants (
	id uuid primary key default gen_random_uuid(),
	client_id uuid not null references clients(id) on delete cascade,
	product_id uuid not null references products(id) on delete cascade,
	name text not null,
	sku text,
	price_minor bigint,
	attributes jsonb not null default '{}'::jsonb,
	active boolean not null default true,
	created_at timestamptz not null default now()
);
create index if not exists product_variants_product_idx on product_variants (product_id);

create table if not exists warehouses (
	id uuid primary key default gen_random_uuid(),
	client_id uuid not null references clients(id) on delete cascade,
	name text not null,
	is_default boolean not null default false,
	address text,
	created_at timestamptz not null default now()
);
create index if not exists warehouses_client_idx on warehouses (client_id);

-- Current balances. available = on_hand - reserved. One row per (product, warehouse).
create table if not exists inventory_balances (
	id uuid primary key default gen_random_uuid(),
	client_id uuid not null references clients(id) on delete cascade,
	product_id uuid not null references products(id) on delete cascade,
	warehouse_id uuid not null references warehouses(id) on delete cascade,
	on_hand int not null default 0,
	reserved int not null default 0,
	updated_at timestamptz not null default now(),
	unique (product_id, warehouse_id)
);
create index if not exists inventory_balances_client_idx on inventory_balances (client_id);

-- Append-only ledger. Never edit a balance without a movement.
create table if not exists stock_movements (
	id uuid primary key default gen_random_uuid(),
	client_id uuid not null references clients(id) on delete cascade,
	product_id uuid not null references products(id) on delete cascade,
	variant_id uuid references product_variants(id) on delete set null,
	warehouse_id uuid not null references warehouses(id) on delete cascade,
	type text not null,   -- opening|purchase|adjustment|reservation|release|sale|return|transfer_in|transfer_out|damage|expiry
	qty int not null,     -- signed for adjustment; positive magnitude otherwise
	reason text,
	ref_type text,        -- order|invoice|manual…
	ref_id uuid,
	created_by uuid references users(id) on delete set null,
	created_at timestamptz not null default now()
);
create index if not exists stock_movements_client_idx on stock_movements (client_id, created_at desc);
create index if not exists stock_movements_product_idx on stock_movements (product_id, created_at desc);
create index if not exists stock_movements_ref_idx on stock_movements (ref_type, ref_id);

alter table product_categories enable row level security;
alter table products enable row level security;
alter table product_variants enable row level security;
alter table warehouses enable row level security;
alter table inventory_balances enable row level security;
alter table stock_movements enable row level security;

-- ── Atomic stock operations (one transaction each) ──────────────────────────

-- General movement (opening/purchase/adjustment/return/damage/…). on_hand delta by type.
create or replace function apply_stock_movement(
	p_client uuid, p_product uuid, p_warehouse uuid, p_type text, p_qty int,
	p_reason text default null, p_ref_type text default null, p_ref_id uuid default null
) returns void language plpgsql as $$
declare v_delta int;
begin
	v_delta := case p_type
		when 'opening' then p_qty
		when 'purchase' then p_qty
		when 'return' then p_qty
		when 'transfer_in' then p_qty
		when 'adjustment' then p_qty      -- caller passes a signed qty
		when 'sale' then -p_qty
		when 'damage' then -p_qty
		when 'expiry' then -p_qty
		when 'transfer_out' then -p_qty
		else 0 end;
	insert into inventory_balances (client_id, product_id, warehouse_id, on_hand, reserved)
		values (p_client, p_product, p_warehouse, greatest(0, v_delta), 0)
		on conflict (product_id, warehouse_id)
		do update set on_hand = greatest(0, inventory_balances.on_hand + v_delta), updated_at = now();
	insert into stock_movements (client_id, product_id, warehouse_id, type, qty, reason, ref_type, ref_id)
		values (p_client, p_product, p_warehouse, p_type, p_qty, p_reason, p_ref_type, p_ref_id);
end; $$;

-- Reserve stock for an order, all-or-nothing. p_items = jsonb[{product_id,warehouse_id,qty}].
-- Returns { ok, shortages:[{product_id,requested,available}] }. Reserves nothing on shortage
-- unless p_allow_backorder. Row locks make the check+apply atomic within this transaction.
create or replace function reserve_order_stock(
	p_client uuid, p_order uuid, p_items jsonb, p_allow_backorder boolean default false
) returns jsonb language plpgsql as $$
declare
	it jsonb; v_pid uuid; v_wid uuid; v_qty int;
	v_onhand int; v_reserved int; v_avail int;
	shortages jsonb := '[]'::jsonb;
begin
	for it in select * from jsonb_array_elements(p_items) loop
		v_pid := (it->>'product_id')::uuid;
		v_wid := (it->>'warehouse_id')::uuid;
		v_qty := coalesce((it->>'qty')::int, 0);
		if v_qty <= 0 or v_pid is null or v_wid is null then continue; end if;
		select on_hand, reserved into v_onhand, v_reserved
			from inventory_balances
			where client_id = p_client and product_id = v_pid and warehouse_id = v_wid
			for update;
		if not found then v_onhand := 0; v_reserved := 0; end if;
		v_avail := v_onhand - v_reserved;
		if v_qty > v_avail and not p_allow_backorder then
			shortages := shortages || jsonb_build_object('product_id', v_pid, 'requested', v_qty, 'available', v_avail);
		end if;
	end loop;

	if jsonb_array_length(shortages) > 0 then
		return jsonb_build_object('ok', false, 'shortages', shortages);
	end if;

	for it in select * from jsonb_array_elements(p_items) loop
		v_pid := (it->>'product_id')::uuid;
		v_wid := (it->>'warehouse_id')::uuid;
		v_qty := coalesce((it->>'qty')::int, 0);
		if v_qty <= 0 or v_pid is null or v_wid is null then continue; end if;
		insert into inventory_balances (client_id, product_id, warehouse_id, on_hand, reserved)
			values (p_client, v_pid, v_wid, 0, v_qty)
			on conflict (product_id, warehouse_id)
			do update set reserved = inventory_balances.reserved + v_qty, updated_at = now();
		insert into stock_movements (client_id, product_id, warehouse_id, type, qty, ref_type, ref_id)
			values (p_client, v_pid, v_wid, 'reservation', v_qty, 'order', p_order);
	end loop;

	return jsonb_build_object('ok', true, 'shortages', '[]'::jsonb);
end; $$;

-- Release an order's still-reserved stock (cancellation/return). Idempotent: computes
-- the net reserved remaining for the order from the ledger and releases exactly that.
create or replace function release_order_stock(p_client uuid, p_order uuid)
returns void language plpgsql as $$
declare rec record;
begin
	for rec in
		select product_id, warehouse_id,
			sum(case when type = 'reservation' then qty when type in ('release','sale') then -qty else 0 end) as net_reserved
		from stock_movements
		where client_id = p_client and ref_type = 'order' and ref_id = p_order
		group by product_id, warehouse_id
		having sum(case when type = 'reservation' then qty when type in ('release','sale') then -qty else 0 end) > 0
	loop
		update inventory_balances set reserved = greatest(0, reserved - rec.net_reserved), updated_at = now()
			where client_id = p_client and product_id = rec.product_id and warehouse_id = rec.warehouse_id;
		insert into stock_movements (client_id, product_id, warehouse_id, type, qty, ref_type, ref_id)
			values (p_client, rec.product_id, rec.warehouse_id, 'release', rec.net_reserved, 'order', p_order);
	end loop;
end; $$;

-- Convert an order's remaining reservation into a final sale (completion): reduce both
-- on_hand and reserved by the net still-reserved qty. Idempotent for the same order.
create or replace function deduct_order_stock(p_client uuid, p_order uuid)
returns void language plpgsql as $$
declare rec record;
begin
	for rec in
		select product_id, warehouse_id,
			sum(case when type = 'reservation' then qty when type in ('release','sale') then -qty else 0 end) as net_reserved
		from stock_movements
		where client_id = p_client and ref_type = 'order' and ref_id = p_order
		group by product_id, warehouse_id
		having sum(case when type = 'reservation' then qty when type in ('release','sale') then -qty else 0 end) > 0
	loop
		update inventory_balances
			set on_hand = greatest(0, on_hand - rec.net_reserved),
			    reserved = greatest(0, reserved - rec.net_reserved),
			    updated_at = now()
			where client_id = p_client and product_id = rec.product_id and warehouse_id = rec.warehouse_id;
		insert into stock_movements (client_id, product_id, warehouse_id, type, qty, ref_type, ref_id)
			values (p_client, rec.product_id, rec.warehouse_id, 'sale', rec.net_reserved, 'order', p_order);
	end loop;
end; $$;
