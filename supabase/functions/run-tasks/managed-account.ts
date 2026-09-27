// A shared persona assignment grants draft targeting, never provider approval.
export type ManagedAccount = { id: string; owner: string; persona_id: string | null; provider: string; suspended: boolean };
export type ManagedAccountReader = (table: string, columns: string, filters: Record<string,string>) => Promise<{data: unknown; error: unknown}>;

export async function loadManagedAccount(read: ManagedAccountReader, owner: string, personaId: string, ledgerId: string): Promise<ManagedAccount | null> {
  const result = await read('account_ledger', 'id,owner,persona_id,provider,suspended', {id:ledgerId,owner});
  if (result.error || !result.data) return null;
  const account = result.data as ManagedAccount;
  if (account.id !== ledgerId || account.owner !== owner || account.suspended !== false || !account.provider) return null;
  if (account.persona_id === personaId) return account;
  const shared = await read('account_persona_links', 'ledger_id,persona_id,owner', {ledger_id:ledgerId,persona_id:personaId,owner});
  if (shared.error || !shared.data) return null;
  const link = shared.data as {ledger_id: string; persona_id: string; owner: string};
  return link.ledger_id === ledgerId && link.persona_id === personaId && link.owner === owner ? account : null;
}
