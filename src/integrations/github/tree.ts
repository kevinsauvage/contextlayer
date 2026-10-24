export type TreeEntry = { path?: string; type?: string; sha?: string; size?: number };

export type ListDirectory = (treeSha: string) => Promise<TreeEntry[]>;

type Directory = { sha: string; prefix: string };

// Rebuilds a truncated recursive tree one directory at a time: each listing is far below the API's truncation limit.
export async function walkTree(rootSha: string, listDirectory: ListDirectory): Promise<TreeEntry[]> {
  const files: TreeEntry[] = [];
  const queue: Directory[] = [{ sha: rootSha, prefix: "" }];
  // The queue grows while it is iterated: each staged subdirectory is appended.
  for (const directory of queue) {
    for (const entry of await listDirectory(directory.sha)) {
      if (!entry.path) continue;
      const path = directory.prefix ? `${directory.prefix}/${entry.path}` : entry.path;
      if (entry.type === "tree" && entry.sha) queue.push({ sha: entry.sha, prefix: path });
      else if (entry.type === "blob") files.push({ type: entry.type, path, size: entry.size });
    }
  }
  return files;
}
