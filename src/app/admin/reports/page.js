import { getAllOrders } from '@/lib/data/orders';
import ReportsClient from './ReportsClient';

export default async function AdminReports() {
  const orders = await getAllOrders();
  return <ReportsClient orders={orders} />;
}
