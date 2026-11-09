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

import { confirmAction, notify } from './alerts';
import { setDialogListener, toneForTitle, type DialogRequest } from './dialogStore';

beforeEach(() => {
  mockAlert.mockReset();
  mockOS.value = 'ios';
});

describe('with an in-app dialog host on web', () => {
  let received: DialogRequest[];
  let unregister: () => void;

  beforeEach(() => {
    received = [];
    unregister = setDialogListener((request) => received.push(request));
    mockOS.value = 'web';
    vi.stubGlobal('window', { alert: vi.fn(), confirm: vi.fn() });
  });

  afterEach(() => unregister());

  it('shows notify as a toast instead of window.alert', () => {
    notify('No pudimos guardar.', 'No se pudo guardar');

    expect(received).toEqual([
      { kind: 'toast', title: 'No se pudo guardar', message: 'No pudimos guardar.', tone: 'error' },
    ]);
    expect(window.alert).not.toHaveBeenCalled();
  });

  it('routes confirmAction to the host with defaults', () => {
    const onConfirm = vi.fn();
    confirmAction({ title: 'Borrar', message: '¿Seguro?', confirmLabel: 'Borrar', onConfirm });

    expect(received[0]).toMatchObject({
      kind: 'confirm',
      cancelLabel: 'Cancelar',
      destructive: true,
    });
    expect(window.confirm).not.toHaveBeenCalled();
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('still uses the native dialog on native platforms', () => {
    mockOS.value = 'ios';
    notify('Hola', 'Aviso');
    expect(received).toHaveLength(0);
    expect(mockAlert).toHaveBeenCalled();
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
  });

  it('defaults to info', () => {
    expect(toneForTitle()).toBe('info');
    expect(toneForTitle('Ayuda y soporte')).toBe('info');
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('notify', () => {
  it('uses the native dialog on native platforms', () => {
    notify('Guardado correctamente.', 'Éxito');

    expect(mockAlert).toHaveBeenCalledWith('Éxito', 'Guardado correctamente.');
  });

  it('falls back to window.alert on web (RN-Web ignores Alert)', () => {
    const alert = vi.fn();
    vi.stubGlobal('window', { alert });
    mockOS.value = 'web';

    notify('Sin conexión.', 'Error');

    expect(alert).toHaveBeenCalledWith('Error\n\nSin conexión.');
    expect(mockAlert).not.toHaveBeenCalled();
  });

  it('shows only the message when there is no title', () => {
    notify('Solo mensaje');

    expect(mockAlert).toHaveBeenCalledWith('', 'Solo mensaje');
  });
});

describe('confirmAction', () => {
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
