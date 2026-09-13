-- Remote MCP OAuth storage.
-- These tables are intentionally server-only: the application backend uses the
-- service role after it has verified the signed-in CostCraft user.

CREATE TABLE IF NOT EXISTS public.mcp_oauth_clients (
  client_id text PRIMARY KEY,
  client_name text NOT NULL,
  redirect_uris text[] NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.mcp_oauth_codes (
  code_hash text PRIMARY KEY,
  client_id text NOT NULL REFERENCES public.mcp_oauth_clients(client_id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  redirect_uri text NOT NULL,
  code_challenge text NOT NULL,
  scope text NOT NULL DEFAULT 'mcp:read mcp:write',
  resource text,
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.mcp_oauth_tokens (
  token_hash text PRIMARY KEY,
  refresh_token_hash text UNIQUE,
  client_id text NOT NULL REFERENCES public.mcp_oauth_clients(client_id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  scope text NOT NULL DEFAULT 'mcp:read mcp:write',
  resource text,
  expires_at timestamptz NOT NULL,
  refresh_expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS mcp_oauth_codes_expiry_idx
  ON public.mcp_oauth_codes (expires_at);
CREATE INDEX IF NOT EXISTS mcp_oauth_tokens_expiry_idx
  ON public.mcp_oauth_tokens (expires_at)
  WHERE revoked_at IS NULL;

ALTER TABLE public.mcp_oauth_clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mcp_oauth_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mcp_oauth_tokens ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.mcp_oauth_clients, public.mcp_oauth_codes, public.mcp_oauth_tokens
  FROM public, anon, authenticated;
GRANT ALL ON public.mcp_oauth_clients, public.mcp_oauth_codes, public.mcp_oauth_tokens
  TO service_role;

-- The MCP backend calls these functions with the verified user id from its
-- OAuth token. They are not exposed to browser sessions.
CREATE OR REPLACE FUNCTION public.mcp_set_member_role(
  _actor_user_id uuid,
  _user_id uuid,
  _role public.app_role
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  cid uuid;
  existing_admins int;
BEGIN
  SELECT company_id INTO cid FROM public.profiles WHERE id = _actor_user_id;
  IF cid IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _actor_user_id AND company_id = cid AND role::text = 'admin'
  ) THEN
    RAISE EXCEPTION 'Only administrators can change roles.';
  END IF;
  IF (SELECT company_id FROM public.profiles WHERE id = _user_id) IS DISTINCT FROM cid THEN
    RAISE EXCEPTION 'That person is not part of this workspace.';
  END IF;
  IF _role::text <> 'admin'
     AND EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND company_id = cid AND role::text = 'admin') THEN
    SELECT COUNT(*) INTO existing_admins FROM public.user_roles WHERE company_id = cid AND role::text = 'admin';
    IF existing_admins <= 1 THEN RAISE EXCEPTION 'This workspace must keep at least one administrator.'; END IF;
  END IF;
  DELETE FROM public.user_roles WHERE user_id = _user_id AND company_id = cid AND role <> _role;
  INSERT INTO public.user_roles (user_id, company_id, role)
    VALUES (_user_id, cid, _role)
    ON CONFLICT (user_id, company_id, role) DO NOTHING;
  INSERT INTO public.audit_log (company_id, user_id, action, entity, entity_id, details)
    VALUES (cid, _actor_user_id, 'changed_role', 'member', _user_id, jsonb_build_object('role', _role));
END;
$$;

CREATE OR REPLACE FUNCTION public.mcp_remove_member(
  _actor_user_id uuid,
  _user_id uuid
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  cid uuid;
  admin_count int;
BEGIN
  SELECT company_id INTO cid FROM public.profiles WHERE id = _actor_user_id;
  IF cid IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _actor_user_id AND company_id = cid AND role::text = 'admin'
  ) THEN
    RAISE EXCEPTION 'Only administrators can remove members.';
  END IF;
  IF _user_id = _actor_user_id THEN RAISE EXCEPTION 'You cannot remove yourself.'; END IF;
  IF (SELECT company_id FROM public.profiles WHERE id = _user_id) IS DISTINCT FROM cid THEN
    RAISE EXCEPTION 'That person is not part of this workspace.';
  END IF;
  IF EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND company_id = cid AND role::text = 'admin') THEN
    SELECT COUNT(*) INTO admin_count FROM public.user_roles WHERE company_id = cid AND role::text = 'admin';
    IF admin_count <= 1 THEN RAISE EXCEPTION 'This workspace must keep at least one administrator.'; END IF;
  END IF;
  DELETE FROM public.user_roles WHERE user_id = _user_id AND company_id = cid;
  UPDATE public.profiles SET company_id = NULL WHERE id = _user_id;
  INSERT INTO public.audit_log (company_id, user_id, action, entity, entity_id, details)
    VALUES (cid, _actor_user_id, 'removed', 'member', _user_id, '{}'::jsonb);
END;
$$;

CREATE OR REPLACE FUNCTION public.mcp_create_invitation(
  _actor_user_id uuid,
  _email text,
  _role public.app_role
)
RETURNS TABLE (id uuid, token uuid, expires_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  cid uuid;
  invitation public.invitations;
  normalized_email text := lower(trim(_email));
BEGIN
  SELECT company_id INTO cid FROM public.profiles WHERE id = _actor_user_id;
  IF cid IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _actor_user_id AND company_id = cid AND role::text = 'admin'
  ) THEN
    RAISE EXCEPTION 'Only administrators can invite collaborators.';
  END IF;
  IF normalized_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' THEN
    RAISE EXCEPTION 'Enter a valid work email address.';
  END IF;
  INSERT INTO public.invitations (company_id, email, role, invited_by)
    VALUES (cid, normalized_email, _role, _actor_user_id)
    RETURNING * INTO invitation;
  INSERT INTO public.audit_log (company_id, user_id, action, entity, entity_id, details)
    VALUES (cid, _actor_user_id, 'invited', 'invitation', invitation.id,
      jsonb_build_object('email', normalized_email, 'role', _role));
  RETURN QUERY SELECT invitation.id, invitation.token, invitation.expires_at;
END;
$$;

REVOKE ALL ON FUNCTION public.mcp_set_member_role(uuid, uuid, public.app_role) FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.mcp_remove_member(uuid, uuid) FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.mcp_create_invitation(uuid, text, public.app_role) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mcp_set_member_role(uuid, uuid, public.app_role) TO service_role;
GRANT EXECUTE ON FUNCTION public.mcp_remove_member(uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.mcp_create_invitation(uuid, text, public.app_role) TO service_role;
