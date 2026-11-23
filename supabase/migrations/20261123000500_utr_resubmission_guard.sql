-- A UTR pays for one period, once. The guard ran only when an order's UTR changed, so a
-- rejected order resubmitted with the UTR it already carried skipped it, even after
-- another order had been paid with that UTR. It now runs whenever an order becomes
-- submitted.
drop trigger upi_order_utr_unused on public.upi_orders;
create trigger upi_order_utr_unused before update of utr, status on public.upi_orders
  for each row when (new.status = 'submitted' and new.utr is not null
    and (new.utr is distinct from old.utr or old.status is distinct from 'submitted'))
  execute function public.refuse_used_utr();
