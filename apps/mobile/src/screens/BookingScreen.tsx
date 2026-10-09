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
        <Body strong>{v.technician?.name ?? '—'}</Body>
        <Body soft>{v.technician ? `${v.technician.rating.toFixed(1)} ★` : ''}</Body>
      </Card>
      <Card title="Final quote">
        <Title>{money(v.quoteMinor)}</Title>
        <Body soft>Assignment ID</Body>
        <Body mono>{v.technician?.assignmentId ?? '—'}</Body>
      </Card>
      <Body>
        The technician has been notified instantly. Share the arrival code when they reach your site.
      </Body>
      <Button
        label="Track this job"
        icon="locate-outline"
        onPress={() => navigation.replace('Job', { requestId })}
      />
    </Screen>
  );
}
