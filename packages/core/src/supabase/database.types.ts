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
        Relationships: [];
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
        Relationships: [
          {
            foreignKeyName: 'venues_organization_id_fkey';
            columns: ['organization_id'];
            referencedRelation: 'organizations';
            referencedColumns: ['id'];
          },
        ];
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
        Relationships: [
          {
            foreignKeyName: 'spaces_venue_id_fkey';
            columns: ['venue_id'];
            referencedRelation: 'venues';
            referencedColumns: ['id'];
          },
        ];
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
        Relationships: [];
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
        Relationships: [
          {
            foreignKeyName: 'memberships_organization_id_fkey';
            columns: ['organization_id'];
            referencedRelation: 'organizations';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'memberships_profile_id_fkey';
            columns: ['profile_id'];
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
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
        Relationships: [
          {
            foreignKeyName: 'class_types_organization_id_fkey';
            columns: ['organization_id'];
            referencedRelation: 'organizations';
            referencedColumns: ['id'];
          },
        ];
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
        Relationships: [
          {
            foreignKeyName: 'coaches_membership_id_fkey';
            columns: ['membership_id'];
            referencedRelation: 'memberships';
            referencedColumns: ['id'];
          },
        ];
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
        Relationships: [
          {
            foreignKeyName: 'sessions_class_type_id_fkey';
            columns: ['class_type_id'];
            referencedRelation: 'class_types';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'sessions_space_id_fkey';
            columns: ['space_id'];
            referencedRelation: 'spaces';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'sessions_coach_id_fkey';
            columns: ['coach_id'];
            referencedRelation: 'coaches';
            referencedColumns: ['id'];
          },
        ];
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
        Relationships: [
          {
            foreignKeyName: 'bookings_session_id_fkey';
            columns: ['session_id'];
            referencedRelation: 'sessions';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'bookings_profile_id_fkey';
            columns: ['profile_id'];
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
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
        Relationships: [
          {
            foreignKeyName: 'waitlist_positions_session_id_fkey';
            columns: ['session_id'];
            referencedRelation: 'sessions';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'waitlist_positions_profile_id_fkey';
            columns: ['profile_id'];
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
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
        Relationships: [
          {
            foreignKeyName: 'attendance_booking_id_fkey';
            columns: ['booking_id'];
            referencedRelation: 'bookings';
            referencedColumns: ['id'];
          },
        ];
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
        Relationships: [
          {
            foreignKeyName: 'workout_programs_session_id_fkey';
            columns: ['session_id'];
            referencedRelation: 'sessions';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'workout_programs_published_by_fkey';
            columns: ['published_by'];
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
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
        Relationships: [
          {
            foreignKeyName: 'professionals_membership_id_fkey';
            columns: ['membership_id'];
            referencedRelation: 'memberships';
            referencedColumns: ['id'];
          },
        ];
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
        Relationships: [
          {
            foreignKeyName: 'services_organization_id_fkey';
            columns: ['organization_id'];
            referencedRelation: 'organizations';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'services_professional_id_fkey';
            columns: ['professional_id'];
            referencedRelation: 'professionals';
            referencedColumns: ['id'];
          },
        ];
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
        Relationships: [
          {
            foreignKeyName: 'availability_professional_id_fkey';
            columns: ['professional_id'];
            referencedRelation: 'professionals';
            referencedColumns: ['id'];
          },
        ];
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
        Relationships: [
          {
            foreignKeyName: 'appointments_organization_id_fkey';
            columns: ['organization_id'];
            referencedRelation: 'organizations';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'appointments_service_id_fkey';
            columns: ['service_id'];
            referencedRelation: 'services';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'appointments_professional_id_fkey';
            columns: ['professional_id'];
            referencedRelation: 'professionals';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'appointments_profile_id_fkey';
            columns: ['profile_id'];
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      measurements: {
        Row: {
          id: string;
          organization_id: string | null;
          profile_id: string;
          measured_at: string;
          source: MeasurementSource;
          notes: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          organization_id?: string | null;
          profile_id: string;
          measured_at: string;
          source?: MeasurementSource;
          notes?: string | null;
        };
        Update: {
          organization_id?: string | null;
          measured_at?: string;
          source?: MeasurementSource;
          notes?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'measurements_organization_id_fkey';
            columns: ['organization_id'];
            referencedRelation: 'organizations';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'measurements_profile_id_fkey';
            columns: ['profile_id'];
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
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
        Relationships: [
          {
            foreignKeyName: 'measurement_values_measurement_id_fkey';
            columns: ['measurement_id'];
            referencedRelation: 'measurements';
            referencedColumns: ['id'];
          },
        ];
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
        Relationships: [
          {
            foreignKeyName: 'access_permissions_measurement_id_fkey';
            columns: ['measurement_id'];
            referencedRelation: 'measurements';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'access_permissions_professional_id_fkey';
            columns: ['professional_id'];
            referencedRelation: 'professionals';
            referencedColumns: ['id'];
          },
        ];
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
        Relationships: [
          {
            foreignKeyName: 'notifications_profile_id_fkey';
            columns: ['profile_id'];
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'notifications_organization_id_fkey';
            columns: ['organization_id'];
            referencedRelation: 'organizations';
            referencedColumns: ['id'];
          },
        ];
      };
      membership_plans: {
        Row: {
          id: string;
          organization_id: string;
          name: string;
          description: string | null;
          price_cents: number;
          currency: string;
          duration_days: number;
          active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          name: string;
          description?: string | null;
          price_cents: number;
          currency?: string;
          duration_days: number;
          active?: boolean;
        };
        Update: {
          name?: string;
          description?: string | null;
          price_cents?: number;
          currency?: string;
          duration_days?: number;
          active?: boolean;
        };
        Relationships: [
          {
            foreignKeyName: 'membership_plans_organization_id_fkey';
            columns: ['organization_id'];
            referencedRelation: 'organizations';
            referencedColumns: ['id'];
          },
        ];
      };
      payments: {
        Row: {
          id: string;
          organization_id: string;
          profile_id: string;
          plan_id: string | null;
          amount_cents: number;
          currency: string;
          method: string;
          status: string;
          paid_at: string;
          notes: string | null;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          profile_id: string;
          plan_id?: string | null;
          amount_cents: number;
          currency?: string;
          method?: string;
          status?: string;
          paid_at?: string;
          notes?: string | null;
          created_by?: string | null;
        };
        Update: {
          plan_id?: string | null;
          amount_cents?: number;
          currency?: string;
          method?: string;
          status?: string;
          paid_at?: string;
          notes?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'payments_organization_id_fkey';
            columns: ['organization_id'];
            referencedRelation: 'organizations';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'payments_profile_id_fkey';
            columns: ['profile_id'];
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'payments_plan_id_fkey';
            columns: ['plan_id'];
            referencedRelation: 'membership_plans';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'payments_created_by_fkey';
            columns: ['created_by'];
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      exercise_library: {
        Row: {
          id: string;
          organization_id: string;
          name: string;
          description: string | null;
          category: string;
          primary_muscle: string | null;
          secondary_muscles: string[] | null;
          equipment: string[] | null;
          instructions: string | null;
          video_url: string | null;
          image_url: string | null;
          is_custom: boolean;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          name: string;
          description?: string | null;
          category?: string;
          primary_muscle?: string | null;
          secondary_muscles?: string[] | null;
          equipment?: string[] | null;
          instructions?: string | null;
          video_url?: string | null;
          image_url?: string | null;
          is_custom?: boolean;
          created_by?: string | null;
        };
        Update: {
          name?: string;
          description?: string | null;
          category?: string;
          primary_muscle?: string | null;
          secondary_muscles?: string[] | null;
          equipment?: string[] | null;
          instructions?: string | null;
          video_url?: string | null;
          image_url?: string | null;
          is_custom?: boolean;
        };
        Relationships: [
          {
            foreignKeyName: 'exercise_library_organization_id_fkey';
            columns: ['organization_id'];
            referencedRelation: 'organizations';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'exercise_library_created_by_fkey';
            columns: ['created_by'];
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      workout_logs: {
        Row: {
          id: string;
          organization_id: string;
          profile_id: string;
          session_id: string | null;
          workout_program_id: string | null;
          status: string;
          started_at: string;
          completed_at: string | null;
          duration_seconds: number | null;
          notes: string | null;
          rpe_overall: number | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          profile_id: string;
          session_id?: string | null;
          workout_program_id?: string | null;
          status?: string;
          started_at?: string;
          completed_at?: string | null;
          duration_seconds?: number | null;
          notes?: string | null;
          rpe_overall?: number | null;
        };
        Update: {
          status?: string;
          completed_at?: string | null;
          duration_seconds?: number | null;
          notes?: string | null;
          rpe_overall?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: 'workout_logs_organization_id_fkey';
            columns: ['organization_id'];
            referencedRelation: 'organizations';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'workout_logs_profile_id_fkey';
            columns: ['profile_id'];
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'workout_logs_session_id_fkey';
            columns: ['session_id'];
            referencedRelation: 'sessions';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'workout_logs_workout_program_id_fkey';
            columns: ['workout_program_id'];
            referencedRelation: 'workout_programs';
            referencedColumns: ['id'];
          },
        ];
      };
      workout_exercises: {
        Row: {
          id: string;
          workout_log_id: string;
          exercise_library_id: string | null;
          custom_name: string | null;
          order_index: number;
          notes: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          workout_log_id: string;
          exercise_library_id?: string | null;
          custom_name?: string | null;
          order_index?: number;
          notes?: string | null;
        };
        Update: {
          custom_name?: string | null;
          order_index?: number;
          notes?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'workout_exercises_workout_log_id_fkey';
            columns: ['workout_log_id'];
            referencedRelation: 'workout_logs';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'workout_exercises_exercise_library_id_fkey';
            columns: ['exercise_library_id'];
            referencedRelation: 'exercise_library';
            referencedColumns: ['id'];
          },
        ];
      };
      exercise_sets: {
        Row: {
          id: string;
          workout_exercise_id: string;
          set_number: number;
          type: string;
          reps: number | null;
          weight_kg: number | null;
          distance_meters: number | null;
          duration_seconds: number | null;
          rpe: number | null;
          rest_seconds: number | null;
          completed: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          workout_exercise_id: string;
          set_number: number;
          type?: string;
          reps?: number | null;
          weight_kg?: number | null;
          distance_meters?: number | null;
          duration_seconds?: number | null;
          rpe?: number | null;
          rest_seconds?: number | null;
          completed?: boolean;
        };
        Update: {
          reps?: number | null;
          weight_kg?: number | null;
          distance_meters?: number | null;
          duration_seconds?: number | null;
          rpe?: number | null;
          rest_seconds?: number | null;
          completed?: boolean;
        };
        Relationships: [
          {
            foreignKeyName: 'exercise_sets_workout_exercise_id_fkey';
            columns: ['workout_exercise_id'];
            referencedRelation: 'workout_exercises';
            referencedColumns: ['id'];
          },
        ];
      };
      personal_records: {
        Row: {
          id: string;
          organization_id: string;
          profile_id: string;
          exercise_library_id: string;
          record_type: string;
          value_numeric: number;
          unit: string;
          reps: number | null;
          weight_kg: number | null;
          achieved_at: string;
          workout_log_id: string | null;
          notes: string | null;
        };
        Insert: {
          id?: string;
          organization_id: string;
          profile_id: string;
          exercise_library_id: string;
          record_type: string;
          value_numeric: number;
          unit: string;
          reps?: number | null;
          weight_kg?: number | null;
          achieved_at?: string;
          workout_log_id?: string | null;
          notes?: string | null;
        };
        Update: {
          value_numeric?: number;
          unit?: string;
          reps?: number | null;
          weight_kg?: number | null;
          achieved_at?: string;
          workout_log_id?: string | null;
          notes?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'personal_records_organization_id_fkey';
            columns: ['organization_id'];
            referencedRelation: 'organizations';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'personal_records_profile_id_fkey';
            columns: ['profile_id'];
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'personal_records_exercise_library_id_fkey';
            columns: ['exercise_library_id'];
            referencedRelation: 'exercise_library';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'personal_records_workout_log_id_fkey';
            columns: ['workout_log_id'];
            referencedRelation: 'workout_logs';
            referencedColumns: ['id'];
          },
        ];
      };
      workout_templates: {
        Row: {
          id: string;
          organization_id: string;
          created_by: string;
          name: string;
          description: string | null;
          is_public: boolean;
          estimated_duration_minutes: number | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          created_by: string;
          name: string;
          description?: string | null;
          is_public?: boolean;
          estimated_duration_minutes?: number | null;
        };
        Update: {
          name?: string;
          description?: string | null;
          is_public?: boolean;
          estimated_duration_minutes?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: 'workout_templates_organization_id_fkey';
            columns: ['organization_id'];
            referencedRelation: 'organizations';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'workout_templates_created_by_fkey';
            columns: ['created_by'];
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      workout_template_exercises: {
        Row: {
          id: string;
          template_id: string;
          exercise_library_id: string;
          order_index: number;
          target_sets: number | null;
          target_reps: string | null;
          target_weight_kg: number | null;
          target_rpe: number | null;
          rest_seconds: number | null;
          notes: string | null;
        };
        Insert: {
          id?: string;
          template_id: string;
          exercise_library_id: string;
          order_index?: number;
          target_sets?: number | null;
          target_reps?: string | null;
          target_weight_kg?: number | null;
          target_rpe?: number | null;
          rest_seconds?: number | null;
          notes?: string | null;
        };
        Update: {
          order_index?: number;
          target_sets?: number | null;
          target_reps?: string | null;
          target_weight_kg?: number | null;
          target_rpe?: number | null;
          rest_seconds?: number | null;
          notes?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'workout_template_exercises_template_id_fkey';
            columns: ['template_id'];
            referencedRelation: 'workout_templates';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'workout_template_exercises_exercise_library_id_fkey';
            columns: ['exercise_library_id'];
            referencedRelation: 'exercise_library';
            referencedColumns: ['id'];
          },
        ];
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
      create_organization: {
        Args: { p_name: string };
        Returns: Json;
      };
      get_session_capacity: {
        Args: { p_session_id: string };
        Returns: Json;
      };
    };
    Views: {};
  };
}

// Type aliases for easier imports
export type MeasurementRow = Database['public']['Tables']['measurements']['Row'];
export type MeasurementValueRow = Database['public']['Tables']['measurement_values']['Row'];
export type ExerciseLibraryRow = Database['public']['Tables']['exercise_library']['Row'];
export type WorkoutLogRow = Database['public']['Tables']['workout_logs']['Row'];
export type WorkoutExerciseRow = Database['public']['Tables']['workout_exercises']['Row'];
export type ExerciseSetRow = Database['public']['Tables']['exercise_sets']['Row'];
export type PersonalRecordRow = Database['public']['Tables']['personal_records']['Row'];
export type WorkoutTemplateRow = Database['public']['Tables']['workout_templates']['Row'];
export type WorkoutTemplateExerciseRow =
  Database['public']['Tables']['workout_template_exercises']['Row'];
export type MembershipPlanRow = Database['public']['Tables']['membership_plans']['Row'];
export type PaymentRow = Database['public']['Tables']['payments']['Row'];
