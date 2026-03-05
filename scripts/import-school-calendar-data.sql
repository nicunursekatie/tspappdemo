-- School Calendar Import Script
-- Generated: 2025-12-31T04:01:19.127Z

INSERT INTO tracked_calendar_items (external_id, category, title, start_date, end_date, notes, metadata, created_at, updated_at)
VALUES ('school_break_schoolbreak-2025-2026-winter-2026-02-16-aps-cobb-dekalb', 'school_breaks', 'Winter Break', '2026-02-16', '2026-02-20', 'Most districts off this week; expect availability/travel effects.', '{"type":"school_break","districts":["APS","Cobb","DeKalb"],"academicYear":"2025-2026","originalId":"schoolbreak-2025-2026-winter-2026-02-16-aps-cobb-dekalb"}', NOW(), NOW())
ON CONFLICT (external_id) DO UPDATE SET
  category = EXCLUDED.category,
  title = EXCLUDED.title,
  start_date = EXCLUDED.start_date,
  end_date = EXCLUDED.end_date,
  notes = EXCLUDED.notes,
  metadata = EXCLUDED.metadata,
  updated_at = NOW();

INSERT INTO tracked_calendar_items (external_id, category, title, start_date, end_date, notes, metadata, created_at, updated_at)
VALUES ('school_break_schoolbreak-2025-2026-winter-2026-02-12-gwinnett', 'school_breaks', 'Winter Break', '2026-02-12', '2026-02-16', 'Gwinnett holiday break window differs from other districts.', '{"type":"school_break","districts":["Gwinnett"],"academicYear":"2025-2026","originalId":"schoolbreak-2025-2026-winter-2026-02-12-gwinnett"}', NOW(), NOW())
ON CONFLICT (external_id) DO UPDATE SET
  category = EXCLUDED.category,
  title = EXCLUDED.title,
  start_date = EXCLUDED.start_date,
  end_date = EXCLUDED.end_date,
  notes = EXCLUDED.notes,
  metadata = EXCLUDED.metadata,
  updated_at = NOW();

INSERT INTO tracked_calendar_items (external_id, category, title, start_date, end_date, notes, metadata, created_at, updated_at)
VALUES ('school_break_schoolbreak-2025-2026-winter-2026-02-16-fulton', 'school_breaks', 'Winter Break', '2026-02-16', '2026-02-17', 'Shorter Fulton break compared to others.', '{"type":"school_break","districts":["Fulton"],"academicYear":"2025-2026","originalId":"schoolbreak-2025-2026-winter-2026-02-16-fulton"}', NOW(), NOW())
ON CONFLICT (external_id) DO UPDATE SET
  category = EXCLUDED.category,
  title = EXCLUDED.title,
  start_date = EXCLUDED.start_date,
  end_date = EXCLUDED.end_date,
  notes = EXCLUDED.notes,
  metadata = EXCLUDED.metadata,
  updated_at = NOW();

INSERT INTO tracked_calendar_items (external_id, category, title, start_date, end_date, notes, metadata, created_at, updated_at)
VALUES ('school_break_schoolbreak-2025-2026-spring-2026-04-06-all-major-districts', 'school_breaks', 'Spring Break', '2026-04-06', '2026-04-10', 'All major districts aligned.', '{"type":"school_break","districts":["APS","Fulton","Cobb","Gwinnett","DeKalb"],"academicYear":"2025-2026","originalId":"schoolbreak-2025-2026-spring-2026-04-06-all-major-districts"}', NOW(), NOW())
ON CONFLICT (external_id) DO UPDATE SET
  category = EXCLUDED.category,
  title = EXCLUDED.title,
  start_date = EXCLUDED.start_date,
  end_date = EXCLUDED.end_date,
  notes = EXCLUDED.notes,
  metadata = EXCLUDED.metadata,
  updated_at = NOW();

INSERT INTO tracked_calendar_items (external_id, category, title, start_date, end_date, notes, metadata, created_at, updated_at)
VALUES ('school_break_schoolmarker-2025-2026-lastday-2026-05-20-cobb-gwinnett', 'school_markers', 'Last Day of School', '2026-05-20', '2026-05-20', '', '{"type":"school_marker","districts":["Cobb","Gwinnett"],"academicYear":"2025-2026","originalId":"schoolmarker-2025-2026-lastday-2026-05-20-cobb-gwinnett"}', NOW(), NOW())
ON CONFLICT (external_id) DO UPDATE SET
  category = EXCLUDED.category,
  title = EXCLUDED.title,
  start_date = EXCLUDED.start_date,
  end_date = EXCLUDED.end_date,
  notes = EXCLUDED.notes,
  metadata = EXCLUDED.metadata,
  updated_at = NOW();

INSERT INTO tracked_calendar_items (external_id, category, title, start_date, end_date, notes, metadata, created_at, updated_at)
VALUES ('school_break_schoolmarker-2025-2026-lastday-2026-05-21-fulton', 'school_markers', 'Last Day of School', '2026-05-21', '2026-05-21', '', '{"type":"school_marker","districts":["Fulton"],"academicYear":"2025-2026","originalId":"schoolmarker-2025-2026-lastday-2026-05-21-fulton"}', NOW(), NOW())
ON CONFLICT (external_id) DO UPDATE SET
  category = EXCLUDED.category,
  title = EXCLUDED.title,
  start_date = EXCLUDED.start_date,
  end_date = EXCLUDED.end_date,
  notes = EXCLUDED.notes,
  metadata = EXCLUDED.metadata,
  updated_at = NOW();

INSERT INTO tracked_calendar_items (external_id, category, title, start_date, end_date, notes, metadata, created_at, updated_at)
VALUES ('school_break_schoolmarker-2025-2026-lastday-2026-05-22-aps', 'school_markers', 'Last Day of School', '2026-05-22', '2026-05-22', '', '{"type":"school_marker","districts":["APS"],"academicYear":"2025-2026","originalId":"schoolmarker-2025-2026-lastday-2026-05-22-aps"}', NOW(), NOW())
ON CONFLICT (external_id) DO UPDATE SET
  category = EXCLUDED.category,
  title = EXCLUDED.title,
  start_date = EXCLUDED.start_date,
  end_date = EXCLUDED.end_date,
  notes = EXCLUDED.notes,
  metadata = EXCLUDED.metadata,
  updated_at = NOW();

INSERT INTO tracked_calendar_items (external_id, category, title, start_date, end_date, notes, metadata, created_at, updated_at)
VALUES ('school_break_schoolmarker-2025-2026-lastday-2026-05-28-dekalb', 'school_markers', 'Last Day of School', '2026-05-28', '2026-05-28', '', '{"type":"school_marker","districts":["DeKalb"],"academicYear":"2025-2026","originalId":"schoolmarker-2025-2026-lastday-2026-05-28-dekalb"}', NOW(), NOW())
ON CONFLICT (external_id) DO UPDATE SET
  category = EXCLUDED.category,
  title = EXCLUDED.title,
  start_date = EXCLUDED.start_date,
  end_date = EXCLUDED.end_date,
  notes = EXCLUDED.notes,
  metadata = EXCLUDED.metadata,
  updated_at = NOW();

INSERT INTO tracked_calendar_items (external_id, category, title, start_date, end_date, notes, metadata, created_at, updated_at)
VALUES ('school_break_schoolmarker-2026-2027-firstday-2026-08-03-aps-cobb-dekalb-fulton', 'school_markers', 'School Starts', '2026-08-03', '2026-08-03', '', '{"type":"school_marker","districts":["APS","Fulton","Cobb","DeKalb"],"academicYear":"2026-2027","originalId":"schoolmarker-2026-2027-firstday-2026-08-03-aps-cobb-dekalb-fulton"}', NOW(), NOW())
ON CONFLICT (external_id) DO UPDATE SET
  category = EXCLUDED.category,
  title = EXCLUDED.title,
  start_date = EXCLUDED.start_date,
  end_date = EXCLUDED.end_date,
  notes = EXCLUDED.notes,
  metadata = EXCLUDED.metadata,
  updated_at = NOW();

INSERT INTO tracked_calendar_items (external_id, category, title, start_date, end_date, notes, metadata, created_at, updated_at)
VALUES ('school_break_schoolmarker-2026-2027-firstday-2026-08-05-gwinnett', 'school_markers', 'School Starts', '2026-08-05', '2026-08-05', '', '{"type":"school_marker","districts":["Gwinnett"],"academicYear":"2026-2027","originalId":"schoolmarker-2026-2027-firstday-2026-08-05-gwinnett"}', NOW(), NOW())
ON CONFLICT (external_id) DO UPDATE SET
  category = EXCLUDED.category,
  title = EXCLUDED.title,
  start_date = EXCLUDED.start_date,
  end_date = EXCLUDED.end_date,
  notes = EXCLUDED.notes,
  metadata = EXCLUDED.metadata,
  updated_at = NOW();

INSERT INTO tracked_calendar_items (external_id, category, title, start_date, end_date, notes, metadata, created_at, updated_at)
VALUES ('school_break_schoolbreak-2026-2027-fall-2026-09-21-fulton-cobb', 'school_breaks', 'Fall Break', '2026-09-21', '2026-09-25', 'Fulton/Cobb fall break window.', '{"type":"school_break","districts":["Fulton","Cobb"],"academicYear":"2026-2027","originalId":"schoolbreak-2026-2027-fall-2026-09-21-fulton-cobb"}', NOW(), NOW())
ON CONFLICT (external_id) DO UPDATE SET
  category = EXCLUDED.category,
  title = EXCLUDED.title,
  start_date = EXCLUDED.start_date,
  end_date = EXCLUDED.end_date,
  notes = EXCLUDED.notes,
  metadata = EXCLUDED.metadata,
  updated_at = NOW();

INSERT INTO tracked_calendar_items (external_id, category, title, start_date, end_date, notes, metadata, created_at, updated_at)
VALUES ('school_break_schoolbreak-2026-2027-fall-2026-10-05-dekalb', 'school_breaks', 'Fall Break', '2026-10-05', '2026-10-09', 'DeKalb fall break window.', '{"type":"school_break","districts":["DeKalb"],"academicYear":"2026-2027","originalId":"schoolbreak-2026-2027-fall-2026-10-05-dekalb"}', NOW(), NOW())
ON CONFLICT (external_id) DO UPDATE SET
  category = EXCLUDED.category,
  title = EXCLUDED.title,
  start_date = EXCLUDED.start_date,
  end_date = EXCLUDED.end_date,
  notes = EXCLUDED.notes,
  metadata = EXCLUDED.metadata,
  updated_at = NOW();

INSERT INTO tracked_calendar_items (external_id, category, title, start_date, end_date, notes, metadata, created_at, updated_at)
VALUES ('school_break_schoolbreak-2026-2027-fall-2026-10-12-aps-gwinnett', 'school_breaks', 'Fall Break', '2026-10-12', '2026-10-16', 'APS/Gwinnett fall break window.', '{"type":"school_break","districts":["APS","Gwinnett"],"academicYear":"2026-2027","originalId":"schoolbreak-2026-2027-fall-2026-10-12-aps-gwinnett"}', NOW(), NOW())
ON CONFLICT (external_id) DO UPDATE SET
  category = EXCLUDED.category,
  title = EXCLUDED.title,
  start_date = EXCLUDED.start_date,
  end_date = EXCLUDED.end_date,
  notes = EXCLUDED.notes,
  metadata = EXCLUDED.metadata,
  updated_at = NOW();

INSERT INTO tracked_calendar_items (external_id, category, title, start_date, end_date, notes, metadata, created_at, updated_at)
VALUES ('school_break_schoolbreak-2026-2027-winter-2027-02-15-aps-cobb-dekalb-fulton', 'school_breaks', 'Winter Break', '2027-02-15', '2027-02-19', 'Most districts aligned.', '{"type":"school_break","districts":["APS","Fulton","Cobb","DeKalb"],"academicYear":"2026-2027","originalId":"schoolbreak-2026-2027-winter-2027-02-15-aps-cobb-dekalb-fulton"}', NOW(), NOW())
ON CONFLICT (external_id) DO UPDATE SET
  category = EXCLUDED.category,
  title = EXCLUDED.title,
  start_date = EXCLUDED.start_date,
  end_date = EXCLUDED.end_date,
  notes = EXCLUDED.notes,
  metadata = EXCLUDED.metadata,
  updated_at = NOW();

INSERT INTO tracked_calendar_items (external_id, category, title, start_date, end_date, notes, metadata, created_at, updated_at)
VALUES ('school_break_schoolbreak-2026-2027-winter-2027-02-12-gwinnett', 'school_breaks', 'Winter Break', '2027-02-12', '2027-02-16', 'Gwinnett holiday break window differs from other districts.', '{"type":"school_break","districts":["Gwinnett"],"academicYear":"2026-2027","originalId":"schoolbreak-2026-2027-winter-2027-02-12-gwinnett"}', NOW(), NOW())
ON CONFLICT (external_id) DO UPDATE SET
  category = EXCLUDED.category,
  title = EXCLUDED.title,
  start_date = EXCLUDED.start_date,
  end_date = EXCLUDED.end_date,
  notes = EXCLUDED.notes,
  metadata = EXCLUDED.metadata,
  updated_at = NOW();

INSERT INTO tracked_calendar_items (external_id, category, title, start_date, end_date, notes, metadata, created_at, updated_at)
VALUES ('school_break_schoolbreak-2026-2027-spring-2027-04-05-all-major-districts', 'school_breaks', 'Spring Break', '2027-04-05', '2027-04-09', 'All major districts aligned.', '{"type":"school_break","districts":["APS","Fulton","Cobb","Gwinnett","DeKalb"],"academicYear":"2026-2027","originalId":"schoolbreak-2026-2027-spring-2027-04-05-all-major-districts"}', NOW(), NOW())
ON CONFLICT (external_id) DO UPDATE SET
  category = EXCLUDED.category,
  title = EXCLUDED.title,
  start_date = EXCLUDED.start_date,
  end_date = EXCLUDED.end_date,
  notes = EXCLUDED.notes,
  metadata = EXCLUDED.metadata,
  updated_at = NOW();

INSERT INTO tracked_calendar_items (external_id, category, title, start_date, end_date, notes, metadata, created_at, updated_at)
VALUES ('school_break_schoolmarker-2026-2027-lastday-2027-05-19-cobb', 'school_markers', 'Last Day of School', '2027-05-19', '2027-05-19', '', '{"type":"school_marker","districts":["Cobb"],"academicYear":"2026-2027","originalId":"schoolmarker-2026-2027-lastday-2027-05-19-cobb"}', NOW(), NOW())
ON CONFLICT (external_id) DO UPDATE SET
  category = EXCLUDED.category,
  title = EXCLUDED.title,
  start_date = EXCLUDED.start_date,
  end_date = EXCLUDED.end_date,
  notes = EXCLUDED.notes,
  metadata = EXCLUDED.metadata,
  updated_at = NOW();

INSERT INTO tracked_calendar_items (external_id, category, title, start_date, end_date, notes, metadata, created_at, updated_at)
VALUES ('school_break_schoolmarker-2026-2027-lastday-2027-05-26-gwinnett', 'school_markers', 'Last Day of School', '2027-05-26', '2027-05-26', '', '{"type":"school_marker","districts":["Gwinnett"],"academicYear":"2026-2027","originalId":"schoolmarker-2026-2027-lastday-2027-05-26-gwinnett"}', NOW(), NOW())
ON CONFLICT (external_id) DO UPDATE SET
  category = EXCLUDED.category,
  title = EXCLUDED.title,
  start_date = EXCLUDED.start_date,
  end_date = EXCLUDED.end_date,
  notes = EXCLUDED.notes,
  metadata = EXCLUDED.metadata,
  updated_at = NOW();

INSERT INTO tracked_calendar_items (external_id, category, title, start_date, end_date, notes, metadata, created_at, updated_at)
VALUES ('school_break_schoolmarker-2026-2027-lastday-2027-05-27-aps-dekalb', 'school_markers', 'Last Day of School', '2027-05-27', '2027-05-27', '', '{"type":"school_marker","districts":["APS","DeKalb"],"academicYear":"2026-2027","originalId":"schoolmarker-2026-2027-lastday-2027-05-27-aps-dekalb"}', NOW(), NOW())
ON CONFLICT (external_id) DO UPDATE SET
  category = EXCLUDED.category,
  title = EXCLUDED.title,
  start_date = EXCLUDED.start_date,
  end_date = EXCLUDED.end_date,
  notes = EXCLUDED.notes,
  metadata = EXCLUDED.metadata,
  updated_at = NOW();
