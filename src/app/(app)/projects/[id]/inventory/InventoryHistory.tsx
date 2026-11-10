"use client";
import { useState } from "react";
import {
  inventoryActor,
  inventoryUnitLabel,
  inventoryDate,
  inventoryEventName,
  inventoryRequestName,
  type InventorySnapshot,
} from "@railcommand/domain";
import styles from "./inventory.module.css";
export function InventoryHistory({
  snapshot: s,
}: {
  snapshot: InventorySnapshot;
}) {
  const [showAll, setShowAll] = useState(false);
  const visibleEvents = showAll ? s.events : s.events.slice(0, 6);
  return (
    <section id="approval-history">
      <h2>Evidence & conditions</h2>
      <p>
        Approval history · newest first. Every step is retained; earlier
        decisions cannot be edited.
      </p>
      <ol className={styles.timeline}>
        {visibleEvents.map((e) => (
          <li key={e.id}>
            <div className={styles.timelineHeading}>
              <strong>{inventoryEventName(e.action)}</strong>
              <time dateTime={e.created_at}>{inventoryDate(e.created_at)}</time>
            </div>
            <p>
              {inventoryRequestName(s, e.request_id)} ·{" "}
              {inventoryActor(s, e.actor_id)}
            </p>
            {e.reason && <p>{e.reason}</p>}
            <details>
              <summary>View audit details</summary>
              <dl>
                <div>
                  <dt>Record</dt>
                  <dd>{e.id}</dd>
                </div>
                <div>
                  <dt>Request reference</dt>
                  <dd>{e.request_id ?? "Project setup"}</dd>
                </div>
                <div>
                  <dt>Actor reference</dt>
                  <dd>{e.actor_id}</dd>
                </div>
                <div>
                  <dt>State change</dt>
                  <dd>
                    {e.previous_state ?? "—"} → {e.next_state ?? "recorded"}
                  </dd>
                </div>
                <div>
                  <dt>Revision / timestamp</dt>
                  <dd>
                    {e.revision ?? "Not applicable"} · {e.created_at}
                  </dd>
                </div>
              </dl>
            </details>
          </li>
        ))}
      </ol>
      {s.events.length > 6 && (
        <button type="button" onClick={() => setShowAll((value) => !value)}>
          {showAll
            ? "Show latest 6 steps"
            : `Show earlier history (${s.events.length - 6} more steps)`}
        </button>
      )}
      {!s.events.length && <p>No approval history yet.</p>}
      <details>
        <summary>Request revisions ({s.revisions?.length ?? 0})</summary>
        {s.revisions?.map((v) => (
          <article key={`${v.request_id}:${v.revision}`}>
            <h3>
              {inventoryRequestName(s, v.request_id)} · revision {v.revision}
            </h3>
            <p>
              {v.payload.quantity}{" "}
              {inventoryUnitLabel(
                s.lots.find(
                  (l) =>
                    l.id ===
                    s.requests.find((r) => r.id === v.request_id)?.lot_id,
                )?.unit,
              )}{" "}
              → {v.payload.workLocation}
            </p>
            <p>{v.payload.reason}</p>
            <p>
              {inventoryActor(s, v.actor_id)} · {inventoryDate(v.created_at)}
            </p>
            <p>
              Required lead: {inventoryActor(s, v.payload.leadId)} · PM:{" "}
              {inventoryActor(s, v.payload.pmId)}
            </p>
            <small>
              Policy revision {v.payload.policyVersion} · request {v.request_id}{" "}
              · {v.created_at}
            </small>
          </article>
        ))}
      </details>
      <details>
        <summary>Blocked attempts ({s.denials.length})</summary>
        {s.denials.map((e) => (
          <article key={e.id}>
            <strong>{e.code.replaceAll("_", " ")}</strong>
            <p>
              {inventoryActor(s, e.actor_id)} · {inventoryDate(e.created_at)}
            </p>
            <small>
              Record {e.id} · actor {e.actor_id} · {e.created_at}
            </small>
          </article>
        ))}
      </details>
    </section>
  );
}
