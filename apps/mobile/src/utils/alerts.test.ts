import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { mockAlert, mockOS } = vi.hoisted(() => ({
  mockAlert: vi.fn(),
  mockOS: { value: 'ios' },
}));

vi.mock('react-native', () => ({
  Alert: { alert: mockAlert },
  Platform: {
    get OS() {
      return mockOS.value;
    },
  },
}));

import { confirmAction, notify, showMessage } from './alerts';
import {
  LONG_MESSAGE_CHARS,
  isLongMessage,
  setDialogListener,
  toneForTitle,
  type DialogRequest,
} from './dialogStore';

beforeEach(() => {
  mockAlert.mockReset();
  mockOS.value = 'ios';
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe.each(['ios', 'web'])('with the NexoFit dialog host on %s', (platform) => {
  let received: DialogRequest[];
  let unregister: () => void;

  beforeEach(() => {
    received = [];
    unregister = setDialogListener((request) => received.push(request));
    mockOS.value = platform;
    vi.stubGlobal('window', { alert: vi.fn(), confirm: vi.fn() });
  });

  afterEach(() => unregister());

  it('shows a short notify as a toast, never the system dialog', () => {
    notify('No pudimos guardar.', 'No se pudo guardar');

    expect(received).toEqual([
      { kind: 'toast', title: 'No se pudo guardar', message: 'No pudimos guardar.', tone: 'error' },
    ]);
    expect(mockAlert).not.toHaveBeenCalled();
    expect(window.alert).not.toHaveBeenCalled();
  });

  it('shows a long notify as a card with a button so it can be read calmly', () => {
    // Texto real de «Acerca de NexoFit» (ProfileScreen).
    const about =
      'NexoFit es la app para reservar clases, gestionar tus citas, seguir tu progreso y consultar tus reservas en tu gimnasio.';
    notify(about, 'Acerca de NexoFit');

    expect(received).toEqual([
      {
        kind: 'message',
        title: 'Acerca de NexoFit',
        message: about,
        tone: 'info',
        buttonLabel: 'Entendido',
      },
    ]);
    expect(mockAlert).not.toHaveBeenCalled();
  });

  it('showMessage opens a card and passes onClose through', () => {
    const onClose = vi.fn();
    showMessage({
      title: 'Entrenamiento guardado',
      message: 'Tu registro ya aparece en Progreso.',
      buttonLabel: 'Listo',
      onClose,
    });

    expect(received).toHaveLength(1);
    expect(received[0]).toMatchObject({
      kind: 'message',
      tone: 'success',
      buttonLabel: 'Listo',
      onClose,
    });
    expect(onClose).not.toHaveBeenCalled();
    expect(mockAlert).not.toHaveBeenCalled();
  });

  it('routes confirmAction to the host with its defaults', () => {
    const onConfirm = vi.fn();
    confirmAction({ title: 'Borrar', message: '¿Seguro?', confirmLabel: 'Borrar', onConfirm });

    expect(received[0]).toMatchObject({
      kind: 'confirm',
      cancelLabel: 'Cancelar',
      destructive: true,
    });
    expect(mockAlert).not.toHaveBeenCalled();
    expect(onConfirm).not.toHaveBeenCalled();
  });
});

describe('without a host (fallback to the system dialogs)', () => {
  it('notify uses Alert.alert in native apps', () => {
    notify('Guardado correctamente.', 'Éxito');
    expect(mockAlert).toHaveBeenCalledWith('Éxito', 'Guardado correctamente.', undefined);
  });

  it('notify uses window.alert on web (RN-Web ignores Alert)', () => {
    const alert = vi.fn();
    vi.stubGlobal('window', { alert });
    mockOS.value = 'web';

    notify('Sin conexión.', 'Error');

    expect(alert).toHaveBeenCalledWith('Error\n\nSin conexión.');
    expect(mockAlert).not.toHaveBeenCalled();
  });

  it('notify shows only the message when there is no title', () => {
    notify('Solo mensaje');
    expect(mockAlert).toHaveBeenCalledWith('', 'Solo mensaje', undefined);
  });

  it('showMessage runs onClose from the native OK button', () => {
    const onClose = vi.fn();
    showMessage({ title: 'Listo', message: 'Hecho', onClose });

    const buttons = mockAlert.mock.calls[0][2] as { text: string; onPress: () => void }[];
    expect(buttons[0].text).toBe('OK');
    buttons[0].onPress();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('showMessage on web alerts and then runs onClose', () => {
    const alert = vi.fn();
    const onClose = vi.fn();
    vi.stubGlobal('window', { alert });
    mockOS.value = 'web';

    showMessage({ title: 'Listo', message: 'Hecho', onClose });

    expect(alert).toHaveBeenCalledWith('Listo\n\nHecho');
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe('confirmAction fallback', () => {
  const options = {
    title: 'Cancelar reserva',
    message: '¿Estás seguro?',
    confirmLabel: 'Sí, cancelar',
    onConfirm: vi.fn(),
  };

  beforeEach(() => {
    options.onConfirm.mockReset();
  });

  it('runs onConfirm when the native confirm button is pressed', () => {
    confirmAction(options);

    const buttons = mockAlert.mock.calls[0][2] as Array<{
      text: string;
      style?: string;
      onPress?: () => void;
    }>;
    expect(buttons).toHaveLength(2);
    expect(buttons[0].style).toBe('cancel');
    expect(buttons[1].text).toBe('Sí, cancelar');

    buttons[1].onPress?.();
    expect(options.onConfirm).toHaveBeenCalledTimes(1);
  });

  it('does not run onConfirm when cancelled natively', () => {
    confirmAction(options);

    const buttons = mockAlert.mock.calls[0][2] as Array<{ text: string; onPress?: () => void }>;
    expect(buttons[0].text).toBe('Cancelar');
    expect(buttons[0].onPress).toBeUndefined();
    expect(options.onConfirm).not.toHaveBeenCalled();
  });

  it('uses window.confirm on web and runs onConfirm when accepted', () => {
    const confirm = vi.fn(() => true);
    vi.stubGlobal('window', { confirm });
    mockOS.value = 'web';

    confirmAction(options);

    expect(confirm).toHaveBeenCalledWith('Cancelar reserva\n\n¿Estás seguro?');
    expect(options.onConfirm).toHaveBeenCalledTimes(1);
  });

  it('skips onConfirm when the web dialog is dismissed', () => {
    vi.stubGlobal('window', { confirm: vi.fn(() => false) });
    mockOS.value = 'web';

    confirmAction(options);

    expect(options.onConfirm).not.toHaveBeenCalled();
    expect(mockAlert).not.toHaveBeenCalled();
  });
});

describe('toneForTitle', () => {
  it('maps error-like titles to error', () => {
    expect(toneForTitle('Error')).toBe('error');
    expect(toneForTitle('No se pudo cancelar')).toBe('error');
    expect(toneForTitle('Sin conexión')).toBe('error');
  });

  it('maps success-like titles to success', () => {
    expect(toneForTitle('Listo')).toBe('success');
    expect(toneForTitle('Cita reservada')).toBe('success');
    expect(toneForTitle('¡Inscripción completa!')).toBe('success');
    expect(toneForTitle('Ya registrado')).toBe('success');
  });

  it('defaults to info', () => {
    expect(toneForTitle()).toBe('info');
    expect(toneForTitle('Ayuda y soporte')).toBe('info');
    expect(toneForTitle('Acerca de NexoFit')).toBe('info');
  });
});

describe('isLongMessage', () => {
  it('keeps short feedback as a toast and moves long text to a card', () => {
    expect(isLongMessage('Se envió a 3 miembros.')).toBe(false);
    expect(isLongMessage('x'.repeat(LONG_MESSAGE_CHARS))).toBe(false);
    expect(isLongMessage('x'.repeat(LONG_MESSAGE_CHARS + 1))).toBe(true);
    expect(isLongMessage('Línea uno\nLínea dos')).toBe(true);
  });
});
