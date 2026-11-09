import type { SignupIntent } from './signupIntent';

/** Cómo piensa usar NexoFit quien se registra (se pregunta solo en el registro). */
export type Usage = 'member' | 'professional' | 'gym_owner';

export const USAGE_OPTIONS: {
  id: Usage;
  label: string;
  icon: 'barbell-outline' | 'pulse-outline' | 'business-outline';
  hint?: string;
}[] = [
  { id: 'member', label: 'Entreno en un gimnasio', icon: 'barbell-outline' },
  {
    id: 'professional',
    label: 'Soy profesional (nutrición, fisio, coach…)',
    icon: 'pulse-outline',
    hint: 'Únete a tu gimnasio y pídele que te asigne el rol de profesional para ver tu agenda.',
  },
  {
    id: 'gym_owner',
    label: 'Administro un gimnasio',
    icon: 'business-outline',
    hint: 'Después de verificar tu correo podrás registrar tu gimnasio.',
  },
];

/** El profesional entra como miembro: el rol lo asigna el gimnasio. */
export function intentForUsage(usage: Usage): SignupIntent {
  return usage === 'gym_owner' ? 'gym_owner' : 'client';
}

export interface PasswordCheck {
  label: string;
  ok: boolean;
}

/** Requisitos de contraseña del registro, para mostrarlos en vivo. */
export function signupPasswordChecks(password: string): PasswordCheck[] {
  return [{ label: 'Al menos 8 caracteres', ok: password.length >= 8 }];
}
