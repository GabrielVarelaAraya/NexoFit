// Título de la pestaña del navegador en la versión web («Citas · NexoFit»).
// Sin esto React Navigation usaba el nombre interno de la ruta («Mas»,
// «AgendaProfesional») o «undefined» en los navegadores anidados.

const APP_NAME = 'NexoFit';

const ROUTE_TITLES: Record<string, string> = {
  RoleSelection: 'Bienvenida',
  Login: 'Iniciar sesión',
  SignUp: 'Crear cuenta',
  ForgotPassword: 'Recuperar acceso',
  VerificationCode: 'Verificar código',
  NewPassword: 'Nueva contraseña',
  Inicio: 'Inicio',
  Clases: 'Clases',
  Progreso: 'Progreso',
  Citas: 'Citas',
  Perfil: 'Perfil',
  Dashboard: 'Dashboard',
  Agenda: 'Agenda',
  Clientes: 'Clientes',
  Mas: 'Más',
  AgendaProfesional: 'Mi agenda',
  Disponibilidad: 'Disponibilidad',
  Servicios: 'Servicios',
  PerfilProfesional: 'Perfil',
  SessionDetail: 'Detalle de clase',
  MyBookings: 'Mis reservas',
  JoinGym: 'Buscar gimnasio',
  CreateGym: 'Registrar gimnasio',
  WorkoutLog: 'Entrenamiento',
  BookAppointment: 'Reservar cita',
  CreateSession: 'Nueva clase',
  PublishProgram: 'Publicar programa',
  SendNotification: 'Enviar notificación',
  Payments: 'Pagos',
  GymContent: 'Espacios y clases',
};

export function documentTitleFor(routeName?: string, optionsTitle?: string): string {
  const label = (routeName && ROUTE_TITLES[routeName]) || optionsTitle?.trim();
  return label ? `${label} · ${APP_NAME}` : APP_NAME;
}
