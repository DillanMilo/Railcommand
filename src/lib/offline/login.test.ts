import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { describe, it } from 'mocha';
import ts from 'typescript';

const source = ts.createSourceFile(
  'login.tsx',
  readFileSync(new URL('../../app/(auth)/login/page.tsx', import.meta.url), 'utf8'),
  ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX,
);
let callback: ts.Expression | undefined;
function findCallback(node: ts.Node) {
  if (ts.isVariableDeclaration(node) && node.name.getText(source) === 'handleSignIn'
    && node.initializer && ts.isCallExpression(node.initializer)) {
    callback = node.initializer.arguments[0];
  }
  ts.forEachChild(node, findCallback);
}
findCallback(source);
assert.ok(callback);
const compiled = ts.transpileModule(`const signIn = ${callback.getText(source)}; signIn;`, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None },
}).outputText;

describe('authenticated login redirect', () => {
  for (const authError of [null, { message: 'Invalid login credentials' }]) {
    it(authError ? 'does not redirect failed authentication' : 'does not wait for demo cleanup after successful authentication', async () => {
      const redirects: string[] = [];
      const errors: unknown[] = [];
      let cleanupCalls = 0;
      const signIn = runInNewContext(compiled, {
        setIsLoading: () => {}, setAuthError: (error: unknown) => errors.push(error),
        createClient: () => ({ auth: { signInWithPassword: async () => ({ error: authError }) } }),
        getSupabaseAuthErrorMessage: (error: { message: string }) => error.message,
        rememberMe: false, redirectPath: '/dashboard', document: { cookie: '' },
        localStorage: { removeItem: () => {} },
        fetch: () => { cleanupCalls += 1; return new Promise(() => {}); },
        router: { replace: (path: string) => redirects.push(path) },
      }) as (data: { email: string; password: string }) => Promise<void>;
      await signIn({ email: 'synthetic@example.invalid', password: 'synthetic' });
      assert.deepEqual(redirects, authError ? [] : ['/dashboard']);
      assert.equal(cleanupCalls, authError ? 0 : 1);
      assert.equal(errors.at(-1), authError?.message ?? null);
    });
  }
});
