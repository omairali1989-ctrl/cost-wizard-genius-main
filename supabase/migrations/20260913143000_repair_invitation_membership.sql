-- Repair invitation acceptance and member management conflict targets.
-- user_roles is unique by (user_id, company_id, role), not (user_id, role).

CREATE OR REPLACE FUNCTION public.accept_invitation(_token uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE inv public.invitations; uid uuid; uemail text;
BEGIN
  uid := auth.uid();
  IF uid IS NULL THEN RAISE EXCEPTION 'Please sign in first.'; END IF;
  SELECT * INTO inv FROM public.invitations WHERE token = _token FOR UPDATE;
  IF inv.id IS NULL THEN RAISE EXCEPTION 'This invitation link is not valid.'; END IF;
  IF inv.status <> 'pending' THEN RAISE EXCEPTION 'This invitation has already been used.'; END IF;
  IF inv.expires_at < now() THEN
    UPDATE public.invitations SET status = 'expired', responded_at = now() WHERE id = inv.id;
    RAISE EXCEPTION 'This invitation has expired.';
  END IF;
  SELECT email INTO uemail FROM auth.users WHERE id = uid;
  IF lower(COALESCE(uemail, '')) <> lower(inv.email) THEN
    RAISE EXCEPTION 'This invitation was sent to %. Sign in with that email address.', inv.email;
  END IF;
  IF (SELECT company_id FROM public.profiles WHERE id = uid) IS NOT NULL THEN
    RAISE EXCEPTION 'You already belong to a workspace.';
  END IF;

  INSERT INTO public.profiles (id, email, company_id) VALUES (uid, uemail, inv.company_id)
    ON CONFLICT (id) DO UPDATE SET company_id = inv.company_id, email = EXCLUDED.email;
  INSERT INTO public.user_roles (user_id, company_id, role)
    VALUES (uid, inv.company_id, inv.role)
    ON CONFLICT (user_id, company_id, role) DO NOTHING;
  UPDATE public.invitations SET status = 'accepted', responded_at = now() WHERE id = inv.id;
  INSERT INTO public.audit_log (company_id, user_id, action, entity, entity_id, details)
    VALUES (inv.company_id, uid, 'accepted', 'invitation', inv.id,
      jsonb_build_object('email', inv.email, 'role', inv.role));
  RETURN inv.company_id;
END; $$;

REVOKE ALL ON FUNCTION public.accept_invitation(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.accept_invitation(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.set_member_role(_user_id uuid, _role public.app_role)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE cid uuid; existing_admins int;
BEGIN
  cid := public.current_company_id();
  IF cid IS NULL OR NOT public.is_company_admin() THEN RAISE EXCEPTION 'Only administrators can change roles.'; END IF;
  IF (SELECT company_id FROM public.profiles WHERE id = _user_id) IS DISTINCT FROM cid THEN
    RAISE EXCEPTION 'That person is not part of this workspace.';
  END IF;
  IF _role::text <> 'admin'
     AND EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND company_id = cid AND role::text = 'admin') THEN
    SELECT COUNT(*) INTO existing_admins FROM public.user_roles WHERE company_id = cid AND role::text = 'admin';
    IF existing_admins <= 1 THEN RAISE EXCEPTION 'This workspace must keep at least one administrator.'; END IF;
  END IF;
  DELETE FROM public.user_roles WHERE user_id = _user_id AND company_id = cid AND role <> _role;
  INSERT INTO public.user_roles (user_id, company_id, role) VALUES (_user_id, cid, _role)
    ON CONFLICT (user_id, company_id, role) DO NOTHING;
  INSERT INTO public.audit_log (company_id, user_id, action, entity, entity_id, details)
    VALUES (cid, auth.uid(), 'changed_role', 'member', _user_id, jsonb_build_object('role', _role));
END; $$;

REVOKE ALL ON FUNCTION public.set_member_role(uuid, public.app_role) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.set_member_role(uuid, public.app_role) TO authenticated;
