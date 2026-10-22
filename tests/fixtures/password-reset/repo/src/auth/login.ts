import { verifyPassword, findUserByEmail } from "./users";

export async function login(email: string, password: string) {
  const user = await findUserByEmail(email);
  if (!user || !(await verifyPassword(user, password))) throw new Error("Invalid credentials");
  return { userId: user.id };
}
