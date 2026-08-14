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
  signer: AutentiqueSigner,
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
  const signerInput: Record<string, any> = { action: 'SIGN' }
  if (signer.email) {
    signerInput.email = signer.email
  } else if (signer.phone) {
    signerInput.phone = signer.phone
    signerInput.delivery_method = signer.deliveryMethod || 'WHATSAPP'
  }
  if (signer.name) signerInput.name = signer.name

  const data = await graphqlMultipart(
    apiKey,
    query,
    { document: { name: documentName }, signers: [signerInput] },
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
    query GetDocument($id: ID!) {
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
