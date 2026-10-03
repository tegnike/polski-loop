-- Clear the old lesson/phrase review queue and its rating history.
-- Current vocabulary learning and test records are stored separately and kept.
DELETE FROM pl_review_events
WHERE NOT EXISTS (SELECT 1 FROM pl_vocabulary_details d WHERE d.item_id = pl_review_events.item_id);

DELETE FROM pl_review_states
WHERE NOT EXISTS (SELECT 1 FROM pl_vocabulary_details d WHERE d.item_id = pl_review_states.item_id);
