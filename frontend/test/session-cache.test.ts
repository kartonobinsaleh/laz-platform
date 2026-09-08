import assert from "node:assert/strict";
import { test } from "node:test";
import { QueryClient, QueryObserver } from "@tanstack/react-query";
import { clearSessionCache } from "../src/auth/session-cache.ts";

type Account = { id: string } | null;

for (const [previous, next] of [
  ["volunteer", "super-admin"],
  ["lembaga-admin", "super-admin"],
  ["super-admin", "volunteer"],
] as const) {
  test(`logout ${previous}, then login ${next} without remounting providers`, async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    let staff: Account = previous === "volunteer" ? null : { id: previous };
    let volunteer: Account = previous === "volunteer" ? { id: previous } : null;
    const staffObserver = new QueryObserver(client, {
      queryKey: ["auth", "me"],
      queryFn: async () => staff,
      staleTime: 60_000,
    });
    const volunteerObserver = new QueryObserver(client, {
      queryKey: ["volunteer", "me"],
      queryFn: async () => volunteer,
      staleTime: 60_000,
    });
    const unsubscribeStaff = staffObserver.subscribe(() => {});
    const unsubscribeVolunteer = volunteerObserver.subscribe(() => {});
    try {
      await Promise.all([staffObserver.refetch(), volunteerObserver.refetch()]);
      client.setQueryData(["donations"], [{ id: "previous-session-data" }]);
      client.getMutationCache().build(client, { mutationKey: ["update-profile"] });

      staff = null;
      volunteer = null;
      await clearSessionCache(client);
      assert.equal(staffObserver.getCurrentResult().data, null);
      assert.equal(volunteerObserver.getCurrentResult().data, null);
      assert.equal(client.getQueryData(["donations"]), undefined);
      assert.equal(client.getMutationCache().getAll().length, 0);

      staff = next === "super-admin" ? { id: next } : null;
      volunteer = next === "volunteer" ? { id: next } : null;
      // This is the refresh performed by LoginForm after the server accepts login.
      await client.invalidateQueries({
        queryKey: [next === "volunteer" ? "volunteer" : "auth", "me"],
      });
      assert.deepEqual(staffObserver.getCurrentResult().data, staff);
      assert.deepEqual(volunteerObserver.getCurrentResult().data, volunteer);
    } finally {
      unsubscribeStaff();
      unsubscribeVolunteer();
      client.clear();
    }
  });
}

test("a previous account's pending auth response cannot restore it after logout", async () => {
  const client = new QueryClient();
  let resolveRequest!: (value: Account) => void;
  const pendingRequest = new Promise<Account>((resolve) => { resolveRequest = resolve; });
  const observer = new QueryObserver(client, {
    queryKey: ["auth", "me"],
    queryFn: () => pendingRequest,
  });
  const unsubscribe = observer.subscribe(() => {});
  try {
    await clearSessionCache(client);
    resolveRequest({ id: "previous-admin" });
    await pendingRequest;
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(observer.getCurrentResult().data, null);
    assert.equal(client.getQueryData(["auth", "me"]), null);
  } finally {
    unsubscribe();
    client.clear();
  }
});
