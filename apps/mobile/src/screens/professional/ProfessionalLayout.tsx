import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { colors, fonts } from '@nexofit/core';
import { Button, Header } from '../../components/ui';

export function ProfessionalLayout({
  title,
  loading,
  error,
  refresh,
  children,
}: {
  title: string;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  children: React.ReactNode;
}) {
  return (
    <View style={professionalStyles.container}>
      <Header title={title} />
      <ScrollView
        contentContainerStyle={professionalStyles.content}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={() => void refresh()}
            tintColor={colors.textAccent}
          />
        }
      >
        {loading ? (
          <ActivityIndicator size="large" color={colors.textAccent} />
        ) : error ? (
          <View style={professionalStyles.form}>
            <Text style={professionalStyles.error}>{error}</Text>
            <Button title="Reintentar" onPress={() => void refresh()} />
          </View>
        ) : (
          children
        )}
      </ScrollView>
    </View>
  );
}

export const professionalStyles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.crema },
  content: { padding: 20, paddingBottom: 36, gap: 16 },
  title: { fontFamily: fonts.uiSemiBold, fontSize: 18, color: colors.azulNexo },
  text: { fontFamily: fonts.uiRegular, fontSize: 14, color: colors.textSecondary, lineHeight: 21 },
  error: { fontFamily: fonts.uiRegular, fontSize: 14, color: colors.textError },
  form: { gap: 14 },
  row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  card: { gap: 10 },
  chip: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  chipActive: { backgroundColor: '#CFFAFE', borderColor: colors.textAccent },
  chipText: { fontFamily: fonts.uiSemiBold, fontSize: 13, color: colors.azulNexo },
});
