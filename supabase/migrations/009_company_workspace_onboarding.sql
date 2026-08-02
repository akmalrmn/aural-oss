-- Provision company-scoped employer workspaces while allowing invited staff
-- to join an existing organization without creating a personal organization.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  company_name text;
  workspace_name text;
  slug_base text;
  org_id uuid;
  proj_id uuid;
  skip_default_organization boolean;
BEGIN
  INSERT INTO public.profiles (id, email, name, avatar, organization)
  VALUES (
    NEW.id,
    NEW.email,
    coalesce(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name'),
    NEW.raw_user_meta_data->>'avatar_url',
    nullif(btrim(NEW.raw_user_meta_data->>'company_name'), '')
  )
  ON CONFLICT (id) DO UPDATE SET
    email = excluded.email,
    name = coalesce(excluded.name, profiles.name),
    avatar = coalesce(excluded.avatar, profiles.avatar),
    organization = coalesce(excluded.organization, profiles.organization);

  skip_default_organization :=
    lower(coalesce(NEW.raw_user_meta_data->>'skip_default_organization', 'false'))
      = 'true';

  IF skip_default_organization THEN
    RETURN NEW;
  END IF;

  company_name := coalesce(
    nullif(btrim(NEW.raw_user_meta_data->>'company_name'), ''),
    'Personal'
  );
  workspace_name := coalesce(
    nullif(btrim(NEW.raw_user_meta_data->>'initial_workspace_name'), ''),
    'Hiring'
  );
  slug_base := trim(
    both '-' from regexp_replace(lower(company_name), '[^a-z0-9]+', '-', 'g')
  );

  IF slug_base = '' THEN
    slug_base := 'workspace';
  END IF;

  org_id := gen_random_uuid();
  proj_id := gen_random_uuid();

  INSERT INTO public.organizations (id, name, slug, "ownerId")
  VALUES (
    org_id,
    company_name,
    left(slug_base, 40) || '-' || left(NEW.id::text, 8),
    NEW.id
  );

  INSERT INTO public.organization_members ("workspaceId", "userId", role)
  VALUES (org_id, NEW.id, 'OWNER');

  INSERT INTO public.projects (id, "organizationId", name, "createdBy")
  VALUES (proj_id, org_id, workspace_name, NEW.id);

  RETURN NEW;
END;
$$;
