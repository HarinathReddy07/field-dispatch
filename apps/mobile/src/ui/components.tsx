import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Image,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
  type TextStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { JOURNEY_STEPS, formatMoney, journeyOf, stateStyle } from '@dispatch/ui-tokens';
import { ApiError } from '../api/client';
import type { Tone } from '../lib/state-ui';
import { elapsedSeconds, formatClock } from '../lib/timer';
import { useNow } from '../lib/useNow';
import { useUi } from '../state/ui';
import { theme, useTheme } from './theme';

const TABULAR: TextStyle = { fontVariant: ['tabular-nums'] };

export const money = (minor: number | null | undefined): string => formatMoney(minor);

export function Screen({
  children,
  onRefresh,
  refreshing = false,
}: {
  children: React.ReactNode;
  onRefresh?: () => void;
  refreshing?: boolean;
}) {
  const { c } = useTheme();
  const live = useUi((s) => s.live);
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }} edges={['bottom', 'left', 'right']}>
      {live === 'offline' && (
        <View
          style={{
            backgroundColor: c.surfaceMuted,
            padding: theme.space.sm,
            borderBottomWidth: 1,
            borderColor: c.border,
          }}
          accessibilityRole="alert"
          accessibilityLiveRegion="polite"
        >
          <Text style={{ color: c.warning, textAlign: 'center', fontSize: theme.font.small }}>
            Offline: showing the last known data. Reconnecting…
          </Text>
        </View>
      )}
      <ScrollView
        contentContainerStyle={{ padding: theme.space.lg, gap: theme.space.lg }}
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
  const { c } = useTheme();
  return (
    <View
      style={{
        backgroundColor: c.surface,
        borderRadius: theme.radius.md,
        borderWidth: 1,
        borderColor: c.border,
        padding: theme.space.lg,
        gap: theme.space.sm,
      }}
    >
      {title ? (
        <Text
          accessibilityRole="header"
          style={{ fontSize: theme.font.body, fontWeight: '600', color: c.text }}
        >
          {title}
        </Text>
      ) : null}
      {children}
    </View>
  );
}

export function Body({
  children,
  soft,
  mono,
  strong,
}: {
  children: React.ReactNode;
  soft?: boolean;
  mono?: boolean;
  strong?: boolean;
}) {
  const { c } = useTheme();
  return (
    <Text
      style={[
        { fontSize: theme.font.body, lineHeight: 24, color: soft ? c.textMuted : c.text },
        strong && { fontWeight: '700' },
        mono && [TABULAR, { fontFamily: 'monospace' }],
      ]}
    >
      {children}
    </Text>
  );
}

export const Title = ({ children }: { children: React.ReactNode }) => {
  const { c } = useTheme();
  return (
    <Text
      accessibilityRole="header"
      style={{ fontSize: theme.font.display, lineHeight: 34, fontWeight: '700', color: c.text }}
    >
      {children}
    </Text>
  );
};

/** Label above a value; numbers use tabular figures so they line up. */
export function KeyValue({ label, children }: { label: string; children: React.ReactNode }) {
  const { c } = useTheme();
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: theme.space.md }}>
      <Text style={{ fontSize: theme.font.small, color: c.textMuted }}>{label}</Text>
      <Text
        style={[{ fontSize: theme.font.small, color: c.text, flexShrink: 1, textAlign: 'right' }, TABULAR]}
      >
        {children}
      </Text>
    </View>
  );
}

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
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  busy?: boolean;
  disabled?: boolean;
  accessibilityHint?: string;
}) {
  const { c } = useTheme();
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
      ? c.primary
      : variant === 'danger'
        ? c.danger
        : variant === 'ghost'
          ? 'transparent'
          : c.surface;
  const ink = variant === 'primary' ? c.onPrimary : variant === 'danger' ? c.onPrimary : c.text;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: inactive, busy: busy || running }}
      onPress={press}
      style={({ pressed }) => [
        {
          minHeight: theme.touch,
          minWidth: theme.touch,
          borderRadius: theme.radius.sm,
          paddingHorizontal: theme.space.lg,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: pressed && variant === 'primary' ? c.primaryHover : bg,
          opacity: inactive ? 0.55 : 1,
        },
        variant === 'secondary' && { borderWidth: 1, borderColor: c.borderStrong },
      ]}
    >
      {busy || running ? (
        <ActivityIndicator color={ink} />
      ) : (
        <Text style={{ fontSize: theme.font.body, fontWeight: '600', color: ink }}>{label}</Text>
      )}
    </Pressable>
  );
}

/** Generic tone badge (availability etc.). Job state uses StatusBadge. */
export function Badge({ tone, children }: { tone: Tone; children: React.ReactNode }) {
  const { scheme } = useTheme();
  const key = { neutral: 'DRAFT', info: 'REQUESTED', good: 'SETTLED', warn: 'IN_PROGRESS', bad: 'CANCELLED' }[
    tone
  ];
  const s = stateStyle(key, scheme);
  return <Pill bg={s.bg} text={s.text} label={String(children)} />;
}

function Pill({ bg, text, label }: { bg: string; text: string; label: string }) {
  return (
    <View
      accessible
      accessibilityLabel={`Status: ${label}`}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        alignSelf: 'flex-start',
        gap: 6,
        backgroundColor: bg,
        borderRadius: theme.radius.pill,
        paddingHorizontal: 10,
        paddingVertical: 4,
      }}
    >
      <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: text }} />
      <Text style={{ fontSize: theme.font.caption, fontWeight: '600', color: text }}>{label}</Text>
    </View>
  );
}

/** Job state badge: tinted background, dark text, dot and a text label (never colour alone). */
export function StatusBadge({ state }: { state: string }) {
  const { scheme } = useTheme();
  const s = stateStyle(state, scheme);
  return <Pill bg={s.bg} text={s.text} label={s.label} />;
}

/** Six-step progress: requested, assigned, on site, in progress, review, done. Rework/cancelled are notes. */
export function StateStepper({ state }: { state: string }) {
  const { c } = useTheme();
  const { current, note } = journeyOf(state);
  const done = current === JOURNEY_STEPS.length - 1;
  const step = JOURNEY_STEPS[Math.max(0, current)];
  return (
    <View
      accessible
      accessibilityLabel={
        current < 0
          ? 'Progress: cancelled'
          : `Progress: step ${current + 1} of ${JOURNEY_STEPS.length}, ${step?.label}`
      }
      style={{ gap: 6 }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        {JOURNEY_STEPS.map((s, i) => {
          const complete = current >= 0 && (i < current || done);
          const active = current >= 0 && i === current && !done;
          return (
            <View key={s.key} style={{ flexDirection: 'row', alignItems: 'center', flex: i === 5 ? 0 : 1 }}>
              <View
                style={{
                  width: 14,
                  height: 14,
                  borderRadius: 7,
                  borderWidth: 2,
                  borderColor: complete || active ? c.primary : c.borderStrong,
                  backgroundColor: complete ? c.primary : active ? c.primarySoft : c.surface,
                }}
              />
              {i < 5 && (
                <View
                  style={{
                    flex: 1,
                    height: 2,
                    backgroundColor: complete && i < current ? c.primary : c.border,
                  }}
                />
              )}
            </View>
          );
        })}
      </View>
      <Text style={{ fontSize: theme.font.caption, color: c.textMuted }}>
        {current < 0
          ? (note ?? 'Cancelled')
          : `Step ${current + 1} of ${JOURNEY_STEPS.length} · ${step?.label}${note ? ` · ${note}` : ''}`}
      </Text>
    </View>
  );
}

function Pulse({ height, width }: { height: number; width?: number | `${number}%` }) {
  const { c } = useTheme();
  const opacity = useRef(new Animated.Value(0.5)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.5, duration: 700, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);
  return (
    <Animated.View
      style={{
        height,
        width: width ?? '100%',
        borderRadius: theme.radius.sm,
        backgroundColor: c.surfaceMuted,
        opacity,
      }}
    />
  );
}

/** Skeleton placeholder (matches the card layout) shown while data loads. */
export function Loading({ label = 'Loading…' }: { label?: string }) {
  return (
    <View accessibilityRole="progressbar" accessibilityLabel={label} style={{ gap: theme.space.md }}>
      <Pulse height={20} width="60%" />
      <Pulse height={72} />
      <Pulse height={72} />
    </View>
  );
}

export function Empty({ title, hint }: { title: string; hint?: string }) {
  const { c } = useTheme();
  return (
    <View
      style={{
        alignItems: 'center',
        padding: theme.space.xl,
        gap: theme.space.xs,
        borderWidth: 1,
        borderStyle: 'dashed',
        borderColor: c.borderStrong,
        borderRadius: theme.radius.md,
      }}
    >
      <Text style={{ fontSize: theme.font.body, fontWeight: '600', color: c.text }}>{title}</Text>
      {hint ? (
        <Text style={{ fontSize: theme.font.small, color: c.textMuted, textAlign: 'center' }}>{hint}</Text>
      ) : null}
    </View>
  );
}

/** Human-readable error with a retry. Never shows raw server internals (only the safe envelope message). */
export function ErrorBox({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const { c } = useTheme();
  const offline = error instanceof ApiError && error.isNetwork;
  const message = offline
    ? 'You appear to be offline.'
    : error instanceof ApiError
      ? error.message
      : 'Something went wrong.';
  return (
    <View
      accessibilityRole="alert"
      style={{
        borderWidth: 1,
        borderColor: c.danger,
        backgroundColor: c.surface,
        borderRadius: theme.radius.sm,
        padding: theme.space.md,
        gap: theme.space.sm,
      }}
    >
      <Text style={{ color: c.danger, fontSize: theme.font.body }}>{message}</Text>
      {onRetry ? <Button label="Retry" variant="secondary" onPress={onRetry} /> : null}
    </View>
  );
}

export function InlineAlert({
  tone = 'error',
  children,
}: {
  tone?: 'error' | 'info' | 'success';
  children: React.ReactNode;
}) {
  const { c } = useTheme();
  const color = tone === 'error' ? c.danger : tone === 'success' ? c.success : c.primary;
  return (
    <View
      accessibilityRole="alert"
      style={{
        borderLeftWidth: 3,
        borderColor: color,
        backgroundColor: c.surfaceMuted,
        borderRadius: theme.radius.sm,
        padding: theme.space.md,
      }}
    >
      <Text style={{ color: c.text, fontSize: theme.font.small }}>{children}</Text>
    </View>
  );
}

export function Field({ label, error, ...input }: TextInputProps & { label: string; error?: string | null }) {
  const { c } = useTheme();
  return (
    <View style={{ gap: theme.space.xs }}>
      <Text style={{ fontSize: theme.font.small, fontWeight: '500', color: c.textMuted }}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={c.textSubtle}
        style={{
          minHeight: theme.touch,
          borderWidth: 1,
          borderColor: error ? c.danger : c.borderStrong,
          borderRadius: theme.radius.sm,
          paddingHorizontal: theme.space.md,
          fontSize: theme.font.body,
          color: c.text,
          backgroundColor: c.surface,
        }}
        {...input}
      />
      {error ? (
        <Text accessibilityRole="alert" style={{ color: c.danger, fontSize: theme.font.small }}>
          {error}
        </Text>
      ) : null}
    </View>
  );
}
export const TextField = Field;

/** Six boxes over one hidden input: typing advances automatically, pasting a code fills every box. */
export function OtpInput({
  value,
  onChange,
  error,
  length = 6,
}: {
  value: string;
  onChange: (v: string) => void;
  error?: string | null;
  length?: number;
}) {
  const { c } = useTheme();
  const [focused, setFocused] = useState(false);
  return (
    <View style={{ gap: theme.space.xs }}>
      <View>
        <View
          style={{ flexDirection: 'row', gap: theme.space.sm, justifyContent: 'center' }}
          pointerEvents="none"
        >
          {Array.from({ length }, (_, i) => {
            const active = focused && i === Math.min(value.length, length - 1);
            return (
              <View
                key={i}
                style={{
                  width: 46,
                  height: 56,
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: theme.radius.sm,
                  borderWidth: active ? 2 : 1,
                  borderColor: error ? c.danger : active ? c.focus : c.borderStrong,
                  backgroundColor: c.surface,
                }}
              >
                <Text style={[{ fontSize: 24, fontWeight: '600', color: c.text }, TABULAR]}>
                  {value[i] ?? ''}
                </Text>
              </View>
            );
          })}
        </View>
        <TextInput
          accessibilityLabel="Arrival code"
          value={value}
          onChangeText={(t) => onChange(t.replace(/\D/g, '').slice(0, length))}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          keyboardType="number-pad"
          maxLength={length}
          autoComplete="one-time-code"
          textContentType="oneTimeCode"
          caretHidden
          style={StyleSheet.absoluteFill}
          selectionColor="transparent"
        />
      </View>
      {error ? (
        <Text
          accessibilityRole="alert"
          style={{ color: c.danger, fontSize: theme.font.small, textAlign: 'center' }}
        >
          {error}
        </Text>
      ) : null}
    </View>
  );
}

/** Work timer anchored to the SERVER clock offset, never the device clock's absolute time. */
export function ElapsedTimer({
  startedAt,
  offsetMs,
  size = theme.font.display,
}: {
  startedAt: string | null;
  offsetMs: number;
  size?: number;
}) {
  const { c } = useTheme();
  const now = useNow();
  const text = formatClock(elapsedSeconds(startedAt, offsetMs, now));
  return (
    <Text
      accessibilityLabel={`Elapsed ${text}`}
      style={[{ fontSize: size, fontWeight: '700', color: c.text, fontFamily: 'monospace' }, TABULAR]}
    >
      {text}
    </Text>
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
  const { c } = useTheme();
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={label}
      onPress={onPress}
      style={{
        minHeight: theme.touch,
        justifyContent: 'center',
        borderRadius: theme.radius.pill,
        borderWidth: 1,
        borderColor: selected ? c.primary : c.borderStrong,
        paddingHorizontal: theme.space.lg,
        backgroundColor: selected ? c.primarySoft : c.surface,
      }}
    >
      <Text style={{ color: c.text, fontSize: theme.font.body, fontWeight: selected ? '600' : '400' }}>
        {label}
      </Text>
    </Pressable>
  );
}

/** Evidence photo: idle / uploading with progress / failed with retry / finalized. */
export function PhotoTile({
  uri,
  status,
  progress,
  error,
  onRetry,
}: {
  uri: string;
  status: 'preparing' | 'uploading' | 'finalizing' | 'done' | 'error';
  progress: number;
  error?: string | null;
  onRetry?: () => void;
}) {
  const { c } = useTheme();
  const label =
    status === 'done'
      ? 'Uploaded'
      : status === 'error'
        ? 'Failed'
        : status === 'uploading'
          ? `Uploading ${Math.round(progress * 100)}%`
          : status === 'finalizing'
            ? 'Verifying…'
            : 'Preparing…';
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.space.md }}>
      <Image
        source={{ uri }}
        style={{ width: 56, height: 56, borderRadius: theme.radius.sm, backgroundColor: c.surfaceMuted }}
        accessibilityLabel="Captured photo"
      />
      <View style={{ flex: 1 }}>
        <Text style={{ color: status === 'error' ? c.danger : c.text, fontSize: theme.font.body }}>
          {label}
        </Text>
        {error ? <Text style={{ color: c.danger, fontSize: theme.font.small }}>{error}</Text> : null}
      </View>
      {status === 'error' && onRetry ? <Button label="Retry" variant="secondary" onPress={onRetry} /> : null}
    </View>
  );
}

/** Bottom sheet asking for a reason (min length enforced) before a destructive/review action. */
export function ReasonSheet({
  visible,
  title,
  description,
  confirmLabel,
  minLength = 3,
  busy,
  onConfirm,
  onClose,
}: {
  visible: boolean;
  title: string;
  description?: string;
  confirmLabel: string;
  minLength?: number;
  busy?: boolean;
  onConfirm: (reason: string) => void | Promise<unknown>;
  onClose: () => void;
}) {
  const { c } = useTheme();
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const submit = async () => {
    if (reason.trim().length < minLength) return setError(`Enter at least ${minLength} characters.`);
    setError(null);
    await onConfirm(reason.trim());
    setReason('');
  };
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable
        accessibilityLabel="Close"
        onPress={onClose}
        style={{ flex: 1, backgroundColor: 'rgba(15,23,42,0.45)', justifyContent: 'flex-end' }}
      >
        <Pressable
          onPress={() => undefined}
          accessibilityViewIsModal
          style={{
            backgroundColor: c.surface,
            borderTopLeftRadius: 16,
            borderTopRightRadius: 16,
            padding: theme.space.lg,
            gap: theme.space.md,
          }}
        >
          <Text
            accessibilityRole="header"
            style={{ fontSize: theme.font.heading, fontWeight: '600', color: c.text }}
          >
            {title}
          </Text>
          {description ? <Body soft>{description}</Body> : null}
          <Field
            label="Reason"
            value={reason}
            onChangeText={setReason}
            multiline
            maxLength={500}
            error={error}
          />
          <Button label={confirmLabel} variant="danger" busy={busy} onPress={submit} />
          <Button label="Cancel" variant="ghost" onPress={onClose} />
        </Pressable>
      </Pressable>
    </Modal>
  );
}
