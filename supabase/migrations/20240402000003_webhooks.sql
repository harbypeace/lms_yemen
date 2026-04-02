-- 14. Webhook to trigger Edge Function on Invitation
-- This uses the 'pg_net' extension which is standard in Supabase for async HTTP calls.

CREATE EXTENSION IF NOT EXISTS pg_net;

CREATE OR REPLACE FUNCTION public.on_invitation_created()
RETURNS TRIGGER AS $$
BEGIN
  -- Call the Edge Function asynchronously
  PERFORM net.http_post(
    url := 'https://okpruwomwojoshrbdewg.supabase.co/functions/v1/send-invitation',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.supabase_anon_key', true)
    ),
    body := jsonb_build_object('record', row_to_json(NEW))
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS tr_on_invitation_created ON public.invitations;
CREATE TRIGGER tr_on_invitation_created
  AFTER INSERT ON public.invitations
  FOR EACH ROW EXECUTE FUNCTION public.on_invitation_created();
