INSERT INTO clients (name, phone_whatsapp, email, credit_limit) VALUES
  ('Rift Valley Haulers Ltd', '+254712000101', 'fleet@riftvalleyhaulers.example', 250000.00),
  ('Coastal Container Lines', '+254722000202', 'ops@coastalcontainers.example', 500000.00);

INSERT INTO vehicles (client_id, plate_number, unit_type, make, model, vin_chassis) VALUES
  (1, 'KDL 418M', 'TRACTOR', 'Sinotruk Howo', 'ZZ4257V3247N1', 'LZZ5ELNF8MN104821'),
  (1, 'ZD 8841', 'TRAILER', 'BPW', 'Tri-Axle Flatbed', 'WBPW382910449182'),
  (2, 'KDM 902P', 'TRACTOR', 'Mercedes-Benz', 'Actros 2645 LS', 'WDB9634031L992014');

INSERT INTO inventory_items (
  sku, part_name, category, compatible_makes, oem_number, aftermarket_equivalents,
  requires_core_return, qty_on_hand, qty_reserved, reorder_level, unit_cost, selling_price
) VALUES
  (
    'FLT-FUEL-001',
    'Primary Fuel Filter Element',
    'Filtration',
    '["Sinotruk Howo", "Mercedes-Benz"]'::jsonb,
    'VG1560080019',
    '["Donaldson P550849", "Fleetguard FF5421"]'::jsonb,
    FALSE,
    18,
    0,
    5,
    1450.00,
    2400.00
  ),
  (
    'BRK-CHM-024',
    'Spring Brake Chamber Type 24/24',
    'Air Brakes',
    '["Sinotruk Howo", "BPW", "Fuwa"]'::jsonb,
    'WG9100360102',
    '["Wabco 9253220010", "Knorr K013429"]'::jsonb,
    FALSE,
    6,
    0,
    3,
    6800.00,
    10500.00
  ),
  (
    'ELC-STR-012',
    '24V Heavy Duty Starter Motor',
    'Electrical & Starting',
    '["Sinotruk Howo", "Mercedes-Benz"]'::jsonb,
    'A0061516001',
    '["Bosch 0001230015", "Delco Remy 8200412"]'::jsonb,
    TRUE,
    4,
    0,
    2,
    24500.00,
    36000.00
  );

INSERT INTO job_cards (
  job_number, client_id, tractor_id, trailer_id, status, deposit_required, deposit_paid
) VALUES
  ('JC-2026-0001', 1, 1, 2, 'INTAKE', 15000.00, 0.00),
  ('JC-2026-0002', 2, 3, NULL, 'DIAGNOSING', 25000.00, 25000.00);

INSERT INTO inspection_pins_3d (
  job_card_id, stage, vehicle_role, mesh_zone, pos_x, pos_y, pos_z, severity, notes
) VALUES
  (1, 'INTAKE', 'TRACTOR', 'front_bumper_left', -1.1500, 0.6200, 3.4100, 'LOW', 'Minor scuff on left bumper corner at check-in'),
  (1, 'INTAKE', 'TRAILER', 'axle_2_right_brake', 1.1800, 0.7800, -4.2000, 'HIGH', 'Air hiss reported around right brake chamber');

INSERT INTO stock_movements (
  item_id, job_card_id, movement_type, qty, batch_photo_url, actor_name
) VALUES
  (1, NULL, 'PURCHASE', 18, 'https://storage.example.com/batches/flt-fuel-001-b1.jpg', 'Storekeeper'),
  (2, NULL, 'PURCHASE', 6, 'https://storage.example.com/batches/brk-chm-024-b2.jpg', 'Storekeeper'),
  (3, NULL, 'PURCHASE', 4, 'https://storage.example.com/batches/elc-str-012-b1.jpg', 'Storekeeper');