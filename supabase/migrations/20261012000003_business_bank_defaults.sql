-- Fill bank and invoice-sender defaults when they are still blank.
-- Phone and termsUrl are not touched. A database that already has an IBAN is left alone.
update public.settings
set data = jsonb_set(
  jsonb_set(
    jsonb_set(
      jsonb_set(
        jsonb_set(
          data,
          '{business,bankName}',
          to_jsonb('საქართველოს ბანკი (Bank of Georgia)'::text),
          true
        ),
        '{business,iban}',
        to_jsonb('GE44BG0000000612766478'::text),
        true
      ),
      '{business,accountNumber}',
      to_jsonb('510001200'::text),
      true
    ),
    '{business,recipient}',
    to_jsonb('მიშა კაჭკაჭიშვილი'::text),
    true
  ),
  '{business,invoiceSenderEmail}',
  to_jsonb('mikheilkachkachishvili@gmail.com'::text),
  true
)
where id = 1
  and coalesce(data#>>'{business,iban}', '') = '';
