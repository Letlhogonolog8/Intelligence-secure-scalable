-- Create alerts_feed table for real-time notifications
CREATE TABLE IF NOT EXISTS public.alerts_feed (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  time TEXT NOT NULL,
  type TEXT NOT NULL, -- 'incident', 'anomaly', 'system', 'dispatch'
  message TEXT NOT NULL,
  module TEXT NOT NULL,
  severity TEXT DEFAULT 'medium',
  status TEXT DEFAULT 'pending', -- 'pending', 'acknowledged', 'resolved'
  acknowledged_at TIMESTAMP WITH TIME ZONE,
  acknowledged_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Enable RLS
ALTER TABLE public.alerts_feed ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "authenticated_view_alerts"
  ON public.alerts_feed FOR SELECT
  TO authenticated
  USING (TRUE);

CREATE POLICY "police_manage_alerts"
  ON public.alerts_feed FOR ALL
  TO authenticated
  USING (COALESCE(auth.jwt() -> 'user_metadata' ->> 'role', '') IN ('police', 'admin'))
  WITH CHECK (COALESCE(auth.jwt() -> 'user_metadata' ->> 'role', '') IN ('police', 'admin'));

-- Trigger to automatically create alert on new critical incident
CREATE OR REPLACE FUNCTION create_incident_alert()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.severity = 'critical' THEN
    INSERT INTO public.alerts_feed (time, type, message, module, severity)
    VALUES (
      TO_CHAR(NEW.incident_date, 'HH24:MI'),
      'incident',
      'Critical ' || NEW.incident_type || ' incident reported',
      'command_center',
      'critical'
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_critical_incident_alert ON public.incidents;
CREATE TRIGGER on_critical_incident_alert
  AFTER INSERT ON public.incidents
  FOR EACH ROW EXECUTE FUNCTION create_incident_alert();

-- Indexing
CREATE INDEX idx_alerts_feed_status ON public.alerts_feed(status);
CREATE INDEX idx_alerts_feed_created_at ON public.alerts_feed(created_at DESC);
