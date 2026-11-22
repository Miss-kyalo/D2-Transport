ALTER TABLE garage_part_requests
    ADD COLUMN IF NOT EXISTS unit_cost_at_issue NUMERIC(12, 2);
