import { AcceptInviteForm } from "@/components/auth/accept-invite-form";

export default function AcceptInvitePage({
  searchParams,
}: {
  searchParams: { email?: string; digits?: string };
}) {
  const requestedDigits = Number(searchParams.digits);
  const codeLength =
    Number.isInteger(requestedDigits) && requestedDigits >= 6 && requestedDigits <= 10
      ? requestedDigits
      : 8;

  return (
    <AcceptInviteForm
      initialEmail={searchParams.email ?? ""}
      initialCodeLength={codeLength}
    />
  );
}
