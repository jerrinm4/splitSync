-- Fix the RLS policies for trips table to avoid visibility issues during INSERT RETURNING
DROP POLICY IF EXISTS trips_owner_select ON trips;
CREATE POLICY trips_owner_select ON trips
  FOR SELECT USING (
    owner_id = auth.uid() OR 
    EXISTS (SELECT 1 FROM trip_admins WHERE trip_id = id AND user_id = auth.uid())
  );

DROP POLICY IF EXISTS trips_owner_update ON trips;
CREATE POLICY trips_owner_update ON trips
  FOR UPDATE USING (
    owner_id = auth.uid() OR 
    EXISTS (SELECT 1 FROM trip_admins WHERE trip_id = id AND user_id = auth.uid())
  );
