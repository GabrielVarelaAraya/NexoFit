export type RoleType = 'admin' | 'coach' | 'professional' | 'member';

export type BookingStatus = 'confirmed' | 'cancelled' | 'attended' | 'no_show';

export interface Organization {
  id: string;
  name: string;
  created_at: string;
}

export interface Venue {
  id: string;
  organization_id: string;
  name: string;
}

export interface Space {
  id: string;
  venue_id: string;
  name: string;
  capacity: number;
}

export interface Profile {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
}

export interface Membership {
  id: string;
  organization_id: string;
  profile_id: string;
  role: RoleType;
}

export interface ClassType {
  id: string;
  organization_id: string;
  name: string;
  color: string;
}

export interface Session {
  id: string;
  class_type_id: string;
  space_id: string;
  starts_at: string;
  ends_at: string;
  coach_id: string;
}

export interface SessionPublic {
  id: string;
  organization_id: string;
  class_type_id: string;
  venue_id: string;
  space_id: string;
  coach_id: string;
  start_at: string;
  end_at: string;
  capacity_override: number | null;
  status: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
  class_types?: { name: string; emoji: string } | null;
  venues?: { name: string } | null;
  spaces?: { name: string } | null;
  profiles?: { full_name: string } | null;
}

export interface Booking {
  id: string;
  session_id: string;
  profile_id: string;
  status: BookingStatus;
  created_at: string;
}

export interface BookingPublic {
  id: string;
  session_id: string;
  profile_id: string;
  status: string;
  position: number | null;
  booked_at: string;
  confirmed_at: string | null;
  cancelled_at: string | null;
  sessions?: {
    id: string;
    start_at: string;
    end_at: string;
    class_types?: { name: string; emoji: string } | null;
    venues?: { name: string } | null;
    spaces?: { name: string } | null;
  } | null;
}

export interface WaitlistPosition {
  id: string;
  session_id: string;
  profile_id: string;
  position: number;
}

export interface WorkoutProgram {
  id: string;
  session_id: string;
  content: string;
  published_by: string;
}

export interface Appointment {
  id: string;
  organization_id: string;
  professional_id: string;
  profile_id: string;
  service_id: string;
  starts_at: string;
  ends_at: string;
}

export interface Measurement {
  id: string;
  organization_id: string;
  profile_id: string;
  measured_at: string;
  source: string;
}

export interface MeasurementValue {
  measurement_id: string;
  metric: string;
  value: number;
}
