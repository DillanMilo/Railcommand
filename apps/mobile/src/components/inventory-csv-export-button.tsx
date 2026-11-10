import { useLayoutEffect, useRef, useState } from "react";
import { Text } from "react-native";
import { SecondaryButton, uiStyles } from "./ui";
import { useAuth } from "@/providers/auth-provider";
import { shareNativeInventoryCsv } from "@/lib/native-inventory-export";

export function InventoryCsvExportButton({
  projectId,
  online,
}: {
  projectId: string;
  online: boolean;
}) {
  const { session, sessionRevision, isSessionCurrent } = useAuth();
  const userId = session?.user.id;
  const lifetime = useRef<{ active: boolean } | null>(null);
  const network = useRef(online);
  const inFlight = useRef(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  useLayoutEffect(() => {
    network.current = online;
  }, [online]);
  useLayoutEffect(() => {
    const scope = { active: true };
    lifetime.current = scope;
    return () => {
      scope.active = false;
    };
  }, [userId, sessionRevision, projectId]);
  const share = async () => {
    if (!userId || inFlight.current) return;
    const scope = lifetime.current;
    const current = () =>
      scope?.active === true &&
      lifetime.current === scope &&
      isSessionCurrent(userId, sessionRevision);
    inFlight.current = true;
    setBusy(true);
    setMessage("");
    try {
      await shareNativeInventoryCsv(
        userId,
        projectId,
        current,
        () => network.current,
      );
      if (current())
        setMessage(
          "CSV ready. Choose Excel or Save to Files in the share sheet.",
        );
    } catch (error) {
      if (current())
        setMessage(
          error instanceof Error
            ? error.message
            : "Export failed. Saved work is unchanged.",
        );
    } finally {
      inFlight.current = false;
      if (current()) setBusy(false);
    }
  };
  return (
    <>
      <SecondaryButton
        title={busy ? "Preparing CSV…" : "Export CSV"}
        disabled={!online || busy}
        onPress={() => void share()}
      />
      <Text style={uiStyles.muted}>
        Opens in Excel · online only · current project cost report
      </Text>
      {!!message && (
        <Text accessibilityLiveRegion="polite" style={uiStyles.muted}>
          {message}
        </Text>
      )}
    </>
  );
}
