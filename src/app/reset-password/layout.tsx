import AuthRouteFrame from '@/components/forms/AuthRouteFrame';

export default function ResetPasswordLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AuthRouteFrame>{children}</AuthRouteFrame>;
}
