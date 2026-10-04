import type { SessionPublic, BookingPublic } from '@nexofit/core';

export type SessionWithType = SessionPublic;
export type BookingWithSession = BookingPublic;

export interface NavigationProp {
  navigate: (screen: string, params?: Record<string, unknown>) => void;
  goBack: () => void;
}
