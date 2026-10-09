import { useState } from 'react';
import { View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { CreateRequestSchema, type Category } from '@dispatch/contracts';
import { useCreateRequest } from '../api/hooks';
import { PLACES } from '../lib/route';
import type { RootStackParams } from '../navigation/types';
import { Body, Button, Card, Chip, ErrorBox, Field, Screen, Title } from '../ui/components';

type Props = NativeStackScreenProps<RootStackParams, 'CreateRequest'>;

const CATEGORIES: { value: Category; label: string }[] = [
  { value: 'ELECTRICAL_INSPECTION', label: 'Electrical inspection' },
  { value: 'MECHANICAL_INSPECTION', label: 'Mechanical inspection' },
];

export function CreateRequestScreen({ navigation }: Props) {
  const create = useCreateRequest();
  const [assetId, setAssetId] = useState('');
  const [category, setCategory] = useState<Category>('ELECTRICAL_INSPECTION');
  const [place, setPlace] = useState(0);
  const [startInHours, setStartInHours] = useState(1);
  const [durationHours, setDurationHours] = useState(2);
  const [notes, setNotes] = useState('');
  const [fieldError, setFieldError] = useState<string | null>(null);

  const submit = async () => {
    const start = Date.now() + startInHours * 3600_000;
    const parsed = CreateRequestSchema.safeParse({
      assetId: assetId.trim(),
      category,
      location: PLACES[place]!.location, // simulated location picker (no device GPS in the trial)
      windowStart: new Date(start).toISOString(),
      windowEnd: new Date(start + durationHours * 3600_000).toISOString(),
      ...(notes.trim() ? { notes: notes.trim() } : {}),
    });
    if (!parsed.success) {
      const first = parsed.error.issues[0];
      return setFieldError(
        first?.path[0] === 'assetId' ? 'Enter the asset ID.' : (first?.message ?? 'Check the form.'),
      );
    }
    setFieldError(null);
    try {
      const view = await create.mutateAsync(parsed.data);
      navigation.replace('Nearby', { requestId: view.id });
    } catch {
      /* shown through create.error */
    }
  };

  return (
    <Screen>
      <Title>New inspection request</Title>
      <Card title="Asset">
        <Field
          label="Asset ID"
          value={assetId}
          onChangeText={setAssetId}
          autoCapitalize="characters"
          maxLength={64}
          error={fieldError}
        />
        <Body soft>Category</Body>
        <View style={{ gap: 8 }}>
          {CATEGORIES.map((c) => (
            <Chip
              key={c.value}
              label={c.label}
              selected={category === c.value}
              onPress={() => setCategory(c.value)}
            />
          ))}
        </View>
      </Card>
      <Card title="Where">
        <Body soft>Simulated location (demo)</Body>
        <View style={{ gap: 8 }}>
          {PLACES.map((p, i) => (
            <Chip key={p.name} label={p.name} selected={place === i} onPress={() => setPlace(i)} />
          ))}
        </View>
      </Card>
      <Card title="When">
        <Body soft>Starts in</Body>
        <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
          {[1, 2, 4].map((h) => (
            <Chip key={h} label={`${h} h`} selected={startInHours === h} onPress={() => setStartInHours(h)} />
          ))}
        </View>
        <Body soft>Window length</Body>
        <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
          {[2, 4, 8].map((h) => (
            <Chip
              key={h}
              label={`${h} h`}
              selected={durationHours === h}
              onPress={() => setDurationHours(h)}
            />
          ))}
        </View>
      </Card>
      <Field label="Notes (optional)" value={notes} onChangeText={setNotes} multiline maxLength={1000} />
      {create.isError ? <ErrorBox error={create.error} /> : null}
      <Button label="Find technicians" icon="search-outline" busy={create.isPending} onPress={submit} />
    </Screen>
  );
}
