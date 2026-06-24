import { requireAuth, getCurrentUser } from '@/lib/dal';
import { getMyOrders } from '@/lib/data/orders';
import ProfileClient from './ProfileClient';

export default async function ProfilePage() {
  const res = await requireAuth();
  const orders = await getMyOrders();
  return <ProfileClient user={res.user} profile={res.profile} orders={orders} />;
}
