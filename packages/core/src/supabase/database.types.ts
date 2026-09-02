export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type RoleType = 'admin' | 'coach' | 'professional' | 'member';
export type BookingStatus = 'confirmed' | 'cancelled' | 'attended' | 'no_show';
export type MeasurementSource = 'manual' | 'inbody' | 'other';

export interface Database {
  public: {
    Tables: {
      organizations: {
        Row: {
          id: string;
          name: string;
          slug: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          slug: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          slug?: string;
        };
      };
      venues: {
        Row: {
          id: string;
          organization_id: string;
          name: string;
          address: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          name: string;
          address?: string | null;
          created_at?: string;
        };
        Update: {
          organization_id?: string;
          name?: string;
          address?: string | null;
        };
      };
      spaces: {
        Row: {
          id: string;
          venue_id: string;
          name: string;
          capacity: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          venue_id: string;
          name: string;
          capacity: number;
          created_at?: string;
        };
        Update: {
          venue_id?: string;
          name?: string;
          capacity?: number;
        };
      };
      profiles: {
        Row: {
          id: string;
          full_name: string | null;
          avatar_url: string | null;
          phone: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          full_name?: string | null;
          avatar_url?: string | null;
          phone?: string | null;
        };
        Update: {
          full_name?: string | null;
          avatar_url?: string | null;
          phone?: string | null;
        };
      };
      memberships: {
        Row: {
          id: string;
          organization_id: string;
          profile_id: string;
          role: RoleType;
          created_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          profile_id: string;
          role: RoleType;
        };
        Update: {
          organization_id?: string;
          profile_id?: string;
          role?: RoleType;
        };
      };
      class_types: {
        Row: {
          id: string;
          organization_id: string;
          name: string;
          color: string;
          description: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          name: string;
          color?: string;
          description?: string | null;
        };
        Update: {
          name?: string;
          color?: string;
          description?: string | null;
        };
      };
      coaches: {
        Row: {
          id: string;
          membership_id: string;
          specialization: string | null;
          bio: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          membership_id: string;
          specialization?: string | null;
          bio?: string | null;
        };
        Update: {
          specialization?: string | null;
          bio?: string | null;
        };
      };
      sessions: {
        Row: {
          id: string;
          class_type_id: string;
          space_id: string;
          coach_id: string | null;
          starts_at: string;
          ends_at: string;
          capacity_override: number | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          class_type_id: string;
          space_id: string;
          coach_id?: string | null;
          starts_at: string;
          ends_at: string;
          capacity_override?: number | null;
        };
        Update: {
          class_type_id?: string;
          space_id?: string;
          coach_id?: string | null;
          starts_at?: string;
          ends_at?: string;
          capacity_override?: number | null;
        };
      };
      bookings: {
        Row: {
          id: string;
          session_id: string;
          profile_id: string;
          status: BookingStatus;
          created_at: string;
          cancelled_at: string | null;
        };
        Insert: {
          id?: string;
          session_id: string;
          profile_id: string;
          status?: BookingStatus;
        };
        Update: {
          status?: BookingStatus;
          cancelled_at?: string | null;
        };
      };
      waitlist_positions: {
        Row: {
          id: string;
          session_id: string;
          profile_id: string;
          position: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          session_id: string;
          profile_id: string;
          position: number;
        };
        Update: {
          position?: number;
        };
      };
      attendance: {
        Row: {
          id: string;
          booking_id: string;
          checked_in_at: string;
        };
        Insert: {
          id?: string;
          booking_id: string;
          checked_in_at?: string;
        };
        Update: Record<string, never>;
      };
      workout_programs: {
        Row: {
          id: string;
          session_id: string;
          content: string;
          published_by: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          session_id: string;
          content: string;
          published_by: string;
        };
        Update: {
          content?: string;
        };
      };
      professionals: {
        Row: {
          id: string;
          membership_id: string;
          specialization: string;
          bio: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          membership_id: string;
          specialization: string;
          bio?: string | null;
        };
        Update: {
          specialization?: string;
          bio?: string | null;
        };
      };
      services: {
        Row: {
          id: string;
          organization_id: string;
          professional_id: string;
          name: string;
          description: string | null;
          duration_minutes: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          professional_id: string;
          name: string;
          description?: string | null;
          duration_minutes: number;
        };
        Update: {
          name?: string;
          description?: string | null;
          duration_minutes?: number;
        };
      };
      availability: {
        Row: {
          id: string;
          professional_id: string;
          day_of_week: number;
          start_time: string;
          end_time: string;
        };
        Insert: {
          id?: string;
          professional_id: string;
          day_of_week: number;
          start_time: string;
          end_time: string;
        };
        Update: {
          day_of_week?: number;
          start_time?: string;
          end_time?: string;
        };
      };
      appointments: {
        Row: {
          id: string;
          organization_id: string;
          service_id: string;
          professional_id: string;
          profile_id: string;
          starts_at: string;
          ends_at: string;
          status: BookingStatus;
          created_at: string;
          cancelled_at: string | null;
        };
        Insert: {
          id?: string;
          organization_id: string;
          service_id: string;
          professional_id: string;
          profile_id: string;
          starts_at: string;
          ends_at: string;
          status?: BookingStatus;
        };
        Update: {
          status?: BookingStatus;
          cancelled_at?: string | null;
        };
      };
      measurements: {
        Row: {
          id: string;
          organization_id: string;
          profile_id: string;
          measured_at: string;
          source: MeasurementSource;
          notes: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          profile_id: string;
          measured_at: string;
          source?: MeasurementSource;
          notes?: string | null;
        };
        Update: {
          measured_at?: string;
          source?: MeasurementSource;
          notes?: string | null;
        };
      };
      measurement_values: {
        Row: {
          id: string;
          measurement_id: string;
          metric_name: string;
          value_numeric: number;
          unit: string | null;
        };
        Insert: {
          id?: string;
          measurement_id: string;
          metric_name: string;
          value_numeric: number;
          unit?: string | null;
        };
        Update: {
          metric_name?: string;
          value_numeric?: number;
          unit?: string | null;
        };
      };
      access_permissions: {
        Row: {
          id: string;
          measurement_id: string;
          professional_id: string;
          granted_at: string;
        };
        Insert: {
          id?: string;
          measurement_id: string;
          professional_id: string;
        };
        Update: Record<string, never>;
      };
      notifications: {
        Row: {
          id: string;
          profile_id: string;
          organization_id: string;
          title: string;
          body: string;
          type: string;
          read: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          profile_id: string;
          organization_id: string;
          title: string;
          body: string;
          type?: string;
          read?: boolean;
        };
        Update: {
          read?: boolean;
        };
      };
    };
    Functions: {
      book_session: {
        Args: { p_session_id: string; p_profile_id: string };
        Returns: Json;
      };
      cancel_booking: {
        Args: { p_booking_id: string; p_profile_id: string };
        Returns: Json;
      };
      get_session_capacity: {
        Args: { p_session_id: string };
        Returns: Json;
      };
    };
  };
}
