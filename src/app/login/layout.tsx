import AuthRouteFrame from '@/components/forms/AuthRouteFrame';

export default function LoginLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AuthRouteFrame>{children}</AuthRouteFrame>;
}
