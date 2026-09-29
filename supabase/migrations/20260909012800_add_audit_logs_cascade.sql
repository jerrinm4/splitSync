-- Drop existing constraint
ALTER TABLE audit_logs DROP CONSTRAINT IF EXISTS audit_logs_trip_id_fkey;

-- Re-add with ON DELETE CASCADE
ALTER TABLE audit_logs 
  ADD CONSTRAINT audit_logs_trip_id_fkey 
  FOREIGN KEY (trip_id) REFERENCES trips(id) ON DELETE CASCADE;
