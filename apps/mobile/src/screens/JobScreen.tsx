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
import { formatClock, secondsUntil } from '../lib/timer';
import { etaMinutes, haversineKm, simulateRoute } from '../lib/route';
import { useNow } from '../lib/useNow';
import type { RootStackParams } from '../navigation/types';
import { useRequestRoom } from '../realtime/live';
import { useSession } from '../state/session';
import { useUi } from '../state/ui';
import {
  Body,
  Button,
  Card,
  ElapsedTimer,
  Empty,
  ErrorBox,
  InlineAlert,
  KeyValue,
  Loading,
  OtpInput,
  PhotoTile,
  ReasonSheet,
  Screen,
  StateStepper,
  StatusBadge,
  Title,
  money,
} from '../ui/components';
import { theme, useTheme } from '../ui/theme';

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
        {req.error instanceof ApiError && req.error.status === 404 ? (
          // 404 is also what a job you were removed from looks like (reassigned, released or cancelled)
          <>
            <Empty
              title="This job is no longer available"
              hint="It may have been reassigned, released or cancelled. Your current jobs are on the home screen."
            />
            <Button label="Back to jobs" onPress={() => navigation.popToTop()} />
          </>
        ) : (
          <ErrorBox error={req.error} onRetry={() => void req.refetch()} />
        )}
      </Screen>
    );
  const job = req.data;
  const ui = stateUi(role, job.state);
  const actions = actionsFor(role, job.state);

  return (
    <Screen onRefresh={() => void req.refetch()} refreshing={req.isRefetching}>
      <Title>{job.assetId}</Title>
      <View style={{ flexDirection: 'row', gap: theme.space.sm, alignItems: 'center', flexWrap: 'wrap' }}>
        <StatusBadge state={job.state} />
        {job.technician && role === 'REQUESTER' ? <Body soft>{job.technician.name}</Body> : null}
      </View>
      <StateStepper state={job.state} />
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
      <KeyValue label="Category">{job.category.replace(/_/g, ' ').toLowerCase()}</KeyValue>
      <KeyValue label="Site">
        {lat.toFixed(4)}, {lon.toFixed(4)}
      </KeyValue>
      {job.notes ? <KeyValue label="Notes">{job.notes}</KeyValue> : null}
      <KeyValue label="Quote">{money(job.quoteMinor)}</KeyValue>
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
  if (job.state !== 'IN_PROGRESS' || !job.startedAt) return null;
  return (
    <Card title="Work timer">
      <ElapsedTimer startedAt={job.startedAt} offsetMs={job.offsetMs} size={40} />
    </Card>
  );
}

function RequesterArrival({ job }: { job: LiveRequest }) {
  const { c } = useTheme();
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
            style={{
              fontSize: theme.font.otp,
              lineHeight: 44,
              fontWeight: '600',
              letterSpacing: 7,
              fontFamily: 'monospace',
              fontVariant: ['tabular-nums'],
              color: c.text,
            }}
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
      <OtpInput value={otp} onChange={setOtp} error={error} />
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
      <Body soft>
        {Math.min(finalizedThisCycle, 2)} of 2 required{job.workCycle > 1 ? ' (rework round)' : ''}
      </Body>
      {uploads.items.map((u) => (
        <PhotoTile
          key={u.id}
          uri={u.uri}
          status={u.status}
          progress={u.progress}
          error={u.error}
          onRetry={() => uploads.retry(u.id)}
        />
      ))}
      {pickError ? <InlineAlert>{pickError}</InlineAlert> : null}
      <Button label="Take a photo" variant="secondary" onPress={() => capture(true)} />
      {__DEV__ && <Button label="Pick from gallery (dev)" variant="ghost" onPress={() => capture(false)} />}
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
  const [sheet, setSheet] = useState(false);
  const left = secondsUntil(job.reviewDeadlineAt, job.offsetMs, now);

  const rework = async (reason: string) => {
    await review.mutateAsync({ decision: 'REQUEST_REWORK', reason }).catch(() => undefined);
    setSheet(false);
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
      <Button label="Request rework" variant="secondary" onPress={() => setSheet(true)} />
      <ReasonSheet
        visible={sheet}
        title="Request rework"
        description="Tell the technician what to fix."
        confirmLabel="Send rework request"
        busy={review.isPending}
        onConfirm={rework}
        onClose={() => setSheet(false)}
      />
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
