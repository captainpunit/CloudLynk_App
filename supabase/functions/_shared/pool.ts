// Keep provider calls bounded, including receipt polling and cleanup retries.
export async function pool<T>(
  items: T[],
  limit: number,
  work: (item: T) => Promise<void>,
) {
  let index = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (index < items.length) {
        const item = items[index++];
        await work(item);
      }
    }),
  );
}
