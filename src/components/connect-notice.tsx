import { CircleAlert, CircleCheck } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { connectNoticeMessage, readConnectNotice } from "@/features/integrations/notices";

type Props = {
  params: Record<string, string | string[] | undefined>;
  providerNames: Record<string, string>;
};

export function ConnectNotice({ params, providerNames }: Props) {
  const notice = readConnectNotice(params);
  if (!notice) return null;
  const success = notice.result === "connected";
  const Icon = success ? CircleCheck : CircleAlert;
  return (
    <Alert variant={success ? "default" : "destructive"} role="status">
      <Icon />
      <AlertDescription>
        {connectNoticeMessage(notice.result, providerNames[notice.providerId] ?? "The integration")}
      </AlertDescription>
    </Alert>
  );
}
