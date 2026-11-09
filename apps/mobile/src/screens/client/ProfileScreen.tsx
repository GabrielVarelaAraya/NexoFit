import { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  ScrollView,
  TouchableOpacity,
  Modal,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts, getSupabase } from '@nexofit/core';
import { useAuth } from '../../contexts/AuthContext';
import { useSettings } from '../../hooks/useProgress';
import { friendlyError } from '../../utils/errors';
import { confirmAction, notify } from '../../utils/alerts';
import {
  fetchMyPayments,
  formatMoney,
  formatShortDate,
  METHOD_LABELS,
  STATUS_LABELS,
  type PaymentMethod,
  type MyPayment,
  type CurrentPlan,
} from '../../hooks/usePayments';
import { useNotifications } from '../../hooks/useNotifications';
import { countUnread } from '../../utils/notifications';
import { Header, Button, Card } from '../../components/ui';

export function ProfileScreen({ professionalDetails }: { professionalDetails?: React.ReactNode }) {
  const { user, membership, signOut, refreshMembership } = useAuth();
  const { profile, updateProfile } = useSettings(user?.id ?? '');

  const [editVisible, setEditVisible] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const [saving, setSaving] = useState(false);

  const [notifVisible, setNotifVisible] = useState(false);

  const {
    notifications,
    loading: notifLoading,
    error: notifError,
    markingRead,
    refresh: refreshNotifications,
    markAllRead,
  } = useNotifications(user?.id ?? '');
  const unreadNotifications = countUnread(notifications);

  const [payVisible, setPayVisible] = useState(false);
  const [payLoading, setPayLoading] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);
  const [myPayments, setMyPayments] = useState<MyPayment[]>([]);
  const [currentPlan, setCurrentPlan] = useState<CurrentPlan | null>(null);

  const [leavingGym, setLeavingGym] = useState(false);

  const handleSignOut = () => {
    confirmAction({
      title: 'Cerrar sesión',
      message: '¿Estás seguro?',
      confirmLabel: 'Cerrar sesión',
      onConfirm: signOut,
    });
  };

  // Baja voluntaria: disponible solo para rol 'member' (la RLS 000003 lo
  // permite explícitamente; coaches/profesionales/admins los da de baja el gimnasio).
  const handleLeaveGym = async () => {
    if (!membership?.id || leavingGym) return;
    setLeavingGym(true);

    const supabase = getSupabase();
    // .select('id'): con RLS, un DELETE denegado afecta 0 filas en silencio.
    const { data, error } = await supabase
      .from('memberships')
      .delete()
      .eq('id', membership.id)
      .select('id');

    setLeavingGym(false);

    if (error || !data || data.length === 0) {
      notify(
        friendlyError(error, 'No tienes permiso para darte de baja. Habla con tu gimnasio.'),
        'No se pudo salir'
      );
      return;
    }

    // Sin membresía, el ruteo por rol lleva a la pantalla «Sin gimnasio».
    await refreshMembership();
  };

  const confirmLeaveGym = () => {
    if (!membership?.id || leavingGym) return;
    confirmAction({
      title: `Salir de ${membership.organization_name ?? 'tu gimnasio'}`,
      message:
        'Tu cuenta se conserva y podrás inscribirte de nuevo cuando quieras. El historial de reservas y pagos se queda con el gimnasio y volverá a verse si te reinscribes.',
      confirmLabel: 'Salir del gimnasio',
      onConfirm: () => void handleLeaveGym(),
    });
  };

  const openEdit = () => {
    setNameInput(profile?.full_name ?? '');
    setEditVisible(true);
  };

  const handleSaveProfile = async () => {
    setSaving(true);
    const result = await updateProfile({ full_name: nameInput.trim() || undefined });
    setSaving(false);

    if (result.success) {
      setEditVisible(false);
    } else {
      notify(result.error ?? 'No se pudo actualizar el perfil.', 'Error');
    }
  };

  const openNotifications = useCallback(() => {
    setNotifVisible(true);
    void refreshNotifications();
  }, [refreshNotifications]);

  const handleMarkAllRead = useCallback(async () => {
    const result = await markAllRead();
    if (!result.ok) {
      notify('Inténtalo de nuevo en unos segundos.', 'No se pudo actualizar');
    }
  }, [markAllRead]);

  // Stage 5 · pagos del miembro: plan vigente + historial.
  const openPayments = useCallback(async () => {
    setPayVisible(true);
    setPayLoading(true);
    setPayError(null);

    const result = await fetchMyPayments(user?.id ?? '');
    setMyPayments(result.payments);
    setCurrentPlan(result.currentPlan);
    setPayError(result.error ?? null);
    setPayLoading(false);
  }, [user?.id]);

  const roleLabels: Record<string, string> = {
    admin: 'Administrador',
    coach: 'Entrenador',
    professional: 'Profesional',
    member: 'Miembro',
  };

  // Get avatar from user metadata if available
  const metadata = (user?.user_metadata ?? {}) as { avatar_url?: string; picture?: string };
  const avatarUrl = metadata.avatar_url || metadata.picture;

  const displayName = profile?.full_name || user?.email?.split('@')[0] || 'Usuario';

  return (
    <View style={styles.container}>
      <Header title="Perfil" />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Avatar & Info */}
        <View style={styles.profileHeader}>
          <View style={styles.avatar}>
            {avatarUrl ? (
              <Image source={{ uri: avatarUrl }} style={styles.avatarImage} />
            ) : (
              <Text style={styles.avatarText}>{displayName.charAt(0).toUpperCase() || '?'}</Text>
            )}
          </View>
          <Text style={styles.name}>{displayName}</Text>
          <Text style={styles.email}>{user?.email ?? ''}</Text>
        </View>

        {professionalDetails}

        {/* Membership Info */}
        {membership && (
          <Card style={styles.infoCard}>
            <Text style={styles.cardTitle}>Tu membresía</Text>
            <InfoRow label="Rol" value={roleLabels[membership.role] ?? membership.role} />
            <InfoRow label="Gimnasio" value={membership.organization_name ?? 'Sin nombre'} />
          </Card>
        )}

        {/* Account Actions */}
        <Card style={styles.actionsCard}>
          <Text style={styles.cardTitle}>Cuenta</Text>
          <ActionRow icon="person" label="Editar perfil" onPress={openEdit} />
          <ActionRow icon="notifications" label="Notificaciones" onPress={openNotifications} />
          {membership?.role !== 'professional' && (
            <ActionRow icon="card" label="Mis pagos y plan" onPress={openPayments} />
          )}
          <ActionRow
            icon="help-circle"
            label="Ayuda y soporte"
            onPress={() =>
              notify(
                'Si tienes problemas con tu cuenta, tus reservas o tus citas, contacta con tu gimnasio: el equipo del centro puede gestionar tu membresía y tus clases.',
                'Ayuda y soporte'
              )
            }
          />
          <ActionRow
            icon="information-circle"
            label="Acerca de NexoFit"
            onPress={() =>
              notify(
                'NexoFit es la app para reservar clases, gestionar tus citas, seguir tu progreso y consultar tus reservas en tu gimnasio.',
                'Acerca de NexoFit'
              )
            }
          />
        </Card>

        {/* Sign Out */}
        <Button title="Cerrar sesión" variant="danger" fullWidth onPress={handleSignOut} />

        {/* Baja del gimnasio: separada de las opciones de cuenta para no tocarla
            por accidente; la confirmación explica qué pasa con los datos. */}
        {membership?.role === 'member' && (
          <View style={styles.leaveSection}>
            <Text style={styles.leaveTitle}>Membresía</Text>
            <Text style={styles.leaveText}>
              Si ya no entrenas en {membership.organization_name ?? 'este gimnasio'}, puedes darte
              de baja. Tu cuenta de NexoFit se conserva.
            </Text>
            <Button
              title={leavingGym ? 'Saliendo…' : 'Salir del gimnasio'}
              variant="ghost"
              fullWidth
              loading={leavingGym}
              disabled={leavingGym}
              onPress={confirmLeaveGym}
            />
          </View>
        )}
      </ScrollView>

      {/* Edit profile modal */}
      <Modal
        visible={editVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setEditVisible(false)}
      >
        <View style={styles.modalOverlay}>
          {/* ScrollView con acciones dentro: con el teclado abierto en iOS los
              botones siguen alcanzables (sin KeyboardAvoidingView). */}
          <ScrollView
            style={styles.modalScroll}
            contentContainerStyle={styles.modalScrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>Editar perfil</Text>
              <Text style={styles.modalLabel}>Nombre completo</Text>
              <TextInput
                style={styles.modalInput}
                value={nameInput}
                onChangeText={setNameInput}
                placeholder="Tu nombre"
                placeholderTextColor={colors.textPlaceholder}
                autoCapitalize="words"
                maxLength={60}
              />
              <View style={styles.modalActions}>
                <Button
                  title="Cancelar"
                  variant="ghost"
                  style={styles.modalButton}
                  onPress={() => setEditVisible(false)}
                />
                <Button
                  title="Guardar"
                  variant="primary"
                  style={styles.modalButton}
                  loading={saving}
                  onPress={handleSaveProfile}
                />
              </View>
            </View>
          </ScrollView>
        </View>
      </Modal>

      {/* Notifications modal */}
      <Modal
        visible={notifVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setNotifVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Notificaciones</Text>

            {notifLoading ? (
              <ActivityIndicator
                size="large"
                color={colors.turquesa}
                style={{ marginVertical: 24 }}
              />
            ) : notifError ? (
              <Text style={styles.notifError}>{notifError}</Text>
            ) : notifications.length === 0 ? (
              <Text style={styles.notifEmpty}>No tienes notificaciones.</Text>
            ) : (
              <ScrollView style={styles.notifList} showsVerticalScrollIndicator={false}>
                {notifications.map((n) => (
                  <View key={n.id} style={styles.notifItem}>
                    <View style={styles.notifTitleRow}>
                      {!n.read && <View style={styles.notifDot} />}
                      <Text style={[styles.notifTitle, n.read && styles.notifTitleRead]}>
                        {n.title}
                      </Text>
                    </View>
                    <Text style={styles.notifBody}>{n.body}</Text>
                    <Text style={styles.notifDate}>
                      {new Date(n.created_at).toLocaleDateString('es-ES', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </Text>
                  </View>
                ))}
              </ScrollView>
            )}

            {unreadNotifications > 0 && (
              <Button
                title="Marcar todas como leídas"
                loading={markingRead}
                style={styles.modalButton}
                onPress={() => void handleMarkAllRead()}
              />
            )}

            <Button
              title="Cerrar"
              variant="ghost"
              style={styles.modalButton}
              onPress={() => setNotifVisible(false)}
            />
          </View>
        </View>
      </Modal>

      {/* Payments modal (Stage 5): plan vigente + historial de cobros */}
      <Modal
        visible={payVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setPayVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Mis pagos y plan</Text>

            {payLoading ? (
              <ActivityIndicator
                size="large"
                color={colors.turquesa}
                style={{ marginVertical: 24 }}
              />
            ) : payError ? (
              <Text style={styles.notifError}>{payError}</Text>
            ) : (
              <>
                {currentPlan ? (
                  <View style={styles.planBox}>
                    <Text style={styles.planBoxLabel}>Plan vigente</Text>
                    <Text style={styles.planBoxName}>{currentPlan.planName}</Text>
                    <Text style={styles.planBoxMeta}>
                      Válido hasta el {formatShortDate(currentPlan.validUntil)}
                    </Text>
                  </View>
                ) : (
                  <Text style={styles.notifEmpty}>
                    Aún no tienes un plan activo. Consulta las membresías disponibles en tu
                    gimnasio.
                  </Text>
                )}

                {myPayments.length > 0 && (
                  <ScrollView style={styles.notifList} showsVerticalScrollIndicator={false}>
                    {myPayments.map((p) => (
                      <View key={p.id} style={styles.notifItem}>
                        <Text style={styles.notifTitle}>
                          {formatMoney(p.amountCents, p.currency)}
                        </Text>
                        <Text style={styles.notifBody}>
                          {[p.planName ?? 'Pago sin plan', METHOD_LABELS[p.method as PaymentMethod]]
                            .filter(Boolean)
                            .join(' · ')}
                        </Text>
                        <Text style={styles.notifDate}>
                          {formatShortDate(p.paidAt)}
                          {p.status !== 'paid' ? ` · ${STATUS_LABELS[p.status] ?? p.status}` : ''}
                        </Text>
                      </View>
                    ))}
                  </ScrollView>
                )}
              </>
            )}

            <Button
              title="Cerrar"
              variant="ghost"
              style={styles.modalButton}
              onPress={() => setPayVisible(false)}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={rowStyles.row}>
      <Text style={rowStyles.label}>{label}</Text>
      <Text style={rowStyles.value}>{value}</Text>
    </View>
  );
}

function ActionRow({
  icon,
  label,
  onPress,
  destructive,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  destructive?: boolean;
}) {
  const tint = destructive ? colors.textError : colors.azulNexo;
  return (
    <TouchableOpacity
      accessibilityRole="button"
      style={rowStyles.actionRow}
      onPress={onPress}
      activeOpacity={0.7}
      accessibilityLabel={label}
    >
      <Ionicons name={icon} size={20} color={tint} />
      <Text style={[rowStyles.actionLabel, destructive && { color: colors.textError }]}>
        {label}
      </Text>
      <Text style={rowStyles.chevron}>›</Text>
    </TouchableOpacity>
  );
}

const rowStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  label: { fontFamily: fonts.uiRegular, fontSize: 14, color: colors.textSecondary },
  value: {
    fontFamily: fonts.uiSemiBold,
    fontSize: 14,
    color: colors.azulNexo,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    gap: 12,
  },
  actionLabel: {
    fontFamily: fonts.uiRegular,
    fontSize: 16,
    color: colors.azulNexo,
    flex: 1,
  },
  chevron: { fontFamily: fonts.uiRegular, fontSize: 20, color: colors.textSecondary },
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.crema },
  content: { padding: 16, gap: 16, paddingBottom: 40 },
  leaveSection: {
    marginTop: 8,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    gap: 8,
  },
  leaveTitle: { fontFamily: fonts.uiSemiBold, fontSize: 14, color: colors.azulNexo },
  leaveText: { fontFamily: fonts.uiRegular, fontSize: 13, color: colors.textSecondary },
  profileHeader: {
    alignItems: 'center',
    gap: 12,
    paddingVertical: 24,
  },
  avatar: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: colors.textAccent,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarImage: {
    width: 88,
    height: 88,
    borderRadius: 44,
  },
  avatarText: {
    fontFamily: fonts.brand,
    fontSize: 32,
    color: colors.crema,
  },
  name: {
    fontFamily: fonts.brand,
    fontSize: 24,
    color: colors.azulNexo,
  },
  email: {
    fontFamily: fonts.uiRegular,
    fontSize: 14,
    color: colors.textSecondary,
  },
  infoCard: { gap: 8 },
  actionsCard: { gap: 8 },
  cardTitle: {
    fontFamily: fonts.uiSemiBold,
    fontSize: 14,
    color: colors.azulNexo,
    marginBottom: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    padding: 24,
  },
  modalScroll: {
    flex: 1,
  },
  modalScrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  modalCard: {
    backgroundColor: colors.crema,
    borderRadius: 16,
    padding: 20,
    gap: 12,
  },
  modalTitle: {
    fontFamily: fonts.uiSemiBold,
    fontSize: 18,
    color: colors.azulNexo,
  },
  modalLabel: {
    fontFamily: fonts.uiRegular,
    fontSize: 13,
    color: colors.textSecondary,
  },
  modalInput: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontFamily: fonts.uiRegular,
    fontSize: 16,
    color: colors.azulNexo,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 4,
  },
  modalButton: {
    flex: 1,
  },
  notifList: {
    maxHeight: 300,
  },
  notifItem: {
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    paddingVertical: 10,
    gap: 4,
  },
  notifTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  notifDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.turquesa,
  },
  notifTitle: {
    fontFamily: fonts.uiSemiBold,
    fontSize: 14,
    color: colors.azulNexo,
  },
  notifTitleRead: {
    color: colors.textSecondary,
  },
  notifBody: {
    fontFamily: fonts.uiRegular,
    fontSize: 13,
    color: '#374151',
  },
  notifDate: {
    fontFamily: fonts.uiRegular,
    fontSize: 11,
    color: colors.textSecondary,
  },
  notifEmpty: {
    fontFamily: fonts.uiRegular,
    fontSize: 14,
    color: colors.textSecondary,
    paddingVertical: 16,
    textAlign: 'center',
  },
  notifError: {
    fontFamily: fonts.uiRegular,
    fontSize: 14,
    color: colors.textError,
    paddingVertical: 16,
    textAlign: 'center',
  },
  planBox: {
    backgroundColor: '#E8F7F5',
    borderRadius: 12,
    padding: 14,
    gap: 4,
  },
  planBoxLabel: {
    fontFamily: fonts.uiRegular,
    fontSize: 12,
    color: colors.textSecondary,
  },
  planBoxName: {
    fontFamily: fonts.uiSemiBold,
    fontSize: 16,
    color: colors.azulNexo,
  },
  planBoxMeta: {
    fontFamily: fonts.uiRegular,
    fontSize: 13,
    color: '#374151',
  },
});
