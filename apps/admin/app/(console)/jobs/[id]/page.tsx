import { redirect } from 'next/navigation';

/** Job detail is now a drawer on the live board; /jobs/<id> deep-links to it. */
export default async function JobRedirect({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/live?job=${encodeURIComponent(id)}`);
}
