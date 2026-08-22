PRAGMA foreign_keys = ON;

-- 0005 originally populated the searchable topic correctly but left the
-- dedicated situation column as the string "undefined". Repair only those
-- A2 rows; existing A1 rows and IDs/history remain untouched.
UPDATE pl_learning_items
SET scene = topic
WHERE content_version = 'a1-a2-2026.1'
  AND cefr_level = 'A2'
  AND (scene IS NULL OR scene = '' OR scene = 'undefined');
