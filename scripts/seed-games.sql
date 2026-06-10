-- ============================================================================
-- GAME PROVIDERS SEED SCRIPT
-- ============================================================================
-- Run this with: docker exec -i casino-postgres psql -U postgres -d casino_db

-- Insert Game Providers
INSERT INTO game_provider (id, code, name, supported_currencies, supported_languages, status, category, display_order, is_synced, last_synced_at, created_at, updated_at)
VALUES
-- Top Providers with INR support
('prov_pg', 'PG', 'PGSoft', 'INR,USD,THB,EUR,GBP', 'en,th,hi,zh', 'active', 'slots', 1, true, NOW(), NOW(), NOW()),
('prov_jl', 'JL', 'JILI', 'INR,USD,THB,VND,MYR,IDR', 'en,th,hi,vi,zh', 'active', 'slots', 2, true, NOW(), NOW(), NOW()),
('prov_jdb', 'JDB', 'JDB', 'INR,USD,THB,EUR,GBP', 'en,th,hi,zh', 'active', 'slots', 3, true, NOW(), NOW(), NOW()),
('prov_saba', 'SABA', 'SABA', 'INR,USD,THB,EUR,GBP', 'en,th,vi,ja,ko', 'active', 'sports', 4, true, NOW(), NOW(), NOW()),
('prov_pp', 'PP', 'Pragmatic Play', 'INR,USD,THB,EUR', 'en,id,th,vi,zh', 'active', 'slots', 5, true, NOW(), NOW(), NOW()),
('prov_pplive', 'PPLIVE', 'Evolution Live', 'INR,USD,THB,EUR,GBP', 'en,da,de,es,fi,fr,hi', 'active', 'live_casino', 6, true, NOW(), NOW(), NOW()),
('prov_playngo', 'PLAYNGO', "Play'n Go", 'INR,USD,THB,EUR', 'en,th,hi,vi', 'active', 'slots', 7, true, NOW(), NOW(), NOW()),
('prov_habanero', 'HABANERO', 'Habanero', 'INR,USD,THB,EUR', 'en,th,hi,vi', 'active', 'slots', 8, true, NOW(), NOW(), NOW()),
('prov_spribe', 'SPRIBE', 'Spribe', 'INR,USD,THB,EUR', 'en,th,hi,vi', 'active', 'crash', 9, true, NOW(), NOW(), NOW()),
('prov_ezugi', 'EZUGI', 'Ezugi', 'INR,USD,THB,BRL,MYR', 'en,th,hi,vi', 'active', 'live_casino', 10, true, NOW(), NOW(), NOW())
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  supported_currencies = EXCLUDED.supported_currencies,
  supported_languages = EXCLUDED.supported_languages,
  status = EXCLUDED.status,
  last_synced_at = EXCLUDED.last_synced_at,
  updated_at = NOW();

-- ============================================================================
-- GAMES SEED SCRIPT - Sample Games with Images
-- ============================================================================
-- IMPORTANT: Update image_url with your actual game images
-- You can use S3, CDN, or local storage URLs

-- PG Soft Games (Top slots in India)
INSERT INTO game (id, provider_id, game_uid, game_name, game_type, supported_currencies, supported_languages, status, image_url, thumbnail_url, slug, is_featured, is_new, display_order, is_synced, created_at, updated_at)
VALUES
-- Popular PG Soft Games
('game_pg_mahjong', 'prov_pg', '1189baca156e1bbbecc3b26651a63565', 'Mahjong Ways', 'Slot', 'INR,USD,THB', 'en,th,hi', 'active',
 'https://images.prismic.io/slots/api/mahjong-ways.jpg?auto=format,compress',
 'https://images.prismic.io/slots/api/mahjong-ways-thumb.jpg?auto=format,compress',
 'mahjong-ways-1189baca', true, false, 1, true, NOW(), NOW()),

('game_pg_wildbandito', 'prov_pg', 'wild-bandito-pg', 'Wild Bandito', 'Slot', 'INR,USD,THB', 'en,th,hi', 'active',
 'https://images.prismic.io/slots/api/wild-bandito.jpg?auto=format,compress',
 'https://images.prismic.io/slots/api/wild-bandito-thumb.jpg?auto=format,compress',
 'wild-bandito-pg', true, true, 2, true, NOW(), NOW()),

('game_pg_treasures', 'prov_pg', 'treasures-of-aztec-pg', 'Treasures of Aztec', 'Slot', 'INR,USD,THB', 'en,th,hi', 'active',
 'https://images.prismic.io/slots/api/treasures-aztec.jpg?auto=format,compress',
 'https://images.prismic.io/slots/api/treasures-aztec-thumb.jpg?auto=format,compress',
 'treasures-aztec-pg', false, false, 3, true, NOW(), NOW()),

('game_pg_winwin', 'prov_pg', 'win-win-fish-pg', 'Win Win Fish', 'Fishing', 'INR,USD,THB', 'en,th,hi', 'active',
 'https://images.prismic.io/slots/api/win-win-fish.jpg?auto=format,compress',
 'https://images.prismic.io/slots/api/win-win-fish-thumb.jpg?auto=format,compress',
 'win-win-fish-pg', true, false, 4, true, NOW(), NOW()),

-- JILI Games
('game_jl_hotpot', 'prov_jl', 'hot-pot-jl', 'Hot Pot', 'Slot', 'INR,USD,THB', 'en,th,hi,vi', 'active',
 'https://images.prismic.io/slots/api/hot-pot.jpg?auto=format,compress',
 'https://images.prismic.io/slots/api/hot-pot-thumb.jpg?auto=format,compress',
 'hot-pot-jl', true, true, 10, true, NOW(), NOW()),

('game_jl_fortune', 'prov_jl', 'fortune-tiger-jl', 'Fortune Tiger', 'Slot', 'INR,USD,THB', 'en,th,hi,vi', 'active',
 'https://images.prismic.io/slots/api/fortune-tiger.jpg?auto=format,compress',
 'https://images.prismic.io/slots/api/fortune-tiger-thumb.jpg?auto=format,compress',
 'fortune-tiger-jl', true, true, 11, true, NOW(), NOW()),

-- Evolution Live Games
('game_evo_baccarat', 'prov_pplive', 'e58e145313cf8c3a41a2240c1579b735', 'Baccarat Lobby', 'Live Casino', 'INR,USD,THB,EUR', 'en,th,hi', 'active',
 'https://images.prismic.io/slots/api/baccarat-lobby.jpg?auto=format,compress',
 'https://images.prismic.io/slots/api/baccarat-lobby-thumb.jpg?auto=format,compress',
 'baccarat-lobby-evo', true, false, 20, true, NOW(), NOW()),

('game_evo_blackjack', 'prov_pplive', 'evo-blackjack-live', 'Blackjack VIP', 'Live Casino', 'INR,USD,THB,EUR', 'en,th,hi', 'active',
 'https://images.prismic.io/slots/api/blackjack-vip.jpg?auto=format,compress',
 'https://images.prismic.io/slots/api/blackjack-vip-thumb.jpg?auto=format,compress',
 'blackjack-vip-evo', false, false, 21, true, NOW(), NOW()),

('game_evo_roulette', 'prov_pplive', 'evo-roulette-live', 'Roulette Live', 'Live Casino', 'INR,USD,THB,EUR', 'en,th,hi', 'active',
 'https://images.prismic.io/slots/api/roulette-live.jpg?auto=format,compress',
 'https://images.prismic.io/slots/api/roulette-live-thumb.jpg?auto=format,compress',
 'roulette-live-evo', false, false, 22, true, NOW(), NOW()),

-- Spribe Crash Games
('game_spribe_aviator', 'prov_spribe', 'aviator-spribe', 'Aviator', 'Crash', 'INR,USD,THB', 'en,th,hi', 'active',
 'https://images.prismic.io/slots/api/aviator.jpg?auto=format,compress',
 'https://images.prismic.io/slots/api/aviator-thumb.jpg?auto=format,compress',
 'aviator-spribe', true, true, 30, true, NOW(), NOW()),

('game_spribe_mines', 'prov_spribe', 'mines-spribe', 'Mines', 'Crash', 'INR,USD,THB', 'en,th,hi', 'active',
 'https://images.prismic.io/slots/api/mines.jpg?auto=format,compress',
 'https://images.prismic.io/slots/api/mines-thumb.jpg?auto=format,compress',
 'mines-spribe', true, false, 31, true, NOW(), NOW())

ON CONFLICT (game_uid) DO UPDATE SET
  game_name = EXCLUDED.game_name,
  image_url = EXCLUDED.image_url,
  thumbnail_url = EXCLUDED.thumbnail_url,
  is_featured = EXCLUDED.is_featured,
  is_new = EXCLUDED.is_new,
  display_order = EXCLUDED.display_order,
  updated_at = NOW();

-- ============================================================================
-- GAME CATEGORIES
-- ============================================================================

INSERT INTO game_category (id, slug, name, description, icon_url, display_order, is_active, created_at, updated_at)
VALUES
('cat_slots', 'slots', 'Slots', 'Classic and video slot games', '/icons/slots.svg', 1, true, NOW(), NOW()),
('cat_live', 'live-casino', 'Live Casino', 'Live dealer games', '/icons/live.svg', 2, true, NOW(), NOW()),
('cat_crash', 'crash', 'Crash Games', 'Fast-paced crash games', '/icons/crash.svg', 3, true, NOW(), NOW()),
('cat_fishing', 'fishing', 'Fishing', 'Fish shooting games', '/icons/fishing.svg', 4, true, NOW(), NOW()),
('cat_sports', 'sports', 'Sports', 'Sports betting', '/icons/sports.svg', 5, true, NOW(), NOW()),
('cat_card', 'card-table', 'Card & Table', 'Blackjack, Roulette, Baccarat', '/icons/cards.svg', 6, true, NOW(), NOW())
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  icon_url = EXCLUDED.icon_url,
  updated_at = NOW();

-- ============================================================================
-- GAME CATEGORY RELATIONS
-- ============================================================================

-- Map games to categories
INSERT INTO game_category_relation (id, game_id, category_id, display_order, created_at)
VALUES
-- PG Soft games -> Slots, Fishing
('rel_pg_mahjong', 'game_pg_mahjong', 'cat_slots', 1, NOW()),
('rel_pg_wildbandito', 'game_pg_wildbandito', 'cat_slots', 2, NOW()),
('rel_pg_treasures', 'game_pg_treasures', 'cat_slots', 3, NOW()),
('rel_pg_winwin', 'game_pg_winwin', 'cat_fishing', 4, NOW()),

-- JILI games -> Slots
('rel_jl_hotpot', 'game_jl_hotpot', 'cat_slots', 10, NOW()),
('rel_jl_fortune', 'game_jl_fortune', 'cat_slots', 11, NOW()),

-- Evolution games -> Live Casino, Card & Table
('rel_evo_baccarat', 'game_evo_baccarat', 'cat_live', 20, NOW()),
('rel_evo_blackjack', 'game_evo_blackjack', 'cat_card', 21, NOW()),
('rel_evo_roulette', 'game_evo_roulette', 'cat_card', 22, NOW()),

-- Spribe games -> Crash
('rel_spribe_aviator', 'game_spribe_aviator', 'cat_crash', 30, NOW()),
('rel_spribe_mines', 'game_spribe_mines', 'cat_crash', 31, NOW())

ON CONFLICT (game_id, category_id) DO NOTHING;

-- ============================================================================
-- DONE!
-- ============================================================================
-- Verify the data:
-- SELECT * FROM game_provider ORDER BY display_order;
-- SELECT * FROM game ORDER BY display_order;
-- SELECT * FROM game_category ORDER BY display_order;
-- SELECT g.game_name, p.name as provider, gc.name as category
--   FROM game g
--   JOIN game_provider p ON g.provider_id = p.id
--   JOIN game_category_relation gcr ON g.id = gcr.game_id
--   JOIN game_category gc ON gcr.category_id = gc.id
--   ORDER BY g.display_order;
