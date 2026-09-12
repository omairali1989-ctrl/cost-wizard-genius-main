
REVOKE ALL ON FUNCTION public.current_company_id() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.can_edit() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.create_company(text, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.current_company_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_edit() TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_company(text, text, text) TO authenticated;
