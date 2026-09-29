-- RPC to fetch audit logs with actor email for a given trip
CREATE OR REPLACE FUNCTION get_trip_audit_logs(p_trip_id UUID)
RETURNS TABLE (
  id UUID,
  trip_id UUID,
  actor_user_id UUID,
  actor_email TEXT,
  entity_type TEXT,
  entity_id UUID,
  action TEXT,
  after_data JSONB,
  before_data JSONB,
  created_at TIMESTAMPTZ
) AS $$
BEGIN
  -- Check access
  IF NOT is_trip_admin(p_trip_id) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  RETURN QUERY
  SELECT
    al.id,
    al.trip_id,
    al.actor_user_id,
    COALESCE(au.email::TEXT, 'Unknown'),
    al.entity_type,
    al.entity_id,
    al.action,
    al.after_data,
    al.before_data,
    al.created_at
  FROM audit_logs al
  LEFT JOIN auth.users au ON au.id = al.actor_user_id
  WHERE al.trip_id = p_trip_id
  ORDER BY al.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
