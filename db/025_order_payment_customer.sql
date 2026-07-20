-- 025_order_payment_customer.sql — track payment separately from fulfilment, and link
-- orders to a customer record (Customers module comes next). Additive + fail-open:
-- older orders default to 'unpaid' with no customer link.
alter table orders add column if not exists payment_status text not null default 'unpaid'; -- unpaid|pending|paid|failed
alter table orders add column if not exists customer_id uuid;

create index if not exists orders_customer_idx on orders (customer_id);
create index if not exists orders_client_payment_idx on orders (client_id, payment_status);
