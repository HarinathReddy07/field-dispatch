import { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { RequestState, Role } from '@dispatch/contracts';
import { ApiError } from '../api/client';
import { stateUi, type Tone } from '../lib/state-ui';
import { useUi } from '../state/ui';
import { theme } from './theme';

export function Screen({
  children,
  onRefresh,
  refreshing = false,
}: {
  children: React.ReactNode;
  onRefresh?: () => void;
  refreshing?: boolean;
}) {
  const live = useUi((s) => s.live);
  return (
    <SafeAreaView style={s.screen} edges={['bottom', 'left', 'right']}>
      {live === 'offline' && (
        <View style={s.offline} accessibilityRole="alert" accessibilityLiveRegion="polite">
          <Text style={s.offlineText}>Offline: showing the last known data. Reconnecting…</Text>
        </View>
      )}
      <ScrollView
        contentContainerStyle={s.content}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          onRefresh ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} /> : undefined
        }
      >
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

export function Card({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <View style={s.card}>
      {title ? (
        <Text style={s.cardTitle} accessibilityRole="header">
          {title}
        </Text>
      ) : null}
      {children}
    </View>
  );
}

export function Body({ children, soft }: { children: React.ReactNode; soft?: boolean }) {
  return <Text style={[s.body, soft && { color: theme.color.soft }]}>{children}</Text>;
}

export const Title = ({ children }: { children: React.ReactNode }) => (
  <Text style={s.title} accessibilityRole="header">
    {children}
  </Text>
);

/**
 * Button with double-tap protection: while an async onPress is running (or `busy`), further taps are ignored,
 * so a nervous double tap can never fire a mutation twice. Touch target is at least 44pt.
 */
export function Button({
  label,
  onPress,
  variant = 'primary',
  busy = false,
  disabled = false,
  accessibilityHint,
}: {
  label: string;
  onPress: () => void | Promise<unknown>;
  variant?: 'primary' | 'secondary' | 'danger';
  busy?: boolean;
  disabled?: boolean;
  accessibilityHint?: string;
}) {
  const lock = useRef(false);
  const [running, setRunning] = useState(false);
  const inactive = disabled || busy || running;
  const press = async () => {
    if (lock.current || inactive) return;
    lock.current = true;
    setRunning(true);
    try {
      await onPress();
    } finally {
      lock.current = false;
      setRunning(false);
    }
  };
  const bg =
    variant === 'primary'
      ? theme.color.brand
      : variant === 'danger'
        ? theme.color.danger
        : theme.color.surface;
  const ink = variant === 'secondary' ? theme.color.ink : theme.color.brandInk;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: inactive, busy: busy || running }}
      onPress={press}
      style={[
        s.button,
        { backgroundColor: bg, opacity: inactive ? 0.55 : 1 },
        variant === 'secondary' && s.buttonBorder,
      ]}
    >
      {busy || running ? (
        <ActivityIndicator color={ink} />
      ) : (
        <Text style={[s.buttonText, { color: ink }]}>{label}</Text>
      )}
    </Pressable>
  );
}

export function Badge({ tone, children }: { tone: Tone; children: React.ReactNode }) {
  return (
    <View style={[s.badge, { backgroundColor: theme.tone[tone].bg }]}>
      <Text style={[s.badgeText, { color: theme.tone[tone].ink }]}>{children}</Text>
    </View>
  );
}

export function StateBadge({ role, state }: { role: Role; state: RequestState }) {
  const ui = stateUi(role, state);
  return (
    <Badge tone={ui.tone}>
      <Text accessibilityLabel={`Status: ${ui.label}`}>{ui.label}</Text>
    </Badge>
  );
}

export function Loading({ label = 'Loading…' }: { label?: string }) {
  return (
    <View style={s.center} accessibilityRole="progressbar" accessibilityLabel={label}>
      <ActivityIndicator />
      <Text style={[s.body, { color: theme.color.soft, marginTop: theme.space.sm }]}>{label}</Text>
    </View>
  );
}

export function Empty({ title, hint }: { title: string; hint?: string }) {
  return (
    <View style={s.center}>
      <Text style={[s.body, { fontWeight: '600' }]}>{title}</Text>
      {hint ? <Text style={[s.body, { color: theme.color.soft, textAlign: 'center' }]}>{hint}</Text> : null}
    </View>
  );
}

/** Human-readable error with a retry. Never shows raw server internals (only the safe envelope message). */
export function ErrorBox({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const offline = error instanceof ApiError && error.isNetwork;
  const message = offline
    ? 'You appear to be offline.'
    : error instanceof ApiError
      ? error.message
      : 'Something went wrong.';
  return (
    <View style={s.error} accessibilityRole="alert">
      <Text style={{ color: theme.tone.bad.ink, fontSize: theme.font.body }}>{message}</Text>
      {onRetry ? <Button label="Retry" variant="secondary" onPress={onRetry} /> : null}
    </View>
  );
}

export function Field({ label, error, ...input }: TextInputProps & { label: string; error?: string | null }) {
  return (
    <View style={{ gap: theme.space.xs }}>
      <Text style={s.label}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={theme.color.soft}
        style={[s.input, error ? { borderColor: theme.color.danger } : null]}
        {...input}
      />
      {error ? (
        <Text accessibilityRole="alert" style={{ color: theme.color.danger, fontSize: theme.font.small }}>
          {error}
        </Text>
      ) : null}
    </View>
  );
}

export function Chip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={label}
      onPress={onPress}
      style={[s.chip, selected && { backgroundColor: theme.color.brand, borderColor: theme.color.brand }]}
    >
      <Text style={{ color: selected ? theme.color.brandInk : theme.color.ink, fontSize: theme.font.body }}>
        {label}
      </Text>
    </Pressable>
  );
}

export const money = (minor: number | null | undefined): string =>
  minor === null || minor === undefined ? '—' : `₹${(minor / 100).toFixed(2)}`;

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.color.bg },
  content: { padding: theme.space.lg, gap: theme.space.lg },
  card: {
    backgroundColor: theme.color.surface,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.color.border,
    padding: theme.space.lg,
    gap: theme.space.sm,
  },
  cardTitle: { fontSize: theme.font.body, fontWeight: '700', color: theme.color.ink },
  title: { fontSize: theme.font.title, fontWeight: '700', color: theme.color.ink },
  body: { fontSize: theme.font.body, color: theme.color.ink },
  label: { fontSize: theme.font.small, fontWeight: '600', color: theme.color.soft },
  input: {
    minHeight: theme.touch,
    borderWidth: 1,
    borderColor: theme.color.border,
    borderRadius: theme.radius.sm,
    paddingHorizontal: theme.space.md,
    fontSize: theme.font.body,
    color: theme.color.ink,
    backgroundColor: theme.color.surface,
  },
  button: {
    minHeight: theme.touch,
    minWidth: theme.touch,
    borderRadius: theme.radius.sm,
    paddingHorizontal: theme.space.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonBorder: { borderWidth: 1, borderColor: theme.color.border },
  buttonText: { fontSize: theme.font.body, fontWeight: '600' },
  badge: {
    alignSelf: 'flex-start',
    borderRadius: theme.radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  badgeText: { fontSize: theme.font.small, fontWeight: '600' },
  center: { alignItems: 'center', justifyContent: 'center', padding: theme.space.xl, gap: theme.space.xs },
  error: {
    backgroundColor: theme.tone.bad.bg,
    borderRadius: theme.radius.sm,
    padding: theme.space.md,
    gap: theme.space.sm,
  },
  offline: { backgroundColor: theme.tone.warn.bg, padding: theme.space.sm },
  offlineText: { color: theme.tone.warn.ink, textAlign: 'center', fontSize: theme.font.small },
  chip: {
    minHeight: theme.touch,
    justifyContent: 'center',
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    borderColor: theme.color.border,
    paddingHorizontal: theme.space.lg,
    backgroundColor: theme.color.surface,
  },
});
