import type { QueryClient } from "@tanstack/react-query";

/** Both principals share one server session, but keep separate auth queries. */
export async function clearSessionCache(queryClient: QueryClient): Promise<void> {
  // Prevent an in-flight response from restoring the previous account's data.
  await queryClient.cancelQueries();
  queryClient.setQueryData(["auth", "me"], null);
  queryClient.setQueryData(["volunteer", "me"], null);

  // Keep mounted auth observers connected so login's invalidateQueries refetches.
  // All other data and mutation results belong to the previous session.
  queryClient.removeQueries({
    predicate: ({ queryKey }) => !(
      queryKey.length === 2 &&
      (queryKey[0] === "auth" || queryKey[0] === "volunteer") &&
      queryKey[1] === "me"
    ),
  });
  queryClient.getMutationCache().clear();
}
