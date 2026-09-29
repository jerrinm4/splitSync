CREATE TABLE trip_member_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK (char_length(name) > 0),
  member_ids UUID[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_trip_member_groups_trip ON trip_member_groups(trip_id);

ALTER TABLE trip_member_groups ENABLE ROW LEVEL SECURITY;

-- Select policy: Owners/Admins and Shared Link visitors
CREATE POLICY member_groups_select ON trip_member_groups
  FOR SELECT USING (
    is_trip_admin(trip_id)
    OR
    EXISTS (
      SELECT 1 FROM trips
      WHERE trips.id = trip_member_groups.trip_id
      AND trips.share_enabled = TRUE
      AND trips.share_token = COALESCE(current_setting('request.headers', true)::json->>'x-share-token', '')
    )
  );

-- Insert policy: Owners/Admins
CREATE POLICY member_groups_insert ON trip_member_groups
  FOR INSERT WITH CHECK (
    is_trip_admin(trip_id)
  );

-- Update policy: Owners/Admins
CREATE POLICY member_groups_update ON trip_member_groups
  FOR UPDATE USING (
    is_trip_admin(trip_id)
  );

-- Delete policy: Owners/Admins
CREATE POLICY member_groups_delete ON trip_member_groups
  FOR DELETE USING (
    is_trip_admin(trip_id)
  );

-- Trigger to update 'updated_at' column
CREATE TRIGGER update_trip_member_groups_updated_at
  BEFORE UPDATE ON trip_member_groups
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();
