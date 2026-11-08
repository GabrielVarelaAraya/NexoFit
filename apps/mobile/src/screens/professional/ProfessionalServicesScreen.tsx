import { useState } from 'react';
import { Text } from 'react-native';
import { getSupabase } from '@nexofit/core';
import { useAuth } from '../../contexts/AuthContext';
import { Button, Card, Input } from '../../components/ui';
import { useProfessional } from '../../hooks/useProfessional';
import { caughtError } from '../../utils/errors';
import { confirmAction, notify } from '../../utils/alerts';
import {
  addProfessionalService,
  deleteProfessionalService,
  type Service,
} from '../../utils/professional';
import { ProfessionalLayout, professionalStyles as styles } from './ProfessionalLayout';

export function ProfessionalServicesScreen() {
  const { membership } = useAuth();
  const { workspace, loading, error, refresh } = useProfessional();
  const [name, setName] = useState('');
  const [minutes, setMinutes] = useState('45');
  const [pending, setPending] = useState(false);

  const add = async () => {
    if (!workspace || pending) return;
    setPending(true);
    try {
      await addProfessionalService(
        getSupabase(),
        workspace.professional.id,
        membership?.organization_id ?? '',
        name,
        Number(minutes)
      );
      setName('');
      setMinutes('45');
      await refresh();
    } catch (cause) {
      notify(caughtError(cause, 'Inténtalo de nuevo.'), 'No se pudo guardar');
    } finally {
      setPending(false);
    }
  };

  const remove = async (service: Service) => {
    if (!workspace || pending) return;
    setPending(true);
    try {
      await deleteProfessionalService(getSupabase(), workspace.professional.id, service.id);
      await refresh();
    } catch (cause) {
      notify(caughtError(cause, 'Inténtalo de nuevo.'), 'No se pudo eliminar');
    } finally {
      setPending(false);
    }
  };

  const confirmRemove = (service: Service) =>
    confirmAction({
      title: 'Eliminar servicio',
      message: 'No se puede eliminar un servicio que ya tiene citas registradas.',
      confirmLabel: 'Eliminar',
      cancelLabel: 'Volver',
      onConfirm: () => void remove(service),
    });

  return (
    <ProfessionalLayout title="Mis servicios" loading={loading} error={error} refresh={refresh}>
      <Text style={styles.text}>
        Los miembros reservan tus citas según estos servicios y su duración.
      </Text>
      <Card style={styles.form}>
        <Text style={styles.title}>Nuevo servicio</Text>
        <Input
          label="Nombre"
          hint="Ej.: Nutrición, Fisioterapia"
          value={name}
          onChangeText={setName}
          editable={!pending}
        />
        <Input
          label="Duración (minutos)"
          hint="Entre 1 y 1440 minutos"
          value={minutes}
          onChangeText={setMinutes}
          keyboardType="numeric"
          maxLength={4}
          editable={!pending}
        />
        <Button
          title="Agregar servicio"
          loading={pending}
          disabled={pending}
          onPress={() => void add()}
        />
      </Card>
      <Text style={styles.title}>Servicios guardados</Text>
      {!workspace?.services.length && (
        <Text style={styles.text}>Todavía no has registrado servicios.</Text>
      )}
      {workspace?.services.map((service) => (
        <Card key={service.id} style={styles.card}>
          <Text style={styles.title}>{service.name}</Text>
          <Text style={styles.text}>{service.duration_minutes} min</Text>
          <Button
            title="Eliminar servicio"
            variant="ghost"
            disabled={pending}
            onPress={() => confirmRemove(service)}
          />
        </Card>
      ))}
    </ProfessionalLayout>
  );
}
