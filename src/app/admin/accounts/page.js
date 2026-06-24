import { getAllProfiles } from '@/lib/data/profiles';
import { getCurrentUser } from '@/lib/dal';
import AccountsManager from './AccountsManager';

export default async function AdminAccounts() {
  const [profiles, res] = await Promise.all([getAllProfiles(), getCurrentUser()]);
  const admins = profiles.filter(u => u.role === 'admin');
  const customers = profiles.filter(u => u.role === 'customer');
  return <AccountsManager admins={admins} customers={customers} currentUserId={res?.user?.id} />;
}
