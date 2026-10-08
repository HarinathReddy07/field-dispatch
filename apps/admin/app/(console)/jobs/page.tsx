import { redirect } from 'next/navigation';

/** The live board moved to /live; keep old links working. */
export default function JobsRedirect() {
  redirect('/live');
}
