import { Text } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useRequest } from '../api/hooks';
import type { RootStackParams } from '../navigation/types';
import { Body, Card, Empty, ErrorBox, Loading, Screen, Title, money } from '../ui/components';

type Props = NativeStackScreenProps<RootStackParams, 'Receipt'>;

export function ReceiptScreen({ route }: Props) {
  const req = useRequest(route.params.requestId);
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
      <Title>Receipt</Title>
      <Card title={v.assetId}>
        <Body soft>{v.category.replace(/_/g, ' ').toLowerCase()}</Body>
        <Body>Technician: {v.technician?.name ?? '—'}</Body>
        <Body soft>{new Date(v.updatedAt).toLocaleString()}</Body>
      </Card>
      {v.settlement ? (
        <Card title="Payment (mock ledger)">
          <Text style={{ fontSize: 32, fontWeight: '800' }}>{money(v.settlement.amountMinor)}</Text>
          <Body>Status: {v.settlement.status.toLowerCase()}</Body>
          <Body soft>Reference</Body>
          <Text selectable style={{ fontFamily: 'monospace' }}>
            {v.settlement.providerRef}
          </Text>
        </Card>
      ) : (
        <Empty
          title="No payment record"
          hint={v.state === 'CANCELLED' ? 'This request was cancelled.' : 'Not settled yet.'}
        />
      )}
    </Screen>
  );
}
