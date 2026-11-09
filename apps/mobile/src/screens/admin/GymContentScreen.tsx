import { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fonts, shouldShowSkeleton, useHasLoaded } from '@nexofit/core';
import { useAuth } from '../../contexts/AuthContext';
import { Header, Button, Card, Input, CardListSkeleton } from '../../components/ui';
import { confirmAction, notify } from '../../utils/alerts';
import { useGymContent, type ClassTypeItem, type SpaceItem } from '../../hooks/useAdmin';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { MainStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<MainStackParamList, 'GymContent'>;

// Paleta de tipos de clase (mismos tonos de la app).
const CLASS_COLORS = [
  '#0B9B91', // turquesa
  '#3B82F6', // azul
  '#8B5CF6', // violeta
  colors.warning, // ámbar
  colors.danger, // rojo
  colors.success, // verde
  '#EC4899', // rosa
  '#6B7280', // gris
];

export function GymContentScreen({ route, navigation }: Props) {
  const { membership } = useAuth();
  const orgId = membership?.organization_id ?? '';
  const isAdmin = membership?.role === 'admin';
  const insets = useSafeAreaInsets();

  // Accesos directos (Dashboard → Acciones rápidas) abren su formulario.
  const initialForm = route.params?.form;

  const {
    classTypes,
    venues,
    spaces,
    loading,
    error,
    createClassType,
    deleteClassType,
    createVenue,
    createSpace,
    deleteSpace,
  } = useGymContent(orgId);
  const hasLoaded = useHasLoaded(loading);

  // Tipo de clase.
  const [ctOpen, setCtOpen] = useState(initialForm === 'classType');
  const [ctName, setCtName] = useState('');
  const [ctColor, setCtColor] = useState(CLASS_COLORS[0]);
  const [ctDesc, setCtDesc] = useState('');
  const [savingCt, setSavingCt] = useState(false);

  // Sede.
  const [venueOpen, setVenueOpen] = useState(false);
  const [venueName, setVenueName] = useState('');
  const [venueAddr, setVenueAddr] = useState('');
  const [savingVenue, setSavingVenue] = useState(false);

  // Espacio.
  const [spaceOpen, setSpaceOpen] = useState(false);
  const [spaceVenueId, setSpaceVenueId] = useState<string | null>(null);
  const [spaceName, setSpaceName] = useState('');
  const [spaceCapacity, setSpaceCapacity] = useState('');
  const [savingSpace, setSavingSpace] = useState(false);

  // «Crear sedes/espacios»: si aún no hay sede, abrir el formulario de
  // sede; si ya existe, directo al de espacio.
  const [pendingSpacesForm, setPendingSpacesForm] = useState(initialForm === 'spaces');

  useEffect(() => {
    if (!pendingSpacesForm || loading) return;
    setPendingSpacesForm(false);
    if (venues.length === 0) setVenueOpen(true);
    else setSpaceOpen(true);
  }, [pendingSpacesForm, loading, venues.length]);

  // Si aún no se eligió sede, se usa la primera (aparece sola tras crearla).
  const effectiveVenueId = spaceVenueId ?? venues[0]?.id ?? null;

  const resetCtForm = () => {
    setCtOpen(false);
    setCtName('');
    setCtColor(CLASS_COLORS[0]);
    setCtDesc('');
  };

  const handleCreateClassType = async () => {
    const name = ctName.trim();
    if (name.length < 2) {
      notify('Escribe un nombre de al menos 2 caracteres.', 'Faltan datos');
      return;
    }

    setSavingCt(true);
    const result = await createClassType({ name, color: ctColor, description: ctDesc });
    setSavingCt(false);

    if (!result.success) {
      notify(result.error ?? 'No se pudo crear el tipo de clase.', 'Error');
      return;
    }
    resetCtForm();
    notify(`"${name}" ya está disponible en Nueva clase.`, 'Tipo creado');
  };

  const handleDeleteClassType = (ct: ClassTypeItem) => {
    confirmAction({
      title: 'Eliminar tipo',
      message: `¿Eliminar "${ct.name}"?`,
      confirmLabel: 'Sí, eliminar',
      cancelLabel: 'No',
      onConfirm: async () => {
        const result = await deleteClassType(ct.id);
        if (!result.success) {
          notify(result.error ?? 'Inténtalo de nuevo.', 'No se pudo eliminar');
        }
      },
    });
  };

  const resetVenueForm = () => {
    setVenueOpen(false);
    setVenueName('');
    setVenueAddr('');
  };

  const handleCreateVenue = async () => {
    const name = venueName.trim();
    if (name.length < 2) {
      notify('Escribe un nombre de sede de al menos 2 caracteres.', 'Faltan datos');
      return;
    }

    setSavingVenue(true);
    const result = await createVenue({ name, address: venueAddr });
    setSavingVenue(false);

    if (!result.success) {
      notify(result.error ?? 'No se pudo crear la sede.', 'Error');
      return;
    }
    resetVenueForm();
    setSpaceVenueId(null); // que el selector de espacio tome la sede nueva
    notify(`La sede "${name}" ya está disponible.`, 'Sede creada');
  };

  const resetSpaceForm = () => {
    setSpaceOpen(false);
    setSpaceVenueId(null);
    setSpaceName('');
    setSpaceCapacity('');
  };

  const handleCreateSpace = async () => {
    if (!effectiveVenueId) {
      notify('Crea primero una sede con «＋ Sede».', 'Faltan datos');
      return;
    }
    const name = spaceName.trim();
    if (name.length < 2) {
      notify('Escribe un nombre de espacio de al menos 2 caracteres.', 'Faltan datos');
      return;
    }
    const capacity = Number(spaceCapacity);
    if (!Number.isInteger(capacity) || capacity <= 0) {
      notify('El cupo debe ser un número entero positivo.', 'Error');
      return;
    }

    setSavingSpace(true);
    const result = await createSpace({ venueId: effectiveVenueId, name, capacity });
    setSavingSpace(false);

    if (!result.success) {
      notify(result.error ?? 'No se pudo crear el espacio.', 'Error');
      return;
    }
    resetSpaceForm();
    notify(`"${name}" (cupo ${capacity}) ya está disponible.`, 'Espacio creado');
  };

  const handleDeleteSpace = (space: SpaceItem) => {
    confirmAction({
      title: 'Eliminar espacio',
      message: `¿Eliminar "${space.name}"?`,
      confirmLabel: 'Sí, eliminar',
      cancelLabel: 'No',
      onConfirm: async () => {
        const result = await deleteSpace(space.id);
        if (!result.success) {
          notify(result.error ?? 'Inténtalo de nuevo.', 'No se pudo eliminar');
        }
      },
    });
  };

  if (!orgId) {
    return (
      <View style={styles.container}>
        <Header
          title="Espacios y clases"
          leftAction={{ label: 'Volver', onPress: () => navigation.goBack() }}
        />
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>Sin organización</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Header
        title="Espacios y clases"
        subtitle="Tipos de clase, sedes y espacios"
        leftAction={{ label: 'Volver', onPress: () => navigation.goBack() }}
      />

      {shouldShowSkeleton(loading, hasLoaded) ? (
        <CardListSkeleton label="Cargando contenido" count={3} />
      ) : (
        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: 40 + insets.bottom }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {error && <Text style={styles.error}>{error}</Text>}

          {/* Tipos de clase (admin + coach) */}
          <Card style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Tipos de clase</Text>

            {ctOpen ? (
              <>
                <Input
                  label="Nombre"
                  value={ctName}
                  onChangeText={setCtName}
                  placeholder="Ej. CrossFit WOD"
                  maxLength={40}
                />
                <Text style={styles.fieldLabel}>Color</Text>
                <View style={styles.colorRow}>
                  {CLASS_COLORS.map((c) => (
                    <TouchableOpacity
                      accessibilityRole="button"
                      key={c}
                      style={[
                        styles.colorDot,
                        { backgroundColor: c },
                        ctColor === c && styles.colorDotActive,
                      ]}
                      onPress={() => setCtColor(c)}
                    />
                  ))}
                </View>
                <Input
                  label="Descripción (opcional)"
                  value={ctDesc}
                  onChangeText={setCtDesc}
                  placeholder="Ej. WOD funcional"
                  maxLength={120}
                />
                <Button
                  title="Crear tipo"
                  fullWidth
                  loading={savingCt}
                  onPress={handleCreateClassType}
                />
                <Button title="Cancelar" variant="ghost" fullWidth onPress={resetCtForm} />
              </>
            ) : (
              <Button title="＋ Nuevo tipo de clase" fullWidth onPress={() => setCtOpen(true)} />
            )}

            {classTypes.length > 0 ? (
              <View style={styles.list}>
                {classTypes.map((ct) => (
                  <View key={ct.id} style={styles.row}>
                    <View style={[styles.colorDot, { backgroundColor: ct.color }]} />
                    <View style={styles.rowInfo}>
                      <Text style={styles.rowTitle}>{ct.name}</Text>
                      {ct.description && <Text style={styles.rowMeta}>{ct.description}</Text>}
                    </View>
                    <TouchableOpacity onPress={() => handleDeleteClassType(ct)}>
                      <Text style={styles.deleteText}>Eliminar</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            ) : (
              !ctOpen && (
                <Text style={styles.hint}>
                  Aún no hay tipos de clase. Crea el primero para poder programar clases.
                </Text>
              )
            )}
          </Card>

          {/* Sedes y espacios (solo admin: la RLS de venues/spaces es admin) */}
          {isAdmin && (
            <Card style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>Sedes y espacios</Text>

              <View style={styles.toggleRow}>
                <Button
                  title="＋ Sede"
                  variant="ghost"
                  style={styles.halfButton}
                  onPress={() => {
                    resetSpaceForm();
                    setVenueOpen(true);
                  }}
                />
                <Button
                  title="＋ Espacio"
                  variant="secondary"
                  style={styles.halfButton}
                  onPress={() => {
                    resetVenueForm();
                    setSpaceOpen(true);
                  }}
                />
              </View>

              {venueOpen && (
                <>
                  <Input
                    label="Nombre de la sede"
                    value={venueName}
                    onChangeText={setVenueName}
                    placeholder="Ej. Sede Norte"
                    maxLength={60}
                  />
                  <Input
                    label="Dirección (opcional)"
                    value={venueAddr}
                    onChangeText={setVenueAddr}
                    placeholder="Ej. Av. 1, San José"
                    maxLength={120}
                  />
                  <Button
                    title="Crear sede"
                    fullWidth
                    loading={savingVenue}
                    onPress={handleCreateVenue}
                  />
                  <Button title="Cancelar" variant="ghost" fullWidth onPress={resetVenueForm} />
                </>
              )}

              {spaceOpen && (
                <>
                  {venues.length === 0 ? (
                    <Text style={styles.hint}>
                      Aún no hay sedes. Crea la primera con «＋ Sede» para poder añadir espacios.
                    </Text>
                  ) : (
                    <>
                      <Text style={styles.fieldLabel}>Sede</Text>
                      <View style={styles.chips}>
                        {venues.map((v) => (
                          <TouchableOpacity
                            accessibilityRole="button"
                            key={v.id}
                            style={[styles.chip, effectiveVenueId === v.id && styles.chipActive]}
                            onPress={() => setSpaceVenueId(v.id)}
                          >
                            <Text
                              style={[
                                styles.chipText,
                                effectiveVenueId === v.id && styles.chipTextActive,
                              ]}
                            >
                              {v.name}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </>
                  )}
                  <Input
                    label="Nombre del espacio"
                    value={spaceName}
                    onChangeText={setSpaceName}
                    placeholder="Ej. Floor A"
                    maxLength={60}
                  />
                  <Input
                    label="Cupo"
                    value={spaceCapacity}
                    onChangeText={setSpaceCapacity}
                    placeholder="20"
                    keyboardType="number-pad"
                    maxLength={5}
                  />
                  <Button
                    title="Crear espacio"
                    fullWidth
                    loading={savingSpace}
                    disabled={!effectiveVenueId}
                    onPress={handleCreateSpace}
                  />
                  <Button title="Cancelar" variant="ghost" fullWidth onPress={resetSpaceForm} />
                </>
              )}

              {venues.length === 0 && !venueOpen && !spaceOpen ? (
                <Text style={styles.hint}>
                  Tu gimnasio aún no tiene sedes. Crea una («＋ Sede») y después sus espacios (piso,
                  área de entrenamiento…) para poder programar clases.
                </Text>
              ) : (
                venues.map((v) => {
                  const venueSpaces = spaces.filter((s) => s.venueId === v.id);
                  return (
                    <View key={v.id} style={styles.venueBlock}>
                      <Text style={styles.venueTitle}>
                        {v.name}
                        {v.address ? ` · ${v.address}` : ''}
                      </Text>
                      {venueSpaces.length === 0 ? (
                        <Text style={styles.hint}>Sin espacios todavía.</Text>
                      ) : (
                        venueSpaces.map((s) => (
                          <View key={s.id} style={styles.row}>
                            <View style={styles.rowInfo}>
                              <Text style={styles.rowTitle}>{s.name}</Text>
                              <Text style={styles.rowMeta}>{s.capacity} cupos</Text>
                            </View>
                            <TouchableOpacity onPress={() => handleDeleteSpace(s)}>
                              <Text style={styles.deleteText}>Eliminar</Text>
                            </TouchableOpacity>
                          </View>
                        ))
                      )}
                    </View>
                  );
                })
              )}
            </Card>
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.crema },
  content: { padding: 16, gap: 16 },
  sectionCard: { gap: 12 },
  sectionTitle: {
    fontFamily: fonts.uiSemiBold,
    fontSize: 16,
    color: colors.azulNexo,
  },
  fieldLabel: {
    fontFamily: fonts.uiSemiBold,
    fontSize: 14,
    color: colors.azulNexo,
  },
  toggleRow: { flexDirection: 'row', gap: 12 },
  halfButton: { flex: 1 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1.5,
    backgroundColor: colors.white,
    borderColor: colors.borderStrong,
  },
  chipActive: { backgroundColor: colors.azulNexo, borderColor: colors.azulNexo },
  chipText: {
    fontFamily: fonts.uiSemiBold,
    fontSize: 13,
    color: colors.azulNexo,
  },
  chipTextActive: { color: colors.crema },
  colorRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  colorDot: {
    width: 18,
    height: 18,
    borderRadius: 9,
  },
  colorDotActive: {
    borderWidth: 3,
    borderColor: colors.azulNexo,
  },
  list: { gap: 0 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceSubtle,
    gap: 10,
  },
  rowInfo: { flex: 1, gap: 2 },
  rowTitle: {
    fontFamily: fonts.uiSemiBold,
    fontSize: 15,
    color: colors.azulNexo,
  },
  rowMeta: {
    fontFamily: fonts.uiRegular,
    fontSize: 12,
    color: colors.textSecondary,
  },
  deleteText: {
    fontFamily: fonts.uiSemiBold,
    fontSize: 13,
    color: colors.textError,
  },
  venueBlock: { gap: 6 },
  venueTitle: {
    fontFamily: fonts.uiSemiBold,
    fontSize: 14,
    color: colors.azulNexo,
    marginTop: 4,
  },
  hint: {
    fontFamily: fonts.uiRegular,
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 18,
  },
  error: {
    fontFamily: fonts.uiRegular,
    fontSize: 13,
    color: colors.textError,
  },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { fontFamily: fonts.uiSemiBold, fontSize: 18, color: colors.azulNexo },
});
