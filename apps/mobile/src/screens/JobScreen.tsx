import { useEffect, useRef, useState } from 'react';
import { Alert, Image, Linking, Text, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ArriveSchema, type Role } from '@dispatch/contracts';
import {
  pingLocation,
  useArrive,
  useCancel,
  useEvidence,
  useIssueOtp,
  useRequest,
  useReview,
  useStart,
  useStop,
  type LiveRequest,
} from '../api/hooks';
import { ApiError } from '../api/client';
import { useUploads } from '../evidence/useUploads';
import { actionsFor, isFinished, stateUi } from '../lib/state-ui';
import { elapsedSeconds, formatClock, secondsUntil } from '../lib/timer';
import { etaMinutes, haversineKm, simulateRoute } from '../lib/route';
import { useNow } from '../lib/useNow';
import type { RootStackParams } from '../navigation/types';
import { useRequestRoom } from '../realtime/live';
import { useSession } from '../state/session';
import { useUi } from '../state/ui';
import { Badge, Body, Button, Card, ErrorBox, Field, Loading, Screen, Title, money } from '../ui/components';
import { theme } from '../ui/theme';

type Props = NativeStackScreenProps<RootStackParams, 'Job'>;

export function JobScreen({ route, navigation }: Props) {
  const { requestId } = route.params;
  const role = useSession((s) => s.user?.role) as Role;
  const req = useRequest(requestId);
  useRequestRoom(requestId);

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
  const job = req.data;
  const ui = stateUi(role, job.state);
  const actions = actionsFor(role, job.state);

  return (
    <Screen onRefresh={() => void req.refetch()} refreshing={req.isRefetching}>
      <Title>{job.assetId}</Title>
      <View style={{ flexDirection: 'row', gap: theme.space.sm, alignItems: 'center' }}>
        <Badge tone={ui.tone}>{ui.label}</Badge>
        {job.technician && role === 'REQUESTER' ? <Body soft>{job.technician.name}</Body> : null}
      </View>
      <Body>{ui.headline}</Body>

      {role === 'TECHNICIAN' && <AssignmentCard job={job} />}
      {role === 'REQUESTER' && job.technician && !isFinished(job.state) && <LiveLocationCard job={job} />}
      <WorkTimer job={job} />

      {actions.includes('FIND_TECHNICIAN') || actions.includes('PICK_TECHNICIAN') ? (
        <Button label="Find technicians" onPress={() => navigation.navigate('Nearby', { requestId })} />
      ) : null}
      {role === 'REQUESTER' && actions.includes('SHOW_OTP') && <RequesterArrival job={job} />}
      {role === 'TECHNICIAN' && actions.includes('ENTER_OTP') && <TechnicianArrival job={job} />}
      {role === 'TECHNICIAN' && actions.includes('START') && <StartPanel job={job} />}
      {role === 'TECHNICIAN' && actions.includes('UPLOAD_EVIDENCE') && <EvidencePanel job={job} />}
      {role === 'REQUESTER' && actions.includes('REVIEW') && <ReviewPanel job={job} />}
      {actions.includes('RECEIPT') && (
        <Button label="View receipt" onPress={() => navigation.navigate('Receipt', { requestId })} />
      )}
      {actions.includes('CANCEL') && role === 'REQUESTER' && (
        <CancelButton job={job} onDone={() => navigation.popToTop()} />
      )}
    </Screen>
  );
}

/** Technician: what to do and where. (Navigation opens the platform maps app.) */
function AssignmentCard({ job }: { job: LiveRequest }) {
  const { lat, lon } = job.location;
  const navigate = () =>
    void Linking.openURL(`geo:${lat},${lon}?q=${lat},${lon}(${encodeURIComponent(job.assetId)})`);
  return (
    <Card title="Assignment">
      <Body>{job.category.replace(/_/g, ' ').toLowerCase()}</Body>
      <Body soft>
        Site: {lat.toFixed(4)}, {lon.toFixed(4)}
      </Body>
      {job.notes ? <Body soft>Notes: {job.notes}</Body> : null}
      <Body>Quote {money(job.quoteMinor)}</Body>
      {!isFinished(job.state) && <Button label="Navigate to site" variant="secondary" onPress={navigate} />}
      {__DEV__ && <SimulateDrive job={job} />}
    </Card>
  );
}

/** Dev-only simulated GPS route playback (BUILD_SPEC: GPS is a simulated coordinate stream). */
function SimulateDrive({ job }: { job: LiveRequest }) {
  const simulating = useUi((s) => s.simulating);
  const setSimulating = useUi((s) => s.setSimulating);
  const timer = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  useEffect(() => () => clearInterval(timer.current), []);

  const run = () => {
    const start = { lat: job.location.lat + 0.03, lon: job.location.lon - 0.03 };
    const points = simulateRoute(start, job.location, 12);
    let i = 0;
    setSimulating(true);
    timer.current = setInterval(() => {
      const p = points[i++];
      if (!p || i > points.length) {
        clearInterval(timer.current);
        setSimulating(false);
        return;
      }
      void pingLocation(p.lat, p.lon).catch(() => undefined);
    }, 2000);
  };
  return (
    <Button
      label={simulating ? 'Driving…' : 'Simulate drive to site (dev)'}
      variant="secondary"
      disabled={simulating}
      onPress={run}
    />
  );
}

/** Requester: live technician position (from the socket) with a rough ETA. */
function LiveLocationCard({ job }: { job: LiveRequest }) {
  const pos = useUi((s) => s.positions[job.id]);
  const km = pos ? haversineKm(pos, job.location) : null;
  return (
    <Card title="Technician location">
      {pos && km !== null ? (
        <>
          <Body>
            {pos.lat.toFixed(4)}, {pos.lon.toFixed(4)} · {km.toFixed(1)} km away
          </Body>
          {job.state === 'CONFIRMED' && <Body soft>Estimated arrival in about {etaMinutes(km)} min</Body>}
        </>
      ) : (
        <Body soft>Waiting for the technician’s position…</Body>
      )}
    </Card>
  );
}

/** Elapsed time while work is in progress, driven by the SERVER start time and server clock offset. */
function WorkTimer({ job }: { job: LiveRequest }) {
  const now = useNow();
  if (job.state !== 'IN_PROGRESS' || !job.startedAt) return null;
  const secs = elapsedSeconds(job.startedAt, job.offsetMs, now);
  return (
    <Card title="Work timer">
      <Text
        style={{ fontSize: theme.font.hero, fontWeight: '800', fontVariant: ['tabular-nums'] }}
        accessibilityLabel={`Elapsed ${formatClock(secs)}`}
      >
        {formatClock(secs)}
      </Text>
    </Card>
  );
}

function RequesterArrival({ job }: { job: LiveRequest }) {
  const issue = useIssueOtp(job.id);
  const now = useNow();
  const exp = issue.data ? Date.parse(issue.data.expiresAt) : null;
  const left = exp ? Math.max(0, Math.ceil((exp - (now + job.offsetMs)) / 1000)) : null;
  return (
    <Card title="Arrival code">
      <Body soft>Show this code to the technician only when they are at your site.</Body>
      {issue.data && left !== 0 ? (
        <>
          <Text
            style={{ fontSize: 44, fontWeight: '800', letterSpacing: 8 }}
            accessibilityLabel={`Arrival code ${issue.data.otp.split('').join(' ')}`}
          >
            {issue.data.otp}
          </Text>
          <Body soft>Expires in {formatClock(left)}</Body>
        </>
      ) : null}
      {issue.isError ? <ErrorBox error={issue.error} /> : null}
      <Button
        label={issue.data && left !== 0 ? 'Get a new code' : 'Show arrival code'}
        busy={issue.isPending}
        onPress={() => issue.mutateAsync().catch(() => undefined)}
      />
    </Card>
  );
}

function TechnicianArrival({ job }: { job: LiveRequest }) {
  const arrive = useArrive(job.id);
  const [otp, setOtp] = useState('');
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    const parsed = ArriveSchema.safeParse({ otp: otp.trim() });
    if (!parsed.success) return setError('Enter the 6-digit code.');
    setError(null);
    try {
      await arrive.mutateAsync(parsed.data.otp);
      setOtp('');
    } catch (e) {
      // Uniform, safe wording: the server never says whether a code was wrong, expired or already used.
      if (e instanceof ApiError && e.code === 'OTP_LOCKED')
        setError('Too many attempts. Wait a few minutes, then try again.');
      else if (e instanceof ApiError && e.isNetwork)
        setError('No connection. Your code was not lost: tap again to retry.');
      else if (e instanceof ApiError && e.code === 'OTP_INVALID')
        setError('That code is not valid. Ask the customer for a new one.');
      else setError(e instanceof ApiError ? e.message : 'Something went wrong.');
    }
  };
  return (
    <Card title="Arrival code">
      <Body soft>Ask the customer for the 6-digit code.</Body>
      <Field
        label="Arrival code"
        value={otp}
        onChangeText={(t) => setOtp(t.replace(/\D/g, '').slice(0, 6))}
        keyboardType="number-pad"
        maxLength={6}
        autoComplete="one-time-code"
        error={error}
      />
      <Button label="Confirm arrival" onPress={submit} />
    </Card>
  );
}

function StartPanel({ job }: { job: LiveRequest }) {
  const start = useStart(job.id);
  return (
    <Card title="Ready to begin?">
      {start.isError ? <ErrorBox error={start.error} /> : null}
      <Button
        label="Start inspection"
        busy={start.isPending}
        onPress={() => start.mutateAsync().catch(() => undefined)}
      />
    </Card>
  );
}

/** Technician: capture >= 2 photos (with progress and retry), then finish. The server enforces the gate. */
function EvidencePanel({ job }: { job: LiveRequest }) {
  const uploads = useUploads(job.id);
  const evidence = useEvidence(job.id);
  const stop = useStop(job.id);
  const finalizedThisCycle = (evidence.data ?? []).filter((e) => e.workCycle === job.workCycle).length;
  const [pickError, setPickError] = useState<string | null>(null);

  const capture = async (fromCamera: boolean) => {
    setPickError(null);
    const perm = fromCamera
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return setPickError('Permission is needed to add photos.');
    const result = fromCamera
      ? await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.6 })
      : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.6 });
    const asset = result.canceled ? undefined : result.assets[0];
    if (asset) await uploads.add(asset.uri);
  };

  return (
    <Card title="Evidence photos">
      <Body>
        {finalizedThisCycle} of 2 required photos uploaded{job.workCycle > 1 ? ' (rework round)' : ''}
      </Body>
      {uploads.items.map((u) => (
        <View key={u.id} style={{ flexDirection: 'row', alignItems: 'center', gap: theme.space.md }}>
          <Image
            source={{ uri: u.uri }}
            style={{ width: 56, height: 56, borderRadius: 8 }}
            accessibilityLabel="Captured photo"
          />
          <View style={{ flex: 1 }}>
            <Body>
              {u.status === 'done'
                ? 'Uploaded'
                : u.status === 'error'
                  ? 'Failed'
                  : u.status === 'uploading'
                    ? `Uploading ${Math.round(u.progress * 100)}%`
                    : u.status === 'finalizing'
                      ? 'Verifying…'
                      : 'Preparing…'}
            </Body>
            {u.error ? (
              <Text style={{ color: theme.color.danger, fontSize: theme.font.small }}>{u.error}</Text>
            ) : null}
          </View>
          {u.status === 'error' ? (
            <Button label="Retry" variant="secondary" onPress={() => uploads.retry(u.id)} />
          ) : null}
        </View>
      ))}
      {pickError ? (
        <Text accessibilityRole="alert" style={{ color: theme.color.danger }}>
          {pickError}
        </Text>
      ) : null}
      <Button label="Take a photo" onPress={() => capture(true)} />
      {__DEV__ && (
        <Button label="Pick from gallery (dev)" variant="secondary" onPress={() => capture(false)} />
      )}
      {stop.isError ? <ErrorBox error={stop.error} /> : null}
      <Button
        label="Finish and submit for review"
        busy={stop.isPending}
        onPress={() => stop.mutateAsync().catch(() => undefined)}
        accessibilityHint="Needs at least two uploaded photos"
      />
    </Card>
  );
}

/** Requester: look at the evidence, then approve or ask for rework (with a reason). */
function ReviewPanel({ job }: { job: LiveRequest }) {
  const evidence = useEvidence(job.id);
  const review = useReview(job.id);
  const now = useNow();
  const [reason, setReason] = useState('');
  const [reasonError, setReasonError] = useState<string | null>(null);
  const left = secondsUntil(job.reviewDeadlineAt, job.offsetMs, now);

  const rework = async () => {
    if (reason.trim().length < 3)
      return setReasonError('Tell the technician what to fix (at least 3 characters).');
    setReasonError(null);
    await review.mutateAsync({ decision: 'REQUEST_REWORK', reason: reason.trim() }).catch(() => undefined);
  };
  const approve = () =>
    new Promise<void>((resolve) =>
      Alert.alert('Approve this work?', 'This completes the job and settles the payment.', [
        { text: 'Not yet', style: 'cancel', onPress: () => resolve() },
        {
          text: 'Approve',
          onPress: () =>
            void review
              .mutateAsync({ decision: 'APPROVE' })
              .catch(() => undefined)
              .finally(resolve),
        },
      ]),
    );

  return (
    <Card title="Review the evidence">
      {left !== null && <Body soft>Auto-approves in {formatClock(left)} if you take no action.</Body>}
      {evidence.isPending ? (
        <Loading />
      ) : evidence.isError ? (
        <ErrorBox error={evidence.error} onRetry={() => void evidence.refetch()} />
      ) : (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.space.sm }}>
          {evidence.data
            .filter((e) => e.workCycle === job.workCycle)
            .map((e) => (
              <Image
                key={e.id}
                source={{ uri: e.url }}
                style={{ width: 96, height: 96, borderRadius: 8 }}
                accessibilityLabel="Evidence photo"
              />
            ))}
        </View>
      )}
      {review.isError ? <ErrorBox error={review.error} /> : null}
      <Button label="Approve" busy={review.isPending} onPress={approve} />
      <Field
        label="Rework reason"
        value={reason}
        onChangeText={setReason}
        multiline
        maxLength={500}
        error={reasonError}
      />
      <Button label="Request rework" variant="danger" busy={review.isPending} onPress={rework} />
    </Card>
  );
}

function CancelButton({ job, onDone }: { job: LiveRequest; onDone: () => void }) {
  const cancel = useCancel(job.id);
  const confirm = () =>
    new Promise<void>((resolve) =>
      Alert.alert(
        job.state === 'CONFIRMED' ? 'Release the technician?' : 'Cancel this request?',
        job.state === 'CONFIRMED'
          ? 'The booking is released and you can choose again.'
          : 'This cannot be undone.',
        [
          { text: 'Keep', style: 'cancel', onPress: () => resolve() },
          {
            text: 'Yes',
            style: 'destructive',
            onPress: () =>
              void cancel
                .mutateAsync()
                .then(onDone)
                .catch(() => undefined)
                .finally(resolve),
          },
        ],
      ),
    );
  return (
    <>
      {cancel.isError ? <ErrorBox error={cancel.error} /> : null}
      <Button
        label={job.state === 'CONFIRMED' ? 'Release technician' : 'Cancel request'}
        variant="secondary"
        onPress={confirm}
      />
    </>
  );
}
