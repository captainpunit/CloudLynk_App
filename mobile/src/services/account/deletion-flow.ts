interface DeletionDependencies {
  reauthenticate: () => Promise<string>;
  request: (confirmation: string) => Promise<{ requestId: string; status: string }>;
  signOut: () => Promise<unknown>;
}

export async function requestVerifiedDeletion(
  userId: string,
  confirmation: string,
  dependencies: DeletionDependencies,
) {
  if (confirmation !== 'DELETE') throw new Error('Type DELETE to confirm.');
  const authenticatedId = await dependencies.reauthenticate();
  if (authenticatedId !== userId) throw new Error('Your account changed. Sign in again.');
  const result = await dependencies.request(confirmation);
  if (result.status !== 'queued' || typeof result.requestId !== 'string' || !result.requestId) {
    throw new Error('The server did not confirm your deletion request. Please try again.');
  }
  // An accepted request must remain successful even when session cleanup fails.
  await dependencies.signOut().catch(() => {});
  return result;
}
