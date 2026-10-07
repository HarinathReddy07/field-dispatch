import { Pressable, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useHistory, useReorder } from '../api/hooks';
import type { RootStackParams } from '../navigation/types';
import { useSession } from '../state/session';
import { Badge, Body, Button, Card, Empty, ErrorBox, Loading, Screen, Title, money } from '../ui/components';

type Props = NativeStackScreenProps<RootStackParams, 'History'>;

export function HistoryScreen({ navigation }: Props) {
  const role = useSession((s) => s.user?.role);
  const history = useHistory();
  const reorder = useReorder();

  const again = async (id: string) => {
    try {
      const fresh = await reorder.mutateAsync(id); // new request prefilled from the old one (server-side)
      navigation.replace('Nearby', { requestId: fresh.id });
    } catch {
      /* shown below */
    }
  };

  return (
    <Screen onRefresh={() => void history.refetch()} refreshing={history.isRefetching}>
      <Title>History</Title>
      {reorder.isError ? <ErrorBox error={reorder.error} /> : null}
      {history.isPending ? (
        <Loading />
      ) : history.isError ? (
        <ErrorBox error={history.error} onRetry={() => void history.refetch()} />
      ) : history.data.length === 0 ? (
        <Empty title="Nothing here yet" hint="Finished jobs and receipts appear here." />
      ) : (
        history.data.map((j) => (
          <Pressable
            key={j.id}
            accessibilityRole="button"
            accessibilityLabel={`${j.assetId}, ${j.state === 'CANCELLED' ? 'cancelled' : 'completed'}`}
            onPress={() => navigation.navigate('Receipt', { requestId: j.id })}
            style={{ minHeight: 44 }}
          >
            <Card>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={{ fontWeight: '700', fontSize: 16 }}>{j.assetId}</Text>
                <Badge tone={j.state === 'CANCELLED' ? 'bad' : 'good'}>
                  {j.state === 'CANCELLED' ? 'Cancelled' : 'Completed'}
                </Badge>
              </View>
              <Body soft>{new Date(j.updatedAt).toLocaleDateString()}</Body>
              {j.settlement ? <Body>{money(j.settlement.amountMinor)}</Body> : null}
              {role === 'REQUESTER' && (
                <Button
                  label="Order again"
                  variant="secondary"
                  busy={reorder.isPending}
                  onPress={() => again(j.id)}
                />
              )}
            </Card>
          </Pressable>
        ))
      )}
    </Screen>
  );
}
