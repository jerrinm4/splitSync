CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_trips_updated_at BEFORE UPDATE ON trips
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_trip_members_updated_at BEFORE UPDATE ON trip_members
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_expenses_updated_at BEFORE UPDATE ON expenses
FOR EACH ROW EXECUTE FUNCTION update_updated_at();
