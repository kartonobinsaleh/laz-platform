import { api, asAction, type ActionResult } from "@/lib/api-client";
import { queryClient } from "@/lib/query-client";

export async function updateAvatarAction(formData: FormData): Promise<ActionResult> {
  const result = await asAction(api.put("/settings/avatar", Object.fromEntries(formData.entries())));
  if (result.success) await queryClient.invalidateQueries({ queryKey: ["auth", "me"] });
  return result;
}
