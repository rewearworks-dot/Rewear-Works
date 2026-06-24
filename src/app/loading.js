export default function Loading() {
  return (
    <div style={{ marginTop: 'var(--navbar-height)', minHeight: '80vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="auth-spinner" style={{ width: 40, height: 40 }}></div>
    </div>
  );
}
