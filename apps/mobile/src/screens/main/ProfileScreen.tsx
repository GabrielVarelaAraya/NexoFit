import { View, Text, StyleSheet, Alert } from 'react-native';
import { colors, fonts } from '@nexofit/core';
import { useAuth } from '../../contexts/AuthContext';
import { Header, Button, Card } from '../../components/ui';

export function ProfileScreen() {
  const { user, membership, signOut } = useAuth();

  const handleSignOut = () => {
    Alert.alert('Sign Out', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: signOut },
    ]);
  };

  return (
    <View style={styles.container}>
      <Header title="Profile" />
      <View style={styles.content}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{user?.email?.charAt(0).toUpperCase() ?? '?'}</Text>
        </View>

        <Card>
          <InfoRow label="Email" value={user?.email ?? ''} />
          <InfoRow label="Role" value={membership?.role ?? 'member'} />
          <InfoRow label="Organization" value={membership?.organization_id ? 'Joined' : 'None'} />
        </Card>

        <Button title="Sign Out" variant="danger" fullWidth onPress={handleSignOut} />
      </View>
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

const rowStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  label: { fontFamily: fonts.uiRegular, fontSize: 14, color: '#6B7280' },
  value: {
    fontFamily: fonts.uiSemiBold,
    fontSize: 14,
    color: colors.azulNexo,
  },
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.crema },
  content: { padding: 16, gap: 16 },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.turquesa,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
  },
  avatarText: {
    fontFamily: fonts.brand,
    fontSize: 24,
    color: colors.crema,
  },
});
