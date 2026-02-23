-- Create USSD Sessions Table
CREATE TABLE IF NOT EXISTS public.ussd_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_number VARCHAR(20) NOT NULL,
  session_id VARCHAR(255) UNIQUE NOT NULL,
  current_menu VARCHAR(50) NOT NULL DEFAULT 'main',
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  user_role VARCHAR(50),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create USSD Messages Table
CREATE TABLE IF NOT EXISTS public.ussd_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id VARCHAR(255) NOT NULL REFERENCES public.ussd_sessions(session_id) ON DELETE CASCADE,
  direction VARCHAR(20) NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  content TEXT NOT NULL,
  menu_level VARCHAR(50) NOT NULL,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  status VARCHAR(50) DEFAULT 'delivered' CHECK (status IN ('pending', 'sent', 'delivered', 'failed')),
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create USSD Submissions Table (for form submissions via USSD)
CREATE TABLE IF NOT EXISTS public.ussd_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id VARCHAR(255) NOT NULL REFERENCES public.ussd_sessions(session_id) ON DELETE CASCADE,
  menu_level VARCHAR(50) NOT NULL,
  menu_code VARCHAR(10) NOT NULL,
  user_input TEXT,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  processed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  processed_at TIMESTAMP WITH TIME ZONE,
  response_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX idx_ussd_sessions_phone_number ON public.ussd_sessions(phone_number);
CREATE INDEX idx_ussd_sessions_is_active ON public.ussd_sessions(is_active);
CREATE INDEX idx_ussd_sessions_expires_at ON public.ussd_sessions(expires_at);
CREATE INDEX idx_ussd_sessions_session_id ON public.ussd_sessions(session_id);
CREATE INDEX idx_ussd_messages_session_id ON public.ussd_messages(session_id);
CREATE INDEX idx_ussd_messages_timestamp ON public.ussd_messages(timestamp);
CREATE INDEX idx_ussd_submissions_session_id ON public.ussd_submissions(session_id);
CREATE INDEX idx_ussd_submissions_status ON public.ussd_submissions(status);
CREATE INDEX idx_ussd_submissions_timestamp ON public.ussd_submissions(timestamp);

-- Enable RLS
ALTER TABLE public.ussd_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ussd_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ussd_submissions ENABLE ROW LEVEL SECURITY;

-- USSD Sessions RLS Policies
-- Service role (Edge Functions) can insert/update/select
CREATE POLICY "Service role can manage USSD sessions"
  ON public.ussd_sessions
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Users can only see their own sessions if they have a user_id
CREATE POLICY "Users can view their own USSD sessions"
  ON public.ussd_sessions
  FOR SELECT
  USING (auth.uid() = user_id OR user_id IS NULL);

-- USSD Messages RLS Policies
CREATE POLICY "Service role can manage USSD messages"
  ON public.ussd_messages
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- USSD Submissions RLS Policies
CREATE POLICY "Service role can manage USSD submissions"
  ON public.ussd_submissions
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Staff can view submissions for processing
CREATE POLICY "Staff can view USSD submissions"
  ON public.ussd_submissions
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid()
      AND role IN ('counselor', 'ngo', 'police', 'analyst', 'admin')
    )
  );

-- Create function to clean up expired sessions
CREATE OR REPLACE FUNCTION public.cleanup_expired_ussd_sessions()
RETURNS INT AS $$
DECLARE
  deleted_count INT;
BEGIN
  DELETE FROM public.ussd_sessions
  WHERE expires_at < NOW() AND is_active = TRUE;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT SELECT, INSERT, UPDATE ON public.ussd_sessions TO authenticated;
GRANT SELECT ON public.ussd_messages TO authenticated;
GRANT SELECT, INSERT ON public.ussd_submissions TO authenticated;
