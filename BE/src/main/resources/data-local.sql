-- Synthetic catalogue for the local H2 profile. Existing rows are never overwritten at startup.
INSERT INTO room_type (room_type_id, type_name, capacity, base_price, amenities, description)
SELECT 1001, 'Local Standard', 2, 500000.00, 'Wifi, TV, Air conditioning', 'Synthetic local development room'
WHERE NOT EXISTS (SELECT 1 FROM room_type WHERE room_type_id = 1001);

INSERT INTO room_type (room_type_id, type_name, capacity, base_price, amenities, description)
SELECT 1002, 'Local Deluxe', 2, 850000.00, 'Wifi, Balcony, Minibar', 'Synthetic local development room'
WHERE NOT EXISTS (SELECT 1 FROM room_type WHERE room_type_id = 1002);

INSERT INTO room_type (room_type_id, type_name, capacity, base_price, amenities, description)
SELECT 1003, 'Local Family Suite', 4, 1500000.00, 'Wifi, Kitchen, Sofa bed', 'Synthetic local development room'
WHERE NOT EXISTS (SELECT 1 FROM room_type WHERE room_type_id = 1003);

INSERT INTO room (room_id, room_number, room_type_id, floor, status, note, updated_at)
SELECT 1001, 'LOCAL-101', 1001, 1, 'AVAILABLE', 'Synthetic local development room', CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM room WHERE room_id = 1001);

INSERT INTO room (room_id, room_number, room_type_id, floor, status, note, updated_at)
SELECT 1002, 'LOCAL-201', 1002, 2, 'AVAILABLE', 'Synthetic local development room', CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM room WHERE room_id = 1002);

INSERT INTO room (room_id, room_number, room_type_id, floor, status, note, updated_at)
SELECT 1003, 'LOCAL-301', 1003, 3, 'AVAILABLE', 'Synthetic local development room', CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM room WHERE room_id = 1003);
