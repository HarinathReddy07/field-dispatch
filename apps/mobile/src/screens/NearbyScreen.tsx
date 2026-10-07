import { Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useConfirm, useNearby } from '../api/hooks';
import type { RootStackParams } from '../navigation/types';
import { Badge, Body, Button, Card, Empty, ErrorBox, Loading, Screen, Title, money } from '../ui/components';

type Props = NativeStackScreenProps<RootStackParams, 'Nearby'>;

export function NearbyScreen({ route, navigation }: Props) {
  const { requestId } = route.params;
  const nearby = useNearby(requestId);
  const confirm = useConfirm(requestId);

  const choose = async (technicianId: string) => {
    try {
      await confirm.mutateAsync(technicianId); // no optimistic UI: we move on only after the server confirms
      navigation.replace('Booking', { requestId });
    } catch {
      void nearby.refetch(); // the list may be stale (e.g. someone else booked this technician)
    }
  };

  return (
    <Screen onRefresh={() => void nearby.refetch()} refreshing={nearby.isRefetching}>
      <Title>Nearby technicians</Title>
      <Body soft>Closest first. Prices are calculated by the server.</Body>
      {confirm.isError ? <ErrorBox error={confirm.error} /> : null}
      {nearby.isPending ? (
        <Loading label="Searching nearby…" />
      ) : nearby.isError ? (
        <ErrorBox error={nearby.error} onRetry={() => void nearby.refetch()} />
      ) : nearby.data.length === 0 ? (
        <Empty title="No technicians available nearby" hint="Pull down to search again in a moment." />
      ) : (
        nearby.data.map((t) => (
          <Card key={t.technicianId}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={{ fontWeight: '700', fontSize: 16 }}>{t.name}</Text>
              <Badge tone="good">{t.availability.toLowerCase()}</Badge>
            </View>
            <Body soft>
              {t.rating.toFixed(1)} ★ · {t.distanceKm.toFixed(1)} km away
            </Body>
            <Text style={{ fontSize: 20, fontWeight: '700' }}>{money(t.quoteMinor)}</Text>
            <Button
              label={`Book ${t.name}`}
              busy={confirm.isPending && confirm.variables === t.technicianId}
              disabled={confirm.isPending}
              onPress={() => choose(t.technicianId)}
            />
          </Card>
        ))
      )}
    </Screen>
  );
}
