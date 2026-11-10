import assert from "node:assert/strict";
import {
  exportAndShareInventoryCsv,
  type InventoryCsvShareDependencies,
} from "./inventory-export";
const projectId = "project";
const report = {
  projectId,
  asOf: "2026-11-04T12:00:00.000Z",
  fileName: "material-costs-project-2026-11-04.csv",
  mimeType: "text/csv" as const,
  csv: '\uFEFF"Record type","Project ID"\r\n',
};
function harness() {
  const events: string[] = [];
  const deps: InventoryCsvShareDependencies = {
    current: () => true,
    online: () => true,
    sharingAvailable: async () => true,
    read: async () => {
      events.push("read");
      return report;
    },
    createFile: () => ({
      uri: "owned.csv",
      write: (csv) => {
        assert.equal(csv, report.csv);
        events.push("write");
      },
      remove: () => {
        events.push("remove");
      },
    }),
    share: async () => {
      events.push("share");
    },
  };
  return { events, deps };
}
describe("Native inventory CSV safety", () => {
  it("shares the server CSV unchanged and deletes the temporary copy", async () => {
    const h = harness();
    await exportAndShareInventoryCsv(projectId, h.deps);
    assert.deepEqual(h.events, ["read", "write", "share", "remove"]);
  });
  it("does not fetch or write when offline/sharing is unavailable", async () => {
    for (const key of ["online", "sharingAvailable"] as const) {
      const h = harness();
      if (key === "online") h.deps.online = () => false;
      else h.deps.sharingAvailable = async () => false;
      await assert.rejects(exportAndShareInventoryCsv(projectId, h.deps));
      assert.deepEqual(h.events, []);
    }
  });
  it("does not write after a scope change or network failure", async () => {
    for (const fail of ["scope", "network"]) {
      const h = harness();
      let current = true;
      h.deps.current = () => current;
      h.deps.read = async () => {
        if (fail === "network") throw new Error("network");
        current = false;
        return report;
      };
      await assert.rejects(exportAndShareInventoryCsv(projectId, h.deps));
      assert.deepEqual(h.events, []);
    }
  });
  it("cleans up partial writes and dismissed or failed share sheets", async () => {
    for (const stage of ["write", "share"]) {
      const h = harness();
      if (stage === "write")
        h.deps.createFile = () => ({
          uri: "owned.csv",
          write: () => {
            throw new Error("quota");
          },
          remove: () => h.events.push("remove"),
        });
      else
        h.deps.share = async () => {
          throw new Error("dismissed");
        };
      await assert.rejects(exportAndShareInventoryCsv(projectId, h.deps));
      assert.equal(h.events.at(-1), "remove");
    }
  });
  it("rejects responses for another project or invalid MIME without creating a file", async () => {
    for (const r of [
      { ...report, projectId: "other" },
      { ...report, mimeType: "text/html" },
    ]) {
      const h = harness();
      h.deps.read = async () => r as typeof report;
      await assert.rejects(
        exportAndShareInventoryCsv(projectId, h.deps),
        /invalid/,
      );
      assert.deepEqual(h.events, []);
    }
  });
});
