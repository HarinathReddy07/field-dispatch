'use client';

import { useState } from 'react';
import { REQUEST_STATES } from '@dispatch/contracts';
import {
  AvailabilityPill,
  Badge,
  Breadcrumbs,
  Button,
  Card,
  ConfirmDialog,
  ConnectionPill,
  CopyButton,
  DataTable,
  Drawer,
  ElapsedTimer,
  EmptyState,
  ErrorState,
  FilterBar,
  FlagChip,
  Input,
  KeyValueRow,
  KpiCard,
  LoadingState,
  Money,
  PageHeader,
  Pagination,
  Select,
  Skeleton,
  StateStepper,
  StatusBadge,
  TabPanel,
  Tabs,
  TableSkeleton,
  TextArea,
  Toggle,
  useToast,
  type Column,
} from '@/components/ui';

interface Row {
  id: string;
  name: string;
  state: string;
  amount: number;
}
const ROWS: Row[] = [
  { id: '1', name: 'PANEL-BLR-0042', state: 'CONFIRMED', amount: 46500 },
  { id: '2', name: 'PUMP-BLR-0007', state: 'IN_PROGRESS', amount: 61800 },
  { id: '3', name: 'GENSET-BLR-0013', state: 'UNDER_REVIEW', amount: 12345678 },
];
const COLUMNS: Column<Row>[] = [
  { key: 'name', header: 'Asset', cell: (r) => <span className="font-medium">{r.name}</span> },
  { key: 'state', header: 'State', cell: (r) => <StatusBadge state={r.state} /> },
  { key: 'amount', header: 'Quote', align: 'right', cell: (r) => <Money minor={r.amount} /> },
];

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card title={title}>
      <div className="space-y-4">{children}</div>
    </Card>
  );
}

/** Living style guide: every shared component in each of its states (also the visual-QA target for screenshots). */
export default function ComponentsPage() {
  const toast = useToast();
  const [tab, setTab] = useState('one');
  const [drawer, setDrawer] = useState(false);
  const [dialog, setDialog] = useState(false);
  const [loading, setLoading] = useState(false);
  const [on, setOn] = useState(true);
  const [fetchedAt] = useState(() => Date.now());
  const [page, setPage] = useState(2);
  const [selected, setSelected] = useState<string | null>('2');
  const [query, setQuery] = useState('');

  return (
    <div className="space-y-6">
      <PageHeader title="Components" description="Every shared component in each of its states." />

      <Section title="Buttons">
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="primary">Primary</Button>
          <Button>Secondary</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="danger">Danger</Button>
          <Button variant="primary" size="lg">
            Large primary
          </Button>
          <Button variant="primary" disabled>
            Disabled
          </Button>
          <Button
            variant="primary"
            loading={loading}
            onClick={() => {
              setLoading(true);
              setTimeout(() => setLoading(false), 1500);
            }}
          >
            {loading ? 'Saving…' : 'Click for loading'}
          </Button>
        </div>
      </Section>

      <Section title="Status badges and flags">
        <div className="flex flex-wrap gap-2">
          {REQUEST_STATES.map((s) => (
            <StatusBadge key={s} state={s} />
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <FlagChip flag="TECHNICIAN_STALE" />
          <FlagChip flag="REVIEW_OVERDUE" />
          <FlagChip flag="REWORK_OPEN" />
          <FlagChip flag="MULTIPLE_REWORKS" />
          <AvailabilityPill status="AVAILABLE" />
          <AvailabilityPill status="BUSY" />
          <AvailabilityPill status="OFFLINE" />
          <ConnectionPill status="live" />
          <ConnectionPill status="connecting" />
          <ConnectionPill status="offline" />
          <Badge tone="info">Info</Badge>
          <Badge>Neutral</Badge>
        </div>
      </Section>

      <Section title="State stepper">
        <div className="grid gap-6 md:grid-cols-2">
          {['REQUESTED', 'CONFIRMED', 'IN_PROGRESS', 'REWORK', 'UNDER_REVIEW', 'SETTLED', 'CANCELLED'].map(
            (s) => (
              <div key={s} className="space-y-2">
                <StatusBadge state={s} />
                <StateStepper state={s} />
              </div>
            ),
          )}
        </div>
      </Section>

      <Section title="Cards and values">
        <div className="grid gap-4 sm:grid-cols-3">
          <KpiCard label="Active requests" value={12} />
          <KpiCard label="Exceptions" value={3} danger />
          <KpiCard label="Completed today" value={0} hint="Since midnight" />
        </div>
        <dl className="divide-y divide-line">
          <KeyValueRow label="Quote">
            <Money minor={46500} />
          </KeyValueRow>
          <KeyValueRow label="Large amount">
            <Money minor={12345678} />
          </KeyValueRow>
          <KeyValueRow label="Elapsed">
            <ElapsedTimer
              startedAt="2030-01-01T10:00:00Z"
              serverTime="2030-01-01T10:12:05Z"
              fetchedAt={fetchedAt}
            />
          </KeyValueRow>
          <KeyValueRow label="Correlation" mono>
            a8111cd4-3b30-4ecb-9b13-1d81fcb73c10 <CopyButton value="a8111cd4-3b30-4ecb-9b13-1d81fcb73c10" />
          </KeyValueRow>
        </dl>
      </Section>

      <Section title="Form controls">
        <div className="grid gap-4 md:grid-cols-2">
          <Input label="Default" placeholder="Placeholder" hint="Helper text sits below the field." />
          <Input label="With error" defaultValue="abc" error="Enter at least 5 characters." />
          <Input label="Disabled" defaultValue="Read only" disabled />
          <Select label="Select" defaultValue="b">
            <option value="a">Option A</option>
            <option value="b">Option B</option>
          </Select>
          <TextArea label="Text area" rows={3} placeholder="Reason" />
          <div className="pt-6">
            <Toggle label="Exceptions only" checked={on} onChange={setOn} />
          </div>
        </div>
      </Section>

      <Section title="Breadcrumbs and filters">
        <Breadcrumbs items={[{ label: 'Live board', href: '/admin/live' }, { label: 'PANEL-BLR-0042' }]} />
        <FilterBar label="Demo filters" active={query !== ''} onClear={() => setQuery('')}>
          <Input
            label="Search"
            placeholder="Asset or technician"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <Toggle label="Exceptions only" checked={on} onChange={setOn} />
        </FilterBar>
      </Section>

      <Section title="Tabs">
        <div className="-mx-4 rounded-md border border-line">
          <Tabs
            label="Demo tabs"
            value={tab}
            onChange={setTab}
            tabs={[
              { id: 'one', label: 'Overview' },
              { id: 'two', label: 'Timeline', count: 4 },
              { id: 'three', label: 'Audit' },
            ]}
          />
          <TabPanel id="one" value={tab}>
            Overview panel
          </TabPanel>
          <TabPanel id="two" value={tab}>
            Timeline panel
          </TabPanel>
          <TabPanel id="three" value={tab}>
            Audit panel
          </TabPanel>
        </div>
      </Section>

      <Section title="Data table and pagination">
        <div className="-mx-4 -mb-4 border-t border-line">
          <DataTable
            ariaLabel="Demo table"
            columns={COLUMNS}
            rows={ROWS}
            rowKey={(r) => r.id}
            selectedKey={selected}
            onRowClick={(r) => setSelected(r.id)}
            minWidth={480}
          />
          <Pagination page={page} pageSize={25} total={80} onPage={setPage} />
        </div>
      </Section>

      <Section title="Feedback states">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-md border border-line">
            <EmptyState
              title="No jobs in this view"
              hint="New requests appear here the moment they are created."
            />
          </div>
          <div className="space-y-3">
            <ErrorState
              message="Could not load jobs. The server returned an error."
              correlationId="a8111cd4-3b30-4ecb-9b13-1d81fcb73c10"
              onRetry={() => toast.info('Retrying…')}
            />
            <Skeleton className="h-8" />
            <TableSkeleton rows={3} cols={4} />
            <LoadingState label="Loading technicians…" />
          </div>
        </div>
      </Section>

      <Section title="Overlays and toasts">
        <div className="flex flex-wrap gap-3">
          <Button onClick={() => setDrawer(true)}>Open drawer</Button>
          <Button variant="danger" onClick={() => setDialog(true)}>
            Open confirm dialog
          </Button>
          <Button onClick={() => toast.success('Job cancelled', 'Recorded in the audit log.')}>
            Success toast
          </Button>
          <Button onClick={() => toast.info('Reconnected', 'Live updates resumed.')}>Info toast</Button>
          <Button onClick={() => toast.error(new Error('x'), 'Could not reach the server')}>
            Error toast
          </Button>
        </div>
      </Section>

      {drawer && (
        <Drawer
          title="PANEL-BLR-0042"
          subtitle={<StateStepper state="IN_PROGRESS" />}
          onClose={() => setDrawer(false)}
          footer={<Button onClick={() => setDrawer(false)}>Close</Button>}
        >
          <p className="p-5 text-sm">Drawer body. Esc closes it, Tab stays inside.</p>
        </Drawer>
      )}
      {dialog && (
        <ConfirmDialog
          title="Cancel this job?"
          description="The technician is released and everyone involved is notified."
          confirmLabel="Cancel job"
          danger
          onConfirm={() => {
            setDialog(false);
            toast.success('Job cancelled');
          }}
          onClose={() => setDialog(false)}
        />
      )}
    </div>
  );
}
