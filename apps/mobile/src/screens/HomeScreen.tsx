import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RequestView } from '@dispatch/contracts';
import { useActive, useAvailability } from '../api/hooks';
import type { ApiError } from '../api/client';
import { stateUi } from '../lib/state-ui';
import type { RootStackParams } from '../navigation/types';
import { useSession } from '../state/session';
import { Badge, Body, Button, Card, Empty, ErrorBox, Loading, Screen, Title, money } from '../ui/components';

type Props = NativeStackScreenProps<RootStackParams, 'Home'>;

export function HomeScreen(props: Props) {
  const user = useSession((s) => s.user);
  if (user?.role === 'TECHNICIAN') return <TechnicianHome {...props} />;
  if (user?.role === 'REQUESTER') return <RequesterHome {...props} />;
  return <AdminNotice />;
}

function AdminNotice() {
  const signOut = useSession((s) => s.signOut);
  return (
    <Screen>
      <Title>Operations admin</Title>
      <Body>The admin console is a web app. Open it in a browser to monitor and manage jobs.</Body>
      <Button label="Sign out" variant="secondary" onPress={signOut} />
    </Screen>
  );
}

function JobCard({
  job,
  onPress,
  role,
}: {
  job: RequestView;
  onPress: () => void;
  role: 'REQUESTER' | 'TECHNICIAN';
}) {
  const ui = stateUi(role, job.state);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${job.assetId}, ${ui.label}`}
      style={{ minHeight: 44 }}
    >
      <Card>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={{ fontWeight: '700', fontSize: 16 }}>{job.assetId}</Text>
          <Badge tone={ui.tone}>{ui.label}</Badge>
        </View>
        <Body soft>{job.category.replace(/_/g, ' ').toLowerCase()}</Body>
        <Body>{ui.headline}</Body>
        {job.quoteMinor ? <Body soft>Quote {money(job.quoteMinor)}</Body> : null}
      </Card>
    </Pressable>
  );
}

function RequesterHome({ navigation }: Props) {
  const signOut = useSession((s) => s.signOut);
  const active = useActive();
  const go = (job: RequestView) =>
    navigation.navigate(job.state === 'REQUESTED' || job.state === 'MATCHED' ? 'Nearby' : 'Job', {
      requestId: job.id,
    });

  return (
    <Screen onRefresh={() => void active.refetch()} refreshing={active.isRefetching}>
      <Title>Your requests</Title>
      <Button label="New request" onPress={() => navigation.navigate('CreateRequest')} />
      {active.isPending ? (
        <Loading />
      ) : active.isError ? (
        <ErrorBox error={active.error} onRetry={() => void active.refetch()} />
      ) : active.data.length === 0 ? (
        <Empty title="No active requests" hint="Create a request to find a nearby technician." />
      ) : (
        active.data.map((j) => <JobCard key={j.id} job={j} role="REQUESTER" onPress={() => go(j)} />)
      )}
      <Button
        label="History and receipts"
        variant="secondary"
        onPress={() => navigation.navigate('History')}
      />
      <Button label="Sign out" variant="secondary" onPress={signOut} />
    </Screen>
  );
}

function TechnicianHome({ navigation }: Props) {
  const signOut = useSession((s) => s.signOut);
  const active = useActive();
  const availability = useAvailability();
  const [online, setOnline] = useState<boolean | null>(null);
  const hasJob = (active.data?.length ?? 0) > 0;

  const toggle = async (next: 'AVAILABLE' | 'OFFLINE') => {
    try {
      await availability.mutateAsync(next);
      setOnline(next === 'AVAILABLE');
    } catch {
      /* surfaced below via availability.error */
    }
  };

  return (
    <Screen onRefresh={() => void active.refetch()} refreshing={active.isRefetching}>
      <Title>Your jobs</Title>
      <Card title="Availability">
        <Body>
          {hasJob
            ? 'Busy with a job'
            : online === null
              ? 'Set your availability for new requests'
              : online
                ? 'Online: you can be booked'
                : 'Offline'}
        </Body>
        {availability.isError ? <ErrorBox error={availability.error as ApiError} /> : null}
        {!hasJob && (
          <View style={{ gap: 8 }}>
            <Button
              label="Go online"
              busy={availability.isPending}
              disabled={online === true}
              onPress={() => toggle('AVAILABLE')}
            />
            <Button
              label="Go offline"
              variant="secondary"
              busy={availability.isPending}
              disabled={online === false}
              onPress={() => toggle('OFFLINE')}
            />
          </View>
        )}
      </Card>
      {active.isPending ? (
        <Loading />
      ) : active.isError ? (
        <ErrorBox error={active.error} onRetry={() => void active.refetch()} />
      ) : active.data.length === 0 ? (
        <Empty title="No assignment right now" hint="New jobs appear here the moment a customer books you." />
      ) : (
        active.data.map((j) => (
          <JobCard
            key={j.id}
            job={j}
            role="TECHNICIAN"
            onPress={() => navigation.navigate('Job', { requestId: j.id })}
          />
        ))
      )}
      <Button label="Completed jobs" variant="secondary" onPress={() => navigation.navigate('History')} />
      <Button label="Sign out" variant="secondary" onPress={signOut} />
    </Screen>
  );
}
