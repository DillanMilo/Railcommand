/* Public neutral shell; private drafts remain in the previously authenticated user's IndexedDB.
   No network submission, cache writes, identity display, or database enumeration. */
(() => {
  const openButton = document.getElementById("inventory-open"),
    panel = document.getElementById("inventory-drafts");
  if (!openButton || !panel) return;
  function node(tag, text) {
    const el = document.createElement(tag);
    if (text) el.textContent = text;
    return el;
  }
  openButton.addEventListener("click", async () => {
    panel.hidden = false;
    panel.replaceChildren();
    let db;
    try {
      const scope = localStorage.getItem("rc-offline-database-scope");
      if (!scope || !/^railcommand-offline:[A-Za-z0-9%_-]+$/.test(scope))
        throw Error(
          "No saved account scope is available. Reconnect and sign in.",
        );
      db = await new Promise((resolve, reject) => {
        const r = indexedDB.open(scope, 3);
        r.onupgradeneeded = () => {
          r.transaction.abort();
          reject(Error("No saved device database"));
        };
        r.onsuccess = () => resolve(r.result);
        r.onerror = () => reject(r.error);
      });
      db.onversionchange = () => db.close();
      const rows = await new Promise((resolve, reject) => {
        const tx = db.transaction("drafts", "readonly"),
          r = tx.objectStore("drafts").getAll();
        r.onsuccess = () =>
          resolve(r.result.filter((x) => x.kind === "inventory"));
        r.onerror = () => reject(r.error);
      });
      if (!rows.length) {
        panel.append(
          node(
            "p",
            "No saved inventory drafts. Existing daily-log and photo work is unchanged.",
          ),
        );
        db.close();
        return;
      }
      rows.forEach((row, index) => {
        const draft = row.value,
          card = node("form");
        card.append(node("h2", `Saved request ${index + 1}`));
        const status = node(
          "p",
          "Saved input is local. Submission and approval require connectivity.",
        );
        status.setAttribute("role", "status");
        card.append(status);
        if (draft?.schemaVersion !== 1) {
          card.append(
            node(
              "p",
              "This draft needs a supported app version. It has been preserved.",
            ),
          );
          panel.append(card);
          return;
        }
        if (draft.phase === "unknown") {
          card.append(
            node(
              "p",
              `Unconfirmed operation ${draft.pending?.operationId ?? draft.operationId}. Reconnect and check its receipt before changing this input.`,
            ),
          );
          panel.append(card);
          return;
        }
        let chain = Promise.resolve();
        for (const [key, label, type] of [
          ["lotId", "Saved lot UUID", "text"],
          ["quantity", "Quantity of ties", "number"],
          ["workLocation", "Work location", "text"],
          ["reason", "Reason", "text"],
        ]) {
          const wrapper = node("label", label);
          wrapper.style.display = "block";
          const field = node("input");
          field.type = type;
          field.value = String(draft.command[key] ?? "");
          field.setAttribute("aria-label", label);
          field.style.cssText =
            "display:block;width:100%;min-height:44px;color:#0f172a;margin:6px 0 16px;padding:8px;box-sizing:border-box";
          // Lot identity/version are frozen to the last reviewed snapshot while offline.
          if (key === "lotId") field.readOnly = true;
          else
            field.addEventListener("input", () => {
              draft.command[key] =
                type === "number" ? Number(field.value) : field.value;
              draft.updatedAt = new Date().toISOString();
              row.updatedAt = draft.updatedAt;
              status.textContent = "Saving on this device…";
              const copy = structuredClone(row);
              chain = chain
                .catch(() => undefined)
                .then(
                  () =>
                    new Promise((resolve, reject) => {
                      const tx = db.transaction("drafts", "readwrite");
                      tx.objectStore("drafts").put(copy);
                      tx.oncomplete = () => {
                        status.textContent = "Saved on this device";
                        resolve();
                      };
                      tx.onabort = tx.onerror = () => {
                        status.textContent =
                          "Device save failed. Keep this page open and preserve your input; previous saved work remains.";
                        reject(tx.error);
                      };
                    }),
                );
              chain.catch(() => {});
            });
          wrapper.append(field);
          card.append(wrapper);
        }
        card.addEventListener("submit", (event) => event.preventDefault());
        panel.append(card);
      });
    } catch (error) {
      db?.close();
      panel.append(
        node(
          "p",
          error instanceof Error
            ? error.message
            : "Saved drafts could not be opened. No work was deleted.",
        ),
      );
    }
  });
})();
