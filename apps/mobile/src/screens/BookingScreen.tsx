import { Text } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useRequest } from '../api/hooks';
import type { RootStackParams } from '../navigation/types';
import { Body, Button, Card, ErrorBox, Loading, Screen, Title, money } from '../ui/components';

type Props = NativeStackScreenProps<RootStackParams, 'Booking'>;

export function BookingScreen({ route, navigation }: Props) {
  const { requestId } = route.params;
  const req = useRequest(requestId);

  if (req.isPending)
    return (
      <Screen>
        <Loading />
      </Screen>
    );
  if (req.isError)
    return (
      <Screen>
        <ErrorBox error={req.error} onRetry={() => void req.refetch()} />
      </Screen>
    );
  const v = req.data;

  return (
    <Screen>
      <Title>Booking confirmed</Title>
      <Card title="Your technician">
        <Text style={{ fontSize: 20, fontWeight: '700' }}>{v.technician?.name ?? '—'}</Text>
        <Body soft>{v.technician ? `${v.technician.rating.toFixed(1)} ★` : ''}</Body>
      </Card>
      <Card title="Final quote">
        <Text
          style={{ fontSize: 32, fontWeight: '800' }}
          accessibilityLabel={`Final quote ${money(v.quoteMinor)}`}
        >
          {money(v.quoteMinor)}
        </Text>
        <Body soft>Assignment ID</Body>
        <Text selectable style={{ fontFamily: 'monospace' }}>
          {v.technician?.assignmentId ?? '—'}
        </Text>
      </Card>
      <Body>
        The technician has been notified instantly. Share the arrival code when they reach your site.
      </Body>
      <Button label="Track this job" onPress={() => navigation.replace('Job', { requestId })} />
    </Screen>
  );
}
