import { getAllOrders } from '@/lib/data/orders';
import OrdersManager from './OrdersManager';

export default async function AdminOrdersPage() {
  const orders = await getAllOrders();
  return <OrdersManager orders={orders} />;
}
