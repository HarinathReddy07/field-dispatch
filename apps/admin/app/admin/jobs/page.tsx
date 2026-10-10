import { redirect } from 'next/navigation';

/** There is no job list route: the live board is the job list. */
export default function JobsRedirect() {
  redirect('/admin/live');
}
