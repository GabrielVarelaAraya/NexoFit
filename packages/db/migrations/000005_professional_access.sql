-- NexoFit: professional workspace and ownership-scoped access.
-- Apply after 000001 through 000004. Re-run this file after re-running 000003.
-- Existing specialties, biographies, appointments and availability are preserved.
BEGIN;

CREATE OR REPLACE FUNCTION public.ensure_professional_membership()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  IF NEW.role = 'professional' THEN
    INSERT INTO public.professionals (membership_id, specialization)
    SELECT NEW.id, 'Por definir'
    WHERE NOT EXISTS (
      SELECT 1 FROM public.professionals p WHERE p.membership_id = NEW.id
    );
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.ensure_professional_membership() FROM PUBLIC;

DROP TRIGGER IF EXISTS membership_professional_profile ON public.memberships;
CREATE TRIGGER membership_professional_profile
AFTER INSERT OR UPDATE OF role ON public.memberships
FOR EACH ROW EXECUTE FUNCTION public.ensure_professional_membership();

INSERT INTO public.professionals (membership_id, specialization)
SELECT m.id, 'Por definir'
FROM public.memberships m
WHERE m.role = 'professional'
AND NOT EXISTS (SELECT 1 FROM public.professionals p WHERE p.membership_id = m.id);

-- SECURITY DEFINER avoids a profiles/appointments/memberships RLS cycle.
CREATE OR REPLACE FUNCTION public.can_manage_professional(
  p_professional_id uuid, p_organization_id uuid DEFAULT NULL
)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.professionals p
    JOIN public.memberships m ON m.id = p.membership_id
    WHERE p.id = p_professional_id
      AND (p_organization_id IS NULL OR m.organization_id = p_organization_id)
      AND (
        (m.profile_id = auth.uid() AND m.role = 'professional')
        OR public.is_org_admin(m.organization_id)
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.is_assigned_professional(p_profile_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.appointments a
    JOIN public.professionals p ON p.id = a.professional_id
    JOIN public.memberships m ON m.id = p.membership_id
    WHERE a.profile_id = p_profile_id
      AND a.organization_id = m.organization_id
      AND m.profile_id = auth.uid() AND m.role = 'professional'
  );
$$;
REVOKE ALL ON FUNCTION public.can_manage_professional(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_assigned_professional(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_manage_professional(uuid, uuid)
  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_assigned_professional(uuid)
  TO authenticated, service_role;

DROP POLICY IF EXISTS professional_update_own ON public.professionals;
CREATE POLICY professional_update_own ON public.professionals
FOR UPDATE TO authenticated
USING (
  membership_id IN (
    SELECT id FROM public.memberships
    WHERE profile_id = auth.uid() AND role = 'professional'
  )
)
WITH CHECK (
  membership_id IN (
    SELECT id FROM public.memberships
    WHERE profile_id = auth.uid() AND role = 'professional'
  )
);

DROP POLICY IF EXISTS profile_select_assigned_professional ON public.profiles;
CREATE POLICY profile_select_assigned_professional ON public.profiles
FOR SELECT TO authenticated USING (public.is_assigned_professional(id));

DROP POLICY IF EXISTS availability_insert ON public.availability;
CREATE POLICY availability_insert ON public.availability
FOR INSERT TO authenticated WITH CHECK (public.can_manage_professional(professional_id));

DROP POLICY IF EXISTS availability_update ON public.availability;
CREATE POLICY availability_update ON public.availability
FOR UPDATE TO authenticated
USING (public.can_manage_professional(professional_id))
WITH CHECK (public.can_manage_professional(professional_id));

DROP POLICY IF EXISTS availability_delete ON public.availability;
CREATE POLICY availability_delete ON public.availability
FOR DELETE TO authenticated USING (public.can_manage_professional(professional_id));

DROP POLICY IF EXISTS appointment_select ON public.appointments;
CREATE POLICY appointment_select ON public.appointments
FOR SELECT TO authenticated
USING (
  profile_id = auth.uid()
  OR public.can_manage_professional(professional_id, organization_id)
);

DROP POLICY IF EXISTS appointment_update ON public.appointments;
CREATE POLICY appointment_update ON public.appointments
FOR UPDATE TO authenticated
USING (
  profile_id = auth.uid()
  OR public.can_manage_professional(professional_id, organization_id)
)
WITH CHECK (
  profile_id = auth.uid()
  OR public.can_manage_professional(professional_id, organization_id)
);

NOTIFY pgrst, 'reload schema';
COMMIT;
