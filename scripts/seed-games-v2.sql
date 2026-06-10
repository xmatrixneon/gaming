-- ============================================================================
-- GAME PROVIDERS - Simple Insert
-- ============================================================================

INSERT INTO game_provider (id, code, name, supported_currencies, supported_languages, status, category, display_order, is_synced, last_synced_at, created_at, updated_at)
VALUES
('prov_pg', 'PG', 'PGSoft', 'INR,USD,THB,EUR', 'en,th,hi', 'active', 'slots', 1, true, NOW(), NOW(), NOW()),
('prov_jl', 'JL', 'JILI', 'INR,USD,THB,VND', 'en,th,hi', 'active', 'slots', 2, true, NOW(), NOW(), NOW()),
('prov_jdb', 'JDB', 'JDB', 'INR,USD,THB,EUR', 'en,th,hi', 'active', 'slots', 3, true, NOW(), NOW(), NOW()),
('prov_saba', 'SABA', 'SABA', 'INR,USD,THB,EUR', 'en,th,vi', 'active', 'sports', 4, true, NOW(), NOW(), NOW()),
('prov_pp', 'PP', 'Pragmatic Play', 'INR,USD,THB', 'en,th,hi', 'active', 'slots', 5, true, NOW(), NOW(), NOW()),
('prov_pplive', 'PPLIVE', 'Evolution', 'INR,USD,THB', 'en,th,hi', 'active', 'live_casino', 6, true, NOW(), NOW(), NOW()),
('prov_playngo', 'PLAYNGO', 'Play n Go', 'INR,USD,THB', 'en,th,hi', 'active', 'slots', 7, true, NOW(), NOW(), NOW()),
('prov_habanero', 'HABANERO', 'Habanero', 'INR,USD,THB', 'en,th,hi', 'active', 'slots', 8, true, NOW(), NOW(), NOW()),
('prov_spribe', 'SPRIBE', 'Spribe', 'INR,USD,THB', 'en,th,hi', 'active', 'crash', 9, true, NOW(), NOW(), NOW()),
('prov_ezugi', 'EZUGI', 'Ezugi', 'INR,USD,THB', 'en,th,hi', 'active', 'live_casino', 10, true, NOW(), NOW(), NOW())
ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, updated_at = NOW();

-- ============================================================================
-- GAME CATEGORIES
-- ============================================================================

INSERT INTO game_category (id, slug, name, description, display_order, is_active, created_at, updated_at)
VALUES
('cat_slots', 'slots', 'Slots', 'Slot games', 1, true, NOW(), NOW()),
('cat_live', 'live-casino', 'Live Casino', 'Live dealer games', 2, true, NOW(), NOW()),
('cat_crash', 'crash', 'Crash Games', 'Crash games', 3, true, NOW(), NOW()),
('cat_fishing', 'fishing', 'Fishing', 'Fish games', 4, true, NOW(), NOW()),
('cat_sports', 'sports', 'Sports', 'Sports betting', 5, true, NOW(), NOW())
ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name;

-- ============================================================================
-- GAMES - Sample with placeholder images
-- ============================================================================

INSERT INTO game (id, provider_id, game_uid, game_name, game_type, supported_currencies, supported_languages, status, image_url, slug, is_featured, is_new, display_order, is_synced, created_at, updated_at)
VALUES
-- PG Soft
('game_pg_001', 'prov_pg', 'pg_mahjong_ways', 'Mahjong Ways', 'Slot', 'INR,USD', 'en', 'active', 'https://placehold.co/400x300/png/228BE6/FFF?text=Mahjong+Ways', 'mahjong-ways', true, false, 1, false, NOW(), NOW()),
('game_pg_002', 'prov_pg', 'pg_wild_bandito', 'Wild Bandito', 'Slot', 'INR,USD', 'en', 'active', 'https://placehold.co/400x300/png/228BE6/FFF?text=Wild+Bandito', 'wild-bandito', true, true, 2, false, NOW(), NOW()),
('game_pg_003', 'prov_pg', 'pg_treasures_aztec', 'Treasures of Aztec', 'Slot', 'INR,USD', 'en', 'active', 'https://placehold.co/400x300/png/228BE6/FFF?text=Aztec', 'treasures-aztec', false, false, 3, false, NOW(), NOW()),

-- JILI
('game_jl_001', 'prov_jl', 'jl_fortune_tiger', 'Fortune Tiger', 'Slot', 'INR,USD', 'en', 'active', 'https://placehold.co/400x300/png/F59E0B/FFF?text=Fortune+Tiger', 'fortune-tiger', true, true, 10, false, NOW(), NOW()),
('game_jl_002', 'prov_jl', 'jl_hot_pot', 'Hot Pot', 'Slot', 'INR,USD', 'en', 'active', 'https://placehold.co/400x300/png/F59E0B/FFF?text=Hot+Pot', 'hot-pot', true, false, 11, false, NOW(), NOW()),

-- Evolution
('game_evo_001', 'prov_pplive', 'evo_baccarat', 'Baccarat Lobby', 'Live Casino', 'INR,USD', 'en', 'active', 'https://placehold.co/400x300/png/10B981/FFF?text=Baccarat', 'baccarat-lobby', true, false, 20, false, NOW(), NOW()),
('game_evo_002', 'prov_pplive', 'evo_roulette', 'Roulette', 'Live Casino', 'INR,USD', 'en', 'active', 'https://placehold.co/400x300/png/10B981/FFF?text=Roulette', 'roulette', true, false, 21, false, NOW(), NOW()),

-- Spribe
('game_sp_001', 'prov_spribe', 'sp_aviator', 'Aviator', 'Crash', 'INR,USD', 'en', 'active', 'https://placehold.co/400x300/png/EF4444/FFF?text=Aviator', 'aviator', true, true, 30, false, NOW(), NOW()),
('game_sp_002', 'prov_spribe', 'sp_mines', 'Mines', 'Crash', 'INR,USD', 'en', 'active', 'https://placehold.co/400x300/png/EF4444/FFF?text=Mines', 'mines', true, false, 31, false, NOW(), NOW())

ON CONFLICT (game_uid) DO UPDATE SET game_name = EXCLUDED.game_name, updated_at = NOW();

-- ============================================================================
-- GAME CATEGORY RELATIONS
-- ============================================================================

INSERT INTO game_category_relation (id, game_id, category_id, display_order, created_at)
VALUES
-- Slots
('rel_001', 'game_pg_001', 'cat_slots', 1, NOW()),
('rel_002', 'game_pg_002', 'cat_slots', 2, NOW()),
('rel_003', 'game_pg_003', 'cat_slots', 3, NOW()),
('rel_004', 'game_jl_001', 'cat_slots', 4, NOW()),
('rel_005', 'game_jl_002', 'cat_slots', 5, NOW()),
-- Live Casino
('rel_006', 'game_evo_001', 'cat_live', 6, NOW()),
('rel_007', 'game_evo_002', 'cat_live', 7, NOW()),
-- Crash
('rel_008', 'game_sp_001', 'cat_crash', 8, NOW()),
('rel_009', 'game_sp_002', 'cat_crash', 9, NOW())
ON CONFLICT DO NOTHING;
