import { requireAdmin } from '@/lib/dal';
import AdminSidebar from './AdminSidebar';

export default async function AdminLayout({ children }) {
  await requireAdmin(); // Server-side guard: redirect if not admin
  return (
    <div className="admin-layout">
      <AdminSidebar />
      <div className="admin-content">
        {children}
      </div>
    </div>
  );
}
