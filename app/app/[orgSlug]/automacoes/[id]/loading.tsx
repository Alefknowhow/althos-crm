/**
 * Feedback instantâneo ao abrir uma automação — sem isso, a tela ficava
 * "parada" durante o fetch (automation/forms/stages/templates/runs),
 * parecendo travada em vez de responsiva.
 */
export default function AutomationEditorLoading() {
  return (
    <div className="h-full overflow-y-auto bg-muted/20 flex flex-col items-center py-8 px-4 gap-3 animate-pulse">
      <div className="w-full max-w-[420px] rounded-md border bg-card overflow-hidden">
        <div className="h-1 w-full bg-muted" />
        <div className="p-3 space-y-3">
          <div className="h-3 w-16 bg-muted rounded" />
          <div className="h-4 w-40 bg-muted rounded" />
        </div>
      </div>
      <div className="w-px h-6 bg-border" />
      <div className="w-full max-w-[420px] rounded-md border bg-card overflow-hidden">
        <div className="h-1 w-full bg-muted" />
        <div className="p-3 space-y-3">
          <div className="h-3 w-16 bg-muted rounded" />
          <div className="h-4 w-32 bg-muted rounded" />
          <div className="h-8 w-full bg-muted rounded" />
        </div>
      </div>
    </div>
  )
}
