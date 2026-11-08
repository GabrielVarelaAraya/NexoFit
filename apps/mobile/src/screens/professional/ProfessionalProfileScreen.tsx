import { useEffect, useState } from 'react';
import { ActivityIndicator, Text } from 'react-native';
import { getSupabase, colors } from '@nexofit/core';
import { Button, Card, Input } from '../../components/ui';
import { ProfileScreen } from '../client/ProfileScreen';
import { useAuth } from '../../contexts/AuthContext';
import { useProfessional } from '../../hooks/useProfessional';
import { caughtError } from '../../utils/errors';
import { notify } from '../../utils/alerts';
import { saveProfessionalProfile } from '../../utils/professional';
import { professionalStyles as styles } from './ProfessionalLayout';

function ProfessionalDetails() {
  const { membership } = useAuth();
  const { workspace, loading, error, refresh } = useProfessional(false);
  const professional = workspace?.professional;
  const [specialization, setSpecialization] = useState('');
  const [bio, setBio] = useState('');
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    setSpecialization(professional?.specialization ?? '');
    setBio(professional?.bio ?? '');
  }, [professional?.id, professional?.specialization, professional?.bio]);
  const save = async () => {
    if (!professional || !membership || saving) return;
    setSaving(true);
    try {
      await saveProfessionalProfile(
        getSupabase(),
        membership.id,
        professional.id,
        specialization,
        bio
      );
      await refresh();
      notify('Tu información profesional se guardó.', 'Ficha actualizada');
    } catch (cause) {
      notify(caughtError(cause, 'Inténtalo de nuevo.'), 'No se pudo guardar');
    } finally {
      setSaving(false);
    }
  };
  return (
    <Card style={styles.form}>
      <Text style={styles.title}>Ficha profesional</Text>
      {loading ? (
        <ActivityIndicator color={colors.textAccent} />
      ) : error ? (
        <>
          <Text style={styles.error}>{error}</Text>
          <Button title="Reintentar" onPress={() => void refresh()} />
        </>
      ) : (
        <>
          <Input
            label="Especialidad"
            value={specialization}
            onChangeText={setSpecialization}
            placeholder="Fisioterapia, nutrición…"
            editable={!saving}
            maxLength={120}
          />
          <Input
            label="Sobre mí"
            value={bio}
            onChangeText={setBio}
            multiline
            numberOfLines={4}
            editable={!saving}
            maxLength={2000}
            style={{ minHeight: 100, textAlignVertical: 'top' }}
          />
          <Button
            title="Guardar ficha"
            loading={saving}
            disabled={saving || !specialization.trim()}
            onPress={() => void save()}
          />
        </>
      )}
    </Card>
  );
}

export function ProfessionalProfileScreen() {
  return <ProfileScreen professionalDetails={<ProfessionalDetails />} />;
}
