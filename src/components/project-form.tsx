"use client";

import { useActionState, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createProject } from "@/features/projects/actions";

type Option = { id: string | number; label: string };
type Choice = { value: string; label: string };

function useRemoteChoices<Row>(url: string | null, toChoice: (row: Row) => Choice) {
  const [loaded, setLoaded] = useState<{ url: string; choices: Choice[] }>();
  useEffect(() => {
    if (!url) return;
    let cancelled = false;
    fetch(url)
      .then((response) => (response.ok ? response.json() : []))
      .then((rows: Row[]) => !cancelled && setLoaded({ url, choices: rows.map(toChoice) }));
    return () => {
      cancelled = true;
    };
  }, [url, toChoice]);
  const ready = loaded?.url === url;
  return { choices: ready ? loaded.choices : [], loading: Boolean(url) && !ready };
}

const repoChoice = (repo: { owner: string; name: string }): Choice => ({ value: `${repo.owner}/${repo.name}`, label: `${repo.owner}/${repo.name}` });
const jiraChoice = (project: { key: string; name: string }): Choice => ({ value: project.key, label: `${project.key} — ${project.name}` });

function Select({ id, label, options, loading, onChange }: { id: string; label: string; options: Choice[]; loading?: boolean; onChange?: (value: string) => void }) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>{label}</Label>
      <select id={id} name={id} required defaultValue="" onChange={(e) => onChange?.(e.target.value)} className="h-9 rounded-lg border bg-background px-2 text-sm">
        <option value="" disabled>{loading ? "Loading…" : "Select…"}</option>
        {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
    </div>
  );
}

export function ProjectForm({ installations, connections }: { installations: Option[]; connections: Option[] }) {
  const [state, action, pending] = useActionState(createProject, {});
  const [installationId, setInstallationId] = useState<string>();
  const [connectionId, setConnectionId] = useState<string>();
  const repos = useRemoteChoices(installationId ? `/api/github/repos?installationId=${installationId}` : null, repoChoice);
  const jiraProjects = useRemoteChoices(connectionId ? `/api/jira/projects?connectionId=${connectionId}` : null, jiraChoice);
  const toChoices = (options: Option[]) => options.map((o) => ({ value: String(o.id), label: o.label }));

  return (
    <form action={action} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="name">Project name</Label>
        <Input id="name" name="name" required />
      </div>
      <Select id="installationId" label="GitHub account" options={toChoices(installations)} onChange={setInstallationId} />
      <Select key={installationId} id="repo" label="Repository" options={repos.choices} loading={repos.loading} />
      <Select id="connectionId" label="Jira site" options={toChoices(connections)} onChange={setConnectionId} />
      <Select key={connectionId} id="jiraProjectKey" label="Jira project" options={jiraProjects.choices} loading={jiraProjects.loading} />
      {state.error && <p role="alert" className="text-sm text-destructive">{state.error}</p>}
      <Button type="submit" disabled={pending} className="self-start">{pending ? "Creating…" : "Create project"}</Button>
    </form>
  );
}
