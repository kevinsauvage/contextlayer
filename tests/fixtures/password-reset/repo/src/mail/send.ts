export async function sendMail(to: string, subject: string, html: string) {
  // Thin wrapper around the transactional provider client.
  return providerClient.send({ to, subject, html });
}
