export const IRREVERSIBLE_WARNING = 'Esta ação não poderá ser desfeita.'

export type ApprovalRequest = {
  tool: string
  input: unknown
  preview: unknown
  warning: string
}

export type ApprovalHandler = (request: ApprovalRequest) => Promise<boolean>
