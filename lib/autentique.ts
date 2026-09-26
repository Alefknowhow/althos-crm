// Cliente da API GraphQL da Autentique (https://docs.autentique.com.br).
// Cada organização usa sua PRÓPRIA chave — nunca uma chave compartilhada da
// plataforma — então toda função aqui recebe o apiKey explicitamente.

const ENDPOINT = 'https://api.autentique.com.br/v2/graphql'

async function graphql(apiKey: string, query: string, variables: Record<string, any>) {
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query, variables }),
  })
  const json = await res.json()
  if (json.errors?.length) {
    throw new Error(json.errors[0]?.message || 'Erro na API da Autentique')
  }
  return json.data
}

async function graphqlMultipart(apiKey: string, query: string, variables: Record<string, any>, file: Blob, fileName: string) {
  const form = new FormData()
  form.append('operations', JSON.stringify({ query, variables: { ...variables, file: null } }))
  form.append('map', JSON.stringify({ file: ['variables.file'] }))
  form.append('file', file, fileName)

  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
  })
  const json = await res.json()
  if (json.errors?.length) {
    throw new Error(json.errors[0]?.message || 'Erro na API da Autentique')
  }
  return json.data
}

export type AutentiqueSigner = {
  name?: string
  email?: string
  phone?: string
  deliveryMethod?: 'EMAIL' | 'WHATSAPP' | 'SMS'
}

export async function createAutentiqueDocument(
  apiKey: string,
  documentName: string,
  signers: AutentiqueSigner[],
  pdf: Blob,
  fileName: string,
) {
  const query = `
    mutation CreateDocument($document: DocumentInput!, $signers: [SignerInput!]!, $file: Upload!) {
      createDocument(document: $document, signers: $signers, file: $file) {
        id
        name
        signatures {
          public_id
          name
          email
          link { short_link }
        }
      }
    }
  `
  const signerInputs = signers.map(signer => {
    const signerInput: Record<string, any> = { action: 'SIGN' }
    if (signer.email) {
      signerInput.email = signer.email
    } else if (signer.phone) {
      signerInput.phone = signer.phone
      signerInput.delivery_method = signer.deliveryMethod || 'WHATSAPP'
    }
    if (signer.name) signerInput.name = signer.name
    return signerInput
  })

  const data = await graphqlMultipart(
    apiKey,
    query,
    { document: { name: documentName }, signers: signerInputs },
    pdf,
    fileName,
  )
  return data.createDocument as {
    id: string
    name: string
    signatures: { public_id: string; name: string; email: string | null; link: { short_link: string } | null }[]
  }
}

export async function getAutentiqueDocumentStatus(apiKey: string, documentId: string) {
  const query = `
    query GetDocument($id: UUID!) {
      document(id: $id) {
        id
        name
        files { signed pades }
        signatures {
          public_id
          name
          email
          created_at
          link { short_link }
          signed { created_at }
        }
      }
    }
  `
  const data = await graphql(apiKey, query, { id: documentId })
  return data.document as {
    id: string
    name: string
    files: { signed: string | null; pades: string | null }
    signatures: { public_id: string; name: string; email: string | null; signed: { created_at: string } | null; link: { short_link: string } | null }[]
  } | null
}

/**
 * Cancela/exclui um documento na Autentique (issue #60, B.5) — chamado só
 * ao cancelar um contrato local que ainda não foi assinado. `deleteDocument`
 * segue a mesma convenção de nome de `createDocument`, mas **não foi
 * confirmado contra a documentação oficial** (acesso bloqueado pelo proxy
 * de rede desta sessão) — por isso todo caller trata a falha como
 * best-effort (nunca bloqueia o cancelamento local, só registra em
 * contract_events). Se a Autentique usar outro nome de mutation, isso vai
 * falhar sempre e aparecer como contract.autentique_cancel_failed no
 * histórico — sinal pra corrigir o nome aqui.
 */
export async function deleteAutentiqueDocument(apiKey: string, documentId: string): Promise<void> {
  const query = `
    mutation DeleteDocument($id: UUID!) {
      deleteDocument(id: $id) {
        id
      }
    }
  `
  await graphql(apiKey, query, { id: documentId })
}

/**
 * A Autentique às vezes inclui na resposta um signatário extra que nunca
 * assinamos explicitamente (ex.: o dono da própria conta/API como
 * aprovador implícito) — cobrar `signatures.every(signed)` trava o
 * documento pra sempre nesse caso, mesmo com todos os signatários REAIS já
 * tendo assinado. Em vez disso, checa só os e-mails que nós mesmos
 * cadastramos como signatários (signer_email / signer2_email).
 */
export function isDocumentSignedByKnownSigners(
  doc: { signatures: { email: string | null; signed: { created_at: string } | null }[] } | null,
  knownEmails: (string | null | undefined)[],
): boolean {
  const emails = knownEmails.filter((e): e is string => !!e).map(e => e.toLowerCase())
  if (!doc || emails.length === 0) return false
  return emails.every(email =>
    doc.signatures.some(s => s.email?.toLowerCase() === email && !!s.signed),
  )
}
