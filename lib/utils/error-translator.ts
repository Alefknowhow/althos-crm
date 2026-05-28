export function traduzirErro(error: any): string {
    if (!error) return 'Erro ao criar organização. Tente novamente.'

    const msg = error.message || error.toString()

    if (msg.includes('Já existe uma organização com esse slug')) {
        return 'Esse nome já está em uso. Tente outro.'
    }

    if (msg.includes('duplicate key') || msg.includes('unique constraint')) {
        return 'Esse nome já está em uso. Tente outro.'
    }

    if (msg.includes('not authenticated') || msg.includes('Usuário não autenticado')) {
        return 'Você precisa estar logado.'
    }

    return 'Erro ao criar organização. Tente novamente.'
}