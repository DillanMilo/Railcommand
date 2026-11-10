import { useState } from "react";
import { Text, View } from "react-native";
import {
  inventoryActor,
  inventoryUnitLabel,
  inventoryDate,
  inventoryEventName,
  inventoryRequestName,
  type InventorySnapshot,
} from "@railcommand/domain";
import { Card, SectionTitle, SecondaryButton, uiStyles } from "./ui";
import { InventoryDisclosure } from "./inventory-disclosure";
export function InventoryHistory({
  snapshot: s,
}: {
  snapshot: InventorySnapshot;
}) {
  const [showAll, setShowAll] = useState(false);
  const visibleEvents = showAll ? s.events : s.events.slice(0, 6);
  return (
    <Card>
      <SectionTitle>Evidence & conditions</SectionTitle>
      <Text>Approval history · newest first. Every step is retained.</Text>
      {visibleEvents.map((e) => (
        <View
          key={e.id}
          style={{
            gap: 7,
            paddingVertical: 15,
            borderBottomWidth: 1,
            borderColor: "#94a3b844",
          }}
        >
          <Text style={{ fontSize: 17, fontWeight: "600" }}>
            {inventoryEventName(e.action)}
          </Text>
          <Text>
            {inventoryRequestName(s, e.request_id)} ·{" "}
            {inventoryActor(s, e.actor_id)}
          </Text>
          <Text style={uiStyles.muted}>{inventoryDate(e.created_at)}</Text>
          {e.reason && <Text>{e.reason}</Text>}
          <InventoryDisclosure title="audit details">
            <Text>
              Record {e.id} · request {e.request_id ?? "Project setup"} · actor{" "}
              {e.actor_id}
            </Text>
            <Text>
              {e.previous_state ?? "—"} → {e.next_state ?? "recorded"} ·
              revision {e.revision ?? "Not applicable"} · {e.created_at}
            </Text>
          </InventoryDisclosure>
        </View>
      ))}
      {s.events.length > 6 && (
        <SecondaryButton
          title={
            showAll
              ? "Show latest 6 steps"
              : `Show earlier history (${s.events.length - 6} more steps)`
          }
          onPress={() => setShowAll((value) => !value)}
        />
      )}
      <InventoryDisclosure
        title={`request revisions (${s.revisions?.length ?? 0})`}
      >
        {s.revisions?.map((v) => (
          <View key={`${v.request_id}:${v.revision}`}>
            <Text>
              {inventoryRequestName(s, v.request_id)} · revision {v.revision}
            </Text>
            <Text>
              {v.payload.quantity}{" "}
              {inventoryUnitLabel(
                s.lots.find(
                  (l) =>
                    l.id ===
                    s.requests.find((r) => r.id === v.request_id)?.lot_id,
                )?.unit,
              )}{" "}
              → {v.payload.workLocation} · {v.payload.reason}
            </Text>
            <Text>
              {inventoryActor(s, v.actor_id)} · {inventoryDate(v.created_at)}
            </Text>
            <Text>
              Required lead {inventoryActor(s, v.payload.leadId)} · PM{" "}
              {inventoryActor(s, v.payload.pmId)}
            </Text>
            <Text>
              Policy revision {v.payload.policyVersion} · request {v.request_id}{" "}
              · {v.created_at}
            </Text>
          </View>
        ))}
      </InventoryDisclosure>
      <InventoryDisclosure title={`blocked attempts (${s.denials.length})`}>
        {s.denials.map((e) => (
          <View key={e.id}>
            <Text>
              {e.code.replaceAll("_", " ")} · {inventoryActor(s, e.actor_id)}
            </Text>
            <Text>
              {inventoryDate(e.created_at)} · record {e.id} · actor {e.actor_id}{" "}
              · {e.created_at}
            </Text>
          </View>
        ))}
      </InventoryDisclosure>
    </Card>
  );
}
