"use client";
import { use } from "react";
import { useProject } from "@/components/providers/ProjectProvider";
import { InventoryWorkspace } from "./InventoryWorkspace";
import styles from "./inventory.module.css";
export default function InventoryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { currentUserId, isDemo } = useProject();
  if (isDemo || !currentUserId)
    return (
      <main className={styles.page}>
        <h1>Inventory</h1>
        <p>
          Sign in to an assigned project to use inventory. Demo records are
          separate from operational stock.
        </p>
      </main>
    );
  return (
    <InventoryWorkspace
      key={`${currentUserId}:${id}`}
      userId={currentUserId}
      projectId={id}
    />
  );
}
