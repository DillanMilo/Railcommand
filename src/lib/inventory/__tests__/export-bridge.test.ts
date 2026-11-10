import assert from "node:assert/strict";
import { shareWorkspaceBlob } from "../../native-workspace";
it("does not send a financial file to the native bridge after sign-out during FileReader", async () => {
  const previousWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  const previousReader = Object.getOwnPropertyDescriptor(
    globalThis,
    "FileReader",
  );
  const sent: string[] = [];
  let complete: () => void = () => {};
  let current = true;
  class Reader {
    result: string | null = null;
    onload: (() => void) | null = null;
    readAsDataURL() {
      complete = () => {
        this.result = "data:text/csv;base64,Y3N2";
        this.onload?.();
      };
    }
  }
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: { ReactNativeWebView: { postMessage: (s: string) => sent.push(s) } },
  });
  Object.defineProperty(globalThis, "FileReader", {
    configurable: true,
    value: Reader,
  });
  try {
    const pending = shareWorkspaceBlob(
      new Blob(["csv"], { type: "text/csv" }),
      "cost.csv",
      () => current,
    );
    current = false;
    complete();
    await assert.rejects(pending, /account or project changed/);
    assert.deepEqual(sent, []);
  } finally {
    if (previousWindow)
      Object.defineProperty(globalThis, "window", previousWindow);
    else Reflect.deleteProperty(globalThis, "window");
    if (previousReader)
      Object.defineProperty(globalThis, "FileReader", previousReader);
    else Reflect.deleteProperty(globalThis, "FileReader");
  }
});
