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

beforeEach(() => {
  mockAlert.mockReset();
  mockOS.value = 'ios';
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
