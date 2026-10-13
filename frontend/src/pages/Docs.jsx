const DOCS = [
  ['docs/Setup_Guide.md', 'Install, start the stack locally, choose a model, troubleshoot.'],
  ['docs/Deployment_Guide.md', 'Step-by-step launch on Supabase, Render and Vercel (written for first-timers).'],
  ['labs/guided/', 'Guided lab per module: walkthrough, payload tables, flag, fix-it, checklist.'],
  ['docs/Architecture.md', 'Services, module contract, request flow, data flow.'],
  ['docs/LLM_Top_10_Mapping.md', 'Threat → vulnerable code → attack → impact → mitigation → validation per module.'],
  ['docs/Module_Development.md', 'Step-by-step guide to adding a new vulnerability module.'],
  ['docs/Security_Model.md', 'Trust boundaries, sandbox design, known limitations, authentication model.'],
  ['docs/Contributor_Guide.md', 'Workflow, code style, review expectations.'],
  ['docs/Security_Review.md', 'Automated and manual review results and fixes.'],
  ['docs/Vulnerability_Writeups/', 'Full write-up per module.'],
]

export default function Docs() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Documentation</h1>
      <p className="text-fog-300">Documentation lives in the repository under <code>docs/</code> so it is versioned with the code.</p>
      <ul className="panel divide-y divide-ink-800">
        {DOCS.map(([file, desc]) => <li key={file} className="flex flex-wrap gap-x-4 p-3"><code className="text-steel-400">{file}</code><span className="text-fog-300">{desc}</span></li>)}
      </ul>
    </div>
  )
}
