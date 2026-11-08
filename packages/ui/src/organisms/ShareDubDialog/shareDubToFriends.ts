export async function shareDubToFriends(
  buddyIds: string[],
  dubId: string,
  text: string,
  sendMessage: (buddyId: string, text: string, dubId: string) => boolean | Promise<boolean>,
): Promise<{ sent: string[]; failed: string[] }> {
  const sent: string[] = [];
  const failed: string[] = [];
  for (const buddyId of [...new Set(buddyIds)]) {
    if (await sendMessage(buddyId, text, dubId)) sent.push(buddyId);
    else failed.push(buddyId);
  }
  return { sent, failed };
}
