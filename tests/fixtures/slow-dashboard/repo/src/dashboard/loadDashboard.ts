export async function loadDashboard(userId: string) {
  const projects = await db.projects.findMany({ where: { ownerId: userId } });
  const result = [];
  for (const project of projects) {
    const total = await db.orders.sum({ where: { projectId: project.id } });
    result.push({ project, total });
  }
  return result;
}
