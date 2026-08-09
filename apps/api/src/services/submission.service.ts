export class ResponseCapReachedError extends Error {}

export type CapCountTx = {
  testResponse: {
    count: (args: { where: { testId: string } }) => Promise<number>;
  };
};

// Re-checks the response cap inside the submission transaction so two
// concurrent submissions cannot both pass a stale count and exceed the cap.
export async function assertResponseCapAvailable(
  tx: CapCountTx,
  testId: string,
  responseCap: number | null
): Promise<void> {
  if (responseCap === null) return;
  const count = await tx.testResponse.count({ where: { testId } });
  if (count >= responseCap) {
    throw new ResponseCapReachedError();
  }
}
