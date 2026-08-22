-- Forward correction: align legacy Unit 1 cloze and unscramble scaffolds with
-- the item already referenced by each preserved lesson step.
UPDATE pl_lesson_steps SET cloze_prefix = 'Mam na', cloze_suffix = 'Anna.', cloze_answer = 'imię' WHERE id = 'a1-u1-l1-s3';
UPDATE pl_lesson_steps SET tokens_json = '["Jestem","z","Japonii."]' WHERE id = 'a1-u1-l1-s4';
UPDATE pl_lesson_steps SET cloze_prefix = 'Jestem', cloze_suffix = 'Polski.', cloze_answer = 'z' WHERE id = 'a1-u1-l2-s3';
UPDATE pl_lesson_steps SET tokens_json = '["A","ty?"]' WHERE id = 'a1-u1-l2-s4';
UPDATE pl_lesson_steps SET cloze_prefix = 'Proszę', cloze_suffix = 'wolniej.', cloze_answer = 'mówić' WHERE id = 'a1-u1-l3-s3';
UPDATE pl_lesson_steps SET tokens_json = '["Co","to","znaczy?"]' WHERE id = 'a1-u1-l3-s4';
UPDATE pl_lesson_steps SET cloze_prefix = '', cloze_suffix = '', cloze_answer = 'Rozumiem.' WHERE id = 'a1-u1-l4-s3';
UPDATE pl_lesson_steps SET tokens_json = '["Mam","na","imię","Anna."]' WHERE id = 'a1-u1-l4-s4';
UPDATE pl_lesson_steps SET cloze_prefix = 'Mówię trochę', cloze_suffix = 'polsku.', cloze_answer = 'po' WHERE id = 'a1-u1-l5-s3';
UPDATE pl_lesson_steps SET tokens_json = '["Mieszkam","w","Polsce."]' WHERE id = 'a1-u1-l5-s4';
UPDATE pl_lesson_steps SET cloze_prefix = '', cloze_suffix = '', cloze_answer = 'Przepraszam.' WHERE id = 'a1-u1-l6-s3';
UPDATE pl_lesson_steps SET tokens_json = '["Nie","rozumiem."]' WHERE id = 'a1-u1-l6-s4';
