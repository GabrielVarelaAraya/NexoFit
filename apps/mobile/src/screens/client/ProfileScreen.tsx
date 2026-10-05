import { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Alert,
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
import { Header, Button, Card } from '../../components/ui';

interface NotificationItem {
  id: string;
  title: string;
  body: string;
  created_at: string;
  read: boolean;
}

export function ProfileScreen() {
  const { user, membership, signOut } = useAuth();
  const { profile, updateProfile } = useSettings(user?.id ?? '');

  const [editVisible, setEditVisible] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const [saving, setSaving] = useState(false);

  const [notifVisible, setNotifVisible] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [notifLoading, setNotifLoading] = useState(false);
  const [notifError, setNotifError] = useState<string | null>(null);

  const [payVisible, setPayVisible] = useState(false);
  const [payLoading, setPayLoading] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);
  const [myPayments, setMyPayments] = useState<MyPayment[]>([]);
  const [currentPlan, setCurrentPlan] = useState<CurrentPlan | null>(null);

  const handleSignOut = () => {
    Alert.alert('Cerrar sesión', '¿Estás seguro?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Cerrar sesión', style: 'destructive', onPress: signOut },
    ]);
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
      Alert.alert('Error', result.error ?? 'No se pudo actualizar el perfil.');
    }
  };

  const openNotifications = useCallback(async () => {
    setNotifVisible(true);
    setNotifLoading(true);
    setNotifError(null);

    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('notifications')
      .select('id, title, body, created_at, read')
      .eq('profile_id', user?.id ?? '')
      .order('created_at', { ascending: false })
      .limit(20);

    setNotifications(error ? [] : (data ?? []));
    setNotifError(error ? 'No se pudieron cargar las notificaciones.' : null);
    setNotifLoading(false);
  }, [user?.id]);

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
              <Text style={styles.avatarText}>{user?.email?.charAt(0).toUpperCase() ?? '?'}</Text>
            )}
          </View>
          <Text style={styles.name}>{displayName}</Text>
          <Text style={styles.email}>{user?.email ?? ''}</Text>
        </View>

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
          <ActionRow icon="card" label="Mis pagos y plan" onPress={openPayments} />
          <ActionRow
            icon="help-circle"
            label="Ayuda y soporte"
            onPress={() =>
              Alert.alert(
                'Ayuda y soporte',
                'Si tienes problemas con tu cuenta, tus reservas o tus citas, contacta con tu gimnasio: el equipo del centro puede gestionar tu membresía y tus clases.'
              )
            }
          />
          <ActionRow
            icon="information-circle"
            label="Acerca de NexoFit"
            onPress={() =>
              Alert.alert(
                'Acerca de NexoFit',
                'NexoFit es la app para reservar clases, gestionar tus citas, seguir tu progreso y consultar tus reservas en tu gimnasio.'
              )
            }
          />
        </Card>

        {/* Sign Out */}
        <Button title="Cerrar sesión" variant="danger" fullWidth onPress={handleSignOut} />
      </ScrollView>

      {/* Edit profile modal */}
      <Modal
        visible={editVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setEditVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Editar perfil</Text>
            <Text style={styles.modalLabel}>Nombre completo</Text>
            <TextInput
              style={styles.modalInput}
              value={nameInput}
              onChangeText={setNameInput}
              placeholder="Tu nombre"
              placeholderTextColor="#9CA3AF"
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
                    <Text style={styles.notifTitle}>{n.title}</Text>
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
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity style={rowStyles.actionRow} onPress={onPress} activeOpacity={0.7}>
      <Ionicons name={icon} size={20} color={colors.azulNexo} />
      <Text style={rowStyles.actionLabel}>{label}</Text>
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
  label: { fontFamily: fonts.uiRegular, fontSize: 14, color: '#6B7280' },
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
  chevron: { fontFamily: fonts.uiRegular, fontSize: 20, color: '#9CA3AF' },
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.crema },
  content: { padding: 16, gap: 16, paddingBottom: 40 },
  profileHeader: {
    alignItems: 'center',
    gap: 12,
    paddingVertical: 24,
  },
  avatar: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: colors.turquesa,
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
    color: '#6B7280',
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
  notifTitle: {
    fontFamily: fonts.uiSemiBold,
    fontSize: 14,
    color: colors.azulNexo,
  },
  notifBody: {
    fontFamily: fonts.uiRegular,
    fontSize: 13,
    color: '#374151',
  },
  notifDate: {
    fontFamily: fonts.uiRegular,
    fontSize: 11,
    color: '#9CA3AF',
  },
  notifEmpty: {
    fontFamily: fonts.uiRegular,
    fontSize: 14,
    color: '#6B7280',
    paddingVertical: 16,
    textAlign: 'center',
  },
  notifError: {
    fontFamily: fonts.uiRegular,
    fontSize: 14,
    color: '#EF4444',
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
    color: '#6B7280',
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
