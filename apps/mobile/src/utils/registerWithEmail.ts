import type { SupabaseClient } from '@supabase/supabase-js';

export interface RegistrationClient {
  rpc: (
    name: 'email_exists',
    args: { p_email: string }
  ) => PromiseLike<{ data: boolean | null; error: { message: string } | null }>;
  auth: Pick<SupabaseClient['auth'], 'signUp'>;
}

export interface RegistrationResult {
  error?: string;
  code?: string;
  needsConfirmation: boolean;
}

interface RegistrationInput {
  email: string;
  password: string;
  fullName: string;
  emailRedirectTo: string;
}

const duplicateEmailMessage =
  'Este correo ya está registrado. Inicia sesión o recupera tu contraseña.';

export async function registerWithEmail(
  client: RegistrationClient,
  { email, password, fullName, emailRedirectTo }: RegistrationInput
): Promise<RegistrationResult> {
  const normalizedEmail = email.trim().toLowerCase();
  const { data: exists, error: checkError } = await client.rpc('email_exists', {
    p_email: normalizedEmail,
  });

  if (checkError || typeof exists !== 'boolean') {
    return {
      error: 'No pudimos comprobar el correo. Inténtalo de nuevo.',
      needsConfirmation: false,
    };
  }

  // Includes accounts that have not confirmed their email yet.
  if (exists) {
    return { error: duplicateEmailMessage, code: 'email_exists', needsConfirmation: false };
  }

  const { data, error } = await client.auth.signUp({
    email: normalizedEmail,
    password,
    options: {
      data: { full_name: fullName.trim() },
      emailRedirectTo,
    },
  });

  if (error) {
    if (error.code === 'user_already_exists' || error.code === 'email_exists') {
      return { error: duplicateEmailMessage, code: 'email_exists', needsConfirmation: false };
    }
    return { error: error.message, code: error.code, needsConfirmation: false };
  }

  // Auth can hide a duplicate registration behind a successful response.
  // Also covers a confirmed account created after the existence check.
  if (data.user?.identities?.length === 0 && !data.session) {
    return { error: duplicateEmailMessage, code: 'email_exists', needsConfirmation: false };
  }

  if (!data.user) {
    return { error: 'No se pudo crear la cuenta. Inténtalo de nuevo.', needsConfirmation: false };
  }

  return { needsConfirmation: !data.session };
}
