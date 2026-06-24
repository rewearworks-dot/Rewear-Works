import { createClient } from '@/lib/supabase/server';
import { requireAuth, requireAdmin } from '@/lib/dal';
import { unstable_rethrow } from 'next/navigation';

const ORDER_SELECT = `
  *,
  order_items ( id, product_id, name_snapshot, price_snapshot, size_snapshot, quantity )
`;

function shapeOrder(o) {
  return {
    id: o.id,
    status: o.status,
    total: o.total,
    subtotal: o.subtotal,
    shippingCost: o.shipping_cost,
    paymentStatus: o.payment_status,
    paymentMethod: o.payment_method,
    paidAt: o.paid_at,
    needsReview: o.needs_review ?? false,
    createdAt: o.created_at,
    notes: o.notes,
    customer: {
      name: o.recipient_name,
      phone: o.phone,
      address: o.address,
      userId: o.user_id,
    },
    items: (o.order_items ?? []).map(oi => ({
      id: oi.product_id,
      orderItemId: oi.id,
      name: oi.name_snapshot,
      price: oi.price_snapshot,
      selectedSize: oi.size_snapshot,
      quantity: oi.quantity,
    })),
  };
}

export async function getMyOrders() {
  try {
    const { user } = await requireAuth();
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('orders')
      .select(ORDER_SELECT)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    if (error) { console.error('[getMyOrders]', error.message); return []; }
    return (data ?? []).map(shapeOrder);
  } catch (e) { unstable_rethrow(e); console.error('[getMyOrders] exception:', e.message); return []; }
}

export async function getAllOrders() {
  try {
    await requireAdmin();
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('orders')
      .select(ORDER_SELECT)
      .order('created_at', { ascending: false });
    if (error) { console.error('[getAllOrders]', error.message); return []; }
    return (data ?? []).map(shapeOrder);
  } catch (e) { unstable_rethrow(e); console.error('[getAllOrders] exception:', e.message); return []; }
}

export async function getOrderById(id) {
  try {
    await requireAuth();
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('orders')
      .select(ORDER_SELECT)
      .eq('id', id)
      .maybeSingle();
    if (error) { console.error('[getOrderById]', error.message); return null; }
    return data ? shapeOrder(data) : null;
  } catch (e) { unstable_rethrow(e); console.error('[getOrderById] exception:', e.message); return null; }
}
