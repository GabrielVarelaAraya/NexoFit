export interface SessionWithType {
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
  booking_count?: number;
  class_types: { name: string; emoji: string } | null;
  venues: { name: string } | null;
  spaces: { name: string } | null;
  profiles: { full_name: string } | null;
}

export interface BookingWithSession {
  id: string;
  session_id: string;
  profile_id: string;
  status: string;
  position: number | null;
  booked_at: string;
  confirmed_at: string | null;
  cancelled_at: string | null;
  sessions: {
    id: string;
    start_at: string;
    end_at: string;
    class_types: { name: string; emoji: string } | null;
    venues: { name: string } | null;
    spaces: { name: string } | null;
  } | null;
}

export interface NavigationProp {
  navigate: (screen: string, params?: Record<string, unknown>) => void;
  goBack: () => void;
}
