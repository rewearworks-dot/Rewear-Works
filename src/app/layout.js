import './globals.css';
import { CartProvider } from '@/context/CartContext';
import { AuthProvider } from '@/context/AuthContext';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { getCurrentUser } from '@/lib/dal';

export const metadata = {
  title: 'Rewear Works — Fashion Preloved Berkualitas',
  description: 'Temukan fashion preloved berkualitas dengan harga terjangkau. Koleksi baju pria & wanita dari brand ternama. Sustainable fashion, affordable style.',
};

export default async function RootLayout({ children }) {
  const res = await getCurrentUser();
  return (
    <html lang="id">
      <body>
        <AuthProvider initialUser={res?.user ?? null} initialProfile={res?.profile ?? null}>
          <CartProvider>
            <Navbar />
            <main>{children}</main>
            <Footer />
          </CartProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
