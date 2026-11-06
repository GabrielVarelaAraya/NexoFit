// Intención de alta capturada en la selección de rol: «Represento un
// gimnasio» continúa en SignUp; «Soy cliente» en Login. La pantalla de
// Inicio sin gimnasio la usa para ofrecer «Registrar mi gimnasio» solo a
// quien eligió el rol de gimnasio — por defecto es 'client', así que si
// la sesión se reinicia el cliente nunca ve la opción de registrar.
export type SignupIntent = 'gym_owner' | 'client';

let currentIntent: SignupIntent = 'client';

export function setSignupIntent(intent: SignupIntent): void {
  currentIntent = intent;
}

export function getSignupIntent(): SignupIntent {
  return currentIntent;
}
