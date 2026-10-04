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
  class_type_id: string;
  space_id: string;
  coach_id: string | null;
  starts_at: string;
  ends_at: string;
  capacity_override: number | null;
  created_at: string;
  class_types?: { name: string } | null;
  spaces?: { name: string; capacity: number; venues?: { name: string } | null } | null;
  coaches?: { memberships?: { profiles?: { full_name: string | null } | null } | null } | null;
  /** Reservas confirmadas de la sesión (se consulta aparte, no es columna). */
  booking_count?: number;
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
  /** 'waitlist' es un estado derivado de waitlist_positions, no del enum bookings.status. */
  status: string;
  created_at: string;
  cancelled_at: string | null;
  /** Solo presente en entradas de lista de espera. */
  position?: number | null;
  sessions?: {
    id: string;
    starts_at: string;
    ends_at: string;
    class_types?: { name: string } | null;
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

export type ExerciseCategory =
  'strength' | 'cardio' | 'mobility' | 'gymnastics' | 'olympic' | 'strongman' | 'other';

export type MuscleGroup =
  | 'chest'
  | 'back'
  | 'shoulders'
  | 'biceps'
  | 'triceps'
  | 'forearms'
  | 'abs'
  | 'obliques'
  | 'lower_back'
  | 'glutes'
  | 'quadriceps'
  | 'hamstrings'
  | 'calves'
  | 'adductors'
  | 'abductors'
  | 'full_body';

export type SetType = 'normal' | 'warmup' | 'dropset' | 'failure' | 'amrap' | 'emom' | 'tabata';

export type WorkoutStatus = 'in_progress' | 'completed' | 'cancelled';

export type WorkoutRecordType = '1rm' | 'max_reps' | 'max_weight' | 'max_distance' | 'best_time';

export interface ExerciseLibrary {
  id: string;
  organization_id: string;
  name: string;
  description: string | null;
  category: ExerciseCategory;
  primary_muscle: MuscleGroup | null;
  secondary_muscles: MuscleGroup[];
  equipment: string[];
  instructions: string | null;
  video_url: string | null;
  image_url: string | null;
  is_custom: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface WorkoutLog {
  id: string;
  organization_id: string;
  profile_id: string;
  session_id: string | null;
  workout_program_id: string | null;
  status: WorkoutStatus;
  started_at: string;
  completed_at: string | null;
  duration_seconds: number | null;
  notes: string | null;
  rpe_overall: number | null;
  created_at: string;
  updated_at: string;
}

export interface WorkoutExercise {
  id: string;
  workout_log_id: string;
  exercise_library_id: string | null;
  custom_name: string | null;
  order_index: number;
  notes: string | null;
  created_at: string;
}

export interface ExerciseSet {
  id: string;
  workout_exercise_id: string;
  set_number: number;
  type: SetType;
  reps: number | null;
  weight_kg: number | null;
  distance_meters: number | null;
  duration_seconds: number | null;
  rpe: number | null;
  rest_seconds: number | null;
  completed: boolean;
  created_at: string;
  updated_at: string;
}

export interface PersonalRecord {
  id: string;
  organization_id: string;
  profile_id: string;
  exercise_library_id: string;
  record_type: WorkoutRecordType;
  value_numeric: number;
  unit: string;
  reps: number | null;
  weight_kg: number | null;
  achieved_at: string;
  workout_log_id: string | null;
  notes: string | null;
}

export interface WorkoutTemplate {
  id: string;
  organization_id: string;
  created_by: string;
  name: string;
  description: string | null;
  is_public: boolean;
  estimated_duration_minutes: number | null;
  created_at: string;
  updated_at: string;
}

export interface WorkoutTemplateExercise {
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
}
