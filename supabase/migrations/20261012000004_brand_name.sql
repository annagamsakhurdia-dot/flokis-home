-- Rename the default business name. A custom name is left alone.
update public.settings
set data = jsonb_set(data, '{business,name}', to_jsonb('ფლოკის სახლი'::text), true)
where id = 1
  and coalesce(data#>>'{business,name}', '') in ('', 'Grayson''s');
