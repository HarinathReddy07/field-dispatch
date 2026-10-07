import { useState } from 'react';
import { Text } from 'react-native';
import { LoginSchema } from '@dispatch/contracts';
import { ApiError } from '../api/client';
import { useSession } from '../state/session';
import { Body, Button, Card, Field, Screen, Title } from '../ui/components';
import { theme } from '../ui/theme';

export function LoginScreen() {
  const signIn = useSession((s) => s.signIn);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    const parsed = LoginSchema.safeParse({ email: email.trim(), password });
    if (!parsed.success) return setError('Enter a valid email and your password.');
    setError(null);
    try {
      await signIn(parsed.data.email, parsed.data.password);
    } catch (e) {
      if (e instanceof ApiError && e.isNetwork) setError('Cannot reach the server. Check your connection.');
      else if (e instanceof ApiError && e.status === 429) setError('Too many attempts. Try again shortly.');
      else setError('Invalid email or password.'); // uniform: never reveals whether the account exists
    }
  };

  return (
    <Screen>
      <Title>Field Dispatch</Title>
      <Body soft>Sign in as a requester or a field technician.</Body>
      <Card>
        <Field
          label="Email"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          textContentType="username"
        />
        <Field
          label="Password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoComplete="password"
          textContentType="password"
        />
        {error ? (
          <Text accessibilityRole="alert" style={{ color: theme.color.danger }}>
            {error}
          </Text>
        ) : null}
        <Button label="Sign in" onPress={submit} />
      </Card>
    </Screen>
  );
}
